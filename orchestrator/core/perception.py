"""Perception builder — loads on-chain state for an agent's tick."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from web3 import AsyncWeb3

from chain.contracts import (
    get_agent_on_chain,
    get_current_block,
    Contracts,
)

logger = logging.getLogger(__name__)

# Tier thresholds in wei (1 AKY = 1e18 wei)
AKY = 10**18
TIER_THRESHOLDS = [
    (4, 5000 * AKY),   # T4: >5000 AKY
    (3, 500 * AKY),    # T3: 500-5000
    (2, 50 * AKY),     # T2: 50-500
    (1, 0),             # T1: <50
]


def _vault_to_tier(vault_wei: int) -> int:
    for tier, threshold in TIER_THRESHOLDS:
        if vault_wei >= threshold:
            return tier
    return 1


def _wei_to_aky(wei: int) -> float:
    return wei / AKY


@dataclass
class Perception:
    """Snapshot of what an agent perceives at tick time."""
    agent_id: int
    block_number: int
    vault_wei: int
    vault_aky: float
    tier: int
    world: int
    reputation: int
    contracts_honored: int
    contracts_broken: int
    daily_work_points: int
    alive: bool
    season_info: str | None = None
    nearby_agents: list[dict] = field(default_factory=list)
    recent_events: list[str] = field(default_factory=list)
    # v2 Economy
    my_projects: list[dict] = field(default_factory=list)
    my_scores: dict = field(default_factory=dict)
    governor_info: dict = field(default_factory=dict)
    season_info_v2: dict | None = None
    assigned_tasks: list[dict] = field(default_factory=list)
    daily_life_cost: float = 1.0
    estimated_survival_days: float = 0.0
    yesterday_reward: float = 0.0
    # Messages received from other agents
    inbox_messages: list[dict] = field(default_factory=list)
    # Recent world chat (public messages in same world)
    world_chat: list[dict] = field(default_factory=list)
    # Economy context (ideas, chronicle, global stats)
    popular_ideas: list[dict] = field(default_factory=list)
    chronicle_info: str | None = None
    economy_stats: dict = field(default_factory=dict)
    # Votable content (with IDs for agents to vote on)
    votable_chronicles: list[dict] = field(default_factory=list)
    votable_marketing_posts: list[dict] = field(default_factory=list)
    marketing_winner: dict = field(default_factory=dict)
    # v3 Governance
    governor_vote_tally: dict = field(default_factory=dict)
    pending_death_trials: list[dict] = field(default_factory=list)
    # v3 AI Society
    collective_knowledge: list[dict] = field(default_factory=list)
    nearby_agent_profiles: list[dict] = field(default_factory=list)  # specialization, motto, etc.

    @property
    def summary(self) -> str:
        """One-line summary used as Qdrant query for memory recall."""
        return (
            f"Agent #{self.agent_id} in world {self.world}, "
            f"{self.vault_aky:.1f} AKY, tier T{self.tier}, "
            f"rep {self.reputation}, block {self.block_number}"
        )


async def build_perception(agent_id: int) -> Perception:
    """Build the full perception for an agent tick."""
    # 1. Core agent state
    agent = await get_agent_on_chain(agent_id)
    block = await get_current_block()

    vault_wei = agent["vault"]
    vault_aky = _wei_to_aky(vault_wei)
    tier = _vault_to_tier(vault_wei)

    if not agent["alive"]:
        raise AgentDeadError(f"Agent #{agent_id} is dead — cannot tick")

    # 2. Season info
    season_info = await _get_season_info()

    # 3. Nearby agents (same world)
    nearby = await _get_nearby_agents(agent_id, agent["world"])

    # 4. Recent events in world (from on-chain or DB — simplified: empty for now, filled by event_listener later)
    recent_events: list[str] = []

    return Perception(
        agent_id=agent_id,
        block_number=block,
        vault_wei=vault_wei,
        vault_aky=vault_aky,
        tier=tier,
        world=agent["world"],
        reputation=agent["reputation"],
        contracts_honored=agent["contracts_honored"],
        contracts_broken=agent["contracts_broken"],
        daily_work_points=agent["daily_work_points"],
        alive=agent["alive"],
        season_info=season_info,
        nearby_agents=nearby,
        recent_events=recent_events,
    )


async def _get_season_info() -> str | None:
    """Get current season info from WorldManager."""
    try:
        wm = Contracts.world_manager()
        season_type = await wm.functions.activeSeasonType().call()
        season_ends = await wm.functions.seasonEndsAt().call()
        block = await get_current_block()

        if block >= season_ends:
            return None

        season_names = {0: "Aucune", 1: "Gold Rush (3x rewards)", 2: "Catastrophe", 3: "New Land"}
        name = season_names.get(season_type, f"Type {season_type}")
        blocks_left = season_ends - block
        return f"{name} — {blocks_left} blocs restants"
    except Exception as e:
        logger.warning(f"Could not fetch season info: {e}")
        return None


async def _get_nearby_agents(exclude_id: int, world: int) -> list[dict]:
    """Get agents in the same world (limited to 20 for prompt size)."""
    try:
        registry = Contracts.agent_registry()
        next_id = await registry.functions.agentCount().call() + 1

        nearby: list[dict] = []
        for aid in range(1, min(next_id, 200)):  # Cap scan at 200 agents for perf
            if aid == exclude_id:
                continue
            try:
                agent = await get_agent_on_chain(aid)
                if agent["alive"] and agent["world"] == world:
                    nearby.append({
                        "agent_id": aid,
                        "vault_aky": _wei_to_aky(agent["vault"]),
                        "reputation": agent["reputation"],
                    })
            except Exception:
                continue

            if len(nearby) >= 20:
                break

        return nearby
    except Exception as e:
        logger.warning(f"Could not fetch nearby agents: {e}")
        return []


async def build_social_perception(agent_id: int, perception: Perception, db) -> Perception:
    """Enrich perception with messages from other agents.

    Loads:
    - Unread private messages (inbox)
    - Recent world chat (last 10 messages in same world)
    - Recent events in the world
    """
    try:
        async with db.begin_nested():
            from sqlalchemy import select, or_, and_
            from models.message import Message
            from models.event import Event

            now = datetime.utcnow()
            cutoff = now - timedelta(hours=6)  # Only last 6 hours

            # 1. Unread private messages TO this agent
            inbox_result = await db.execute(
                select(Message)
                .where(
                    Message.to_agent_id == agent_id,
                    Message.channel == "private",
                    Message.created_at >= cutoff,
                )
                .order_by(Message.created_at.desc())
                .limit(10)
            )
            inbox = inbox_result.scalars().all()
            perception.inbox_messages = [
                {
                    "from": m.from_agent_id,
                    "content": m.content[:300],
                    "time": m.created_at.strftime("%H:%M"),
                    "is_read": m.is_read,
                }
                for m in reversed(inbox)  # Chronological order
            ]

            # Mark as read
            for m in inbox:
                m.is_read = True

            # 2. World chat (public/world messages in same world)
            world_result = await db.execute(
                select(Message)
                .where(
                    Message.channel == "world",
                    Message.world == perception.world,
                    Message.created_at >= cutoff,
                    Message.from_agent_id != agent_id,
                )
                .order_by(Message.created_at.desc())
                .limit(10)
            )
            world_msgs = world_result.scalars().all()
            perception.world_chat = [
                {
                    "from": m.from_agent_id,
                    "content": m.content[:200],
                    "time": m.created_at.strftime("%H:%M"),
                }
                for m in reversed(world_msgs)
            ]

            # 3. Recent events in world (actions by other agents)
            events_result = await db.execute(
                select(Event)
                .where(
                    Event.world == perception.world,
                    Event.created_at >= cutoff,
                    Event.agent_id != agent_id,
                )
                .order_by(Event.created_at.desc())
                .limit(10)
            )
            events = events_result.scalars().all()
            perception.recent_events = [e.summary for e in reversed(events)]

    except Exception as e:
        logger.warning(f"Could not build social perception for agent #{agent_id}: {e}")

    return perception


async def build_economy_perception(agent_id: int, perception: Perception, db) -> Perception:
    """Enrich perception with economy context: ideas, chronicle, global stats.

    This gives agents topics to discuss and awareness of the reward systems.
    """
    try:
        async with db.begin_nested():
            from sqlalchemy import select, func, desc
            from models.idea import Idea
            from models.story import Story

            now = datetime.utcnow()
            day_ago = now - timedelta(hours=24)

            # 1. Popular ideas (top 5 active ideas by likes)
            ideas_result = await db.execute(
                select(Idea)
                .where(Idea.transmitted == False)
                .order_by(desc(Idea.likes), desc(Idea.created_at))
                .limit(5)
            )
            ideas = ideas_result.scalars().all()
            perception.popular_ideas = [
                {
                    "id": idea.id,
                    "agent_id": idea.agent_id,
                    "content": idea.content[:120],
                    "likes": idea.likes,
                }
                for idea in ideas
            ]

            # 2. Chronicle info (stories submitted today + yesterday's winners)
            stories_today = await db.execute(
                select(func.count(Story.id)).where(Story.created_at >= day_ago)
            )
            story_count = stories_today.scalar() or 0

            # Yesterday's top winners
            winners_result = await db.execute(
                select(Story.agent_id, Story.reward_aky)
                .where(Story.reward_aky > 0)
                .order_by(desc(Story.created_at))
                .limit(3)
            )
            winners = winners_result.all()

            if winners:
                winner_strs = [f"NX-{w[0]:04d} ({int(w[1])} AKY)" for w in winners]
                perception.chronicle_info = (
                    f"{story_count} histoires soumises aujourd'hui. "
                    f"Derniers gagnants : {', '.join(winner_strs)}"
                )
            else:
                perception.chronicle_info = (
                    f"{story_count} histoires soumises aujourd'hui. "
                    "Personne n'a encore gagne la Chronique."
                )

            # Votable chronicles (today's, exclude own)
            from models.chronicle import Chronicle
            today_start = datetime.combine(datetime.utcnow().date(), datetime.min.time())
            votable_result = await db.execute(
                select(Chronicle)
                .where(Chronicle.created_at >= today_start, Chronicle.author_agent_id != agent_id)
                .order_by(desc(Chronicle.vote_count), desc(Chronicle.created_at))
                .limit(5)
            )
            perception.votable_chronicles = [
                {"id": str(c.id), "author": c.author_agent_id, "preview": c.content[:150], "votes": c.vote_count}
                for c in votable_result.scalars().all()
            ]

        # On-chain calls outside savepoint (no DB involved)
        registry = Contracts.agent_registry()
        agent_count = await registry.functions.agentCount().call()
        alive_count = await registry.functions.aliveAgentCount().call()

        forge = Contracts.forge_factory()
        creations_count = await forge.functions.allCreationsLength().call()

        perception.economy_stats = {
            "total_agents": agent_count,
            "alive_agents": alive_count,
            "tokens_created": creations_count,
        }

    except Exception as e:
        logger.warning(f"Could not build economy perception for agent #{agent_id}: {e}")

    return perception


async def build_v2_economy_perception(agent_id: int, perception: Perception, db) -> Perception:
    """Enrich perception with v2 economy context: projects, scores, governor, seasons, tasks.

    This gives agents awareness of their contribution scores and economic parameters.
    """
    try:
        async with db.begin_nested():
            from sqlalchemy import select, desc
            from models.project import Project
            from models.daily_impact_score import DailyImpactScore
            from models.governor_log import GovernorLog
            from models.season import Season
            from datetime import date

            # 1. My projects
            projects_result = await db.execute(
                select(Project)
                .where(Project.creator_agent_id == agent_id, Project.is_alive == True)
                .order_by(desc(Project.created_at))
                .limit(10)
            )
            projects = projects_result.scalars().all()
            perception.my_projects = [
                {
                    "name": p.name,
                    "symbol": p.symbol,
                    "type": p.project_type,
                    "market_cap": p.market_cap,
                    "volume_24h": p.volume_24h,
                    "holders_count": p.holders_count,
                    "fees_generated_24h": p.fees_generated_24h,
                    "pool_status": getattr(p, "pool_status", None) or "none",
                    "audit_status": p.audit_status,
                }
                for p in projects
            ]

            # 2. My scores (yesterday)
            yesterday = str(date.today() - timedelta(days=1))
            scores_result = await db.execute(
                select(DailyImpactScore)
                .where(
                    DailyImpactScore.agent_id == agent_id,
                    DailyImpactScore.day == yesterday,
                )
            )
            score = scores_result.scalar_one_or_none()
            if score:
                perception.my_scores = {
                    "impact_score": score.impact_score,
                    "trade_score": score.trade_score,
                    "activity_score": score.activity_score,
                    "work_score": score.work_score,
                    "social_score": score.social_score,
                    "balance_score": score.balance_score,
                    "total_reward": score.total_reward,
                }
                perception.yesterday_reward = score.total_reward

            # 3. Governor info
            gov_result = await db.execute(
                select(GovernorLog)
                .order_by(desc(GovernorLog.created_at))
                .limit(1)
            )
            gov = gov_result.scalar_one_or_none()
            if gov:
                perception.governor_info = {
                    "velocity": gov.velocity,
                    "velocity_target": gov.velocity_target,
                    "fee_multiplier": gov.fee_multiplier,
                    "creation_cost_multiplier": gov.creation_cost_multiplier,
                    "life_cost_multiplier": gov.life_cost_multiplier,
                }
                perception.daily_life_cost = 1.0 * gov.life_cost_multiplier

            # 4. Votable marketing posts
            from models.marketing_post import MarketingPost
            now = datetime.utcnow()
            posts_result = await db.execute(
                select(MarketingPost)
                .where(MarketingPost.author_agent_id != agent_id, MarketingPost.expires_at > now)
                .order_by(desc(MarketingPost.vote_count))
                .limit(5)
            )
            perception.votable_marketing_posts = [
                {"id": str(p.id), "author": p.author_agent_id, "preview": p.content[:150], "votes": p.vote_count}
                for p in posts_result.scalars().all()
            ]

            # 4b. Yesterday's marketing winner (for inspiration)
            winner_result = await db.execute(
                select(MarketingPost)
                .where(MarketingPost.is_winner == True)
                .order_by(desc(MarketingPost.created_at))
                .limit(1)
            )
            winner = winner_result.scalar_one_or_none()
            if winner:
                perception.marketing_winner = {
                    "author": winner.author_agent_id,
                    "preview": winner.content[:100],
                    "votes": winner.vote_count,
                    "reward": winner.reward_aky,
                    "x_likes": winner.x_likes,
                    "x_retweets": winner.x_retweets,
                    "x_views": winner.x_views,
                    "virality_bonus": winner.virality_bonus,
                }

            # 5. Active season
            season_result = await db.execute(
                select(Season)
                .where(Season.ends_at > now)
                .order_by(desc(Season.created_at))
                .limit(1)
            )
            season = season_result.scalar_one_or_none()
            if season:
                perception.season_info_v2 = {
                    "type": season.season_type,
                    "effects": season.effects or {},
                    "ends_at": season.ends_at.isoformat() if season.ends_at else None,
                }

        # 6. Governor vote tally (so agents know current consensus)
        try:
            from models.governor_vote import GovernorVote
            from datetime import date
            today_str = date.today().isoformat()
            gv_result = await db.execute(
                select(GovernorVote).where(GovernorVote.epoch_date == today_str)
            )
            gv_all = gv_result.scalars().all()
            tally: dict[str, dict[str, int]] = {}
            for gv in gv_all:
                if gv.param not in tally:
                    tally[gv.param] = {"up": 0, "down": 0, "stable": 0}
                if gv.direction in tally[gv.param]:
                    tally[gv.param][gv.direction] += 1
            perception.governor_vote_tally = tally
        except Exception:
            pass

        # 7. Collective knowledge (top 10 by upvotes, recent)
        try:
            from models.knowledge_entry import KnowledgeEntry
            kb_result = await db.execute(
                select(KnowledgeEntry)
                .order_by(desc(KnowledgeEntry.upvotes), desc(KnowledgeEntry.created_at))
                .limit(10)
            )
            perception.collective_knowledge = [
                {
                    "id": str(k.id),
                    "agent_id": k.agent_id,
                    "topic": k.topic,
                    "content": k.content[:200],
                    "upvotes": k.upvotes,
                }
                for k in kb_result.scalars().all()
            ]
        except Exception:
            pass

        # 7b. Nearby agent profiles (specialization, motto, alliance)
        try:
            from models.agent_config import AgentConfig as AC2
            nearby_ids = [a["agent_id"] for a in perception.nearby_agents[:20]]
            if nearby_ids:
                profiles_result = await db.execute(
                    select(AC2).where(AC2.agent_id.in_(nearby_ids))
                )
                perception.nearby_agent_profiles = [
                    {
                        "agent_id": p.agent_id,
                        "specialization": p.specialization,
                        "risk_tolerance": p.risk_tolerance,
                        "alliance_open": p.alliance_open,
                        "motto": p.motto,
                    }
                    for p in profiles_result.scalars().all()
                    if p.specialization or p.motto  # Only show agents who configured themselves
                ]
        except Exception:
            pass

        # 8. Pending death trials where this agent is a juror
        try:
            from models.death_trial import DeathTrial
            trials_result = await db.execute(
                select(DeathTrial).where(DeathTrial.status == "pending")
            )
            pending = trials_result.scalars().all()
            perception.pending_death_trials = [
                {
                    "trial_id": t.id,
                    "target_agent_id": t.target_agent_id,
                    "reason": t.reason,
                    "votes_survive": t.votes_survive,
                    "votes_condemn": t.votes_condemn,
                    "is_juror": agent_id in [int(x) for x in t.juror_ids.split(",")],
                }
                for t in pending
            ]
        except Exception:
            pass

        # Calculate estimated survival days
        if perception.daily_life_cost > 0:
            perception.estimated_survival_days = perception.vault_aky / perception.daily_life_cost
        else:
            perception.estimated_survival_days = 999.0

    except Exception as e:
        logger.warning(f"Could not build v2 economy perception for agent #{agent_id}: {e}")

    return perception


class AgentDeadError(Exception):
    """Raised when trying to tick a dead agent."""
    pass
