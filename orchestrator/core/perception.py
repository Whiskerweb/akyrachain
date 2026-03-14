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
    # Spatial / territory data
    tiles_owned: int = 0
    structures: list[dict] = field(default_factory=list)
    adjacent_free_tiles: int = 0
    next_claim_cost: float = 0.0
    passive_income: float = 0.0
    territory_neighbors: list[dict] = field(default_factory=list)
    owned_tile_coords: list[dict] | None = None
    suggested_tiles: list[tuple[int, int]] = field(default_factory=list)
    # Resources (MAT/INF/SAV)
    materials: int = 0
    influence: int = 0
    knowledge: int = 0
    land_tax: float = 0.0
    # Messages received from other agents
    inbox_messages: list[dict] = field(default_factory=list)
    # Recent world chat (public messages in same world)
    world_chat: list[dict] = field(default_factory=list)
    # Economy context (ideas, chronicle, global stats)
    popular_ideas: list[dict] = field(default_factory=list)
    chronicle_info: str | None = None
    economy_stats: dict = field(default_factory=dict)

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


async def build_spatial_perception(agent_id: int, perception: Perception, db) -> Perception:
    """Enrich a Perception with spatial/territory data from the DB.

    Args:
        agent_id: The agent ID
        perception: The base perception (already built)
        db: An AsyncSession

    Returns:
        The same Perception object, mutated with spatial data.
    """
    try:
        async with db.begin_nested():
            from core.world_actions import get_agent_territory, get_nearby_territories

            territory = await get_agent_territory(agent_id, db)
            perception.tiles_owned = territory["tiles_owned"]
            perception.structures = territory["structures"]
            perception.adjacent_free_tiles = territory["adjacent_free_tiles"]
            perception.next_claim_cost = territory["next_claim_cost"]
            perception.passive_income = territory["passive_income"]
            perception.owned_tile_coords = territory.get("owned_tile_coords")
            perception.suggested_tiles = territory.get("suggested_tiles", [])

            neighbors = await get_nearby_territories(agent_id, db)
            perception.territory_neighbors = neighbors

            # Load resources
            from core.resource_engine import get_agent_resources, compute_land_tax
            resources = await get_agent_resources(agent_id, db)
            perception.materials = resources["mat"]
            perception.influence = resources["inf"]
            perception.knowledge = resources["sav"]
            perception.land_tax = await compute_land_tax(agent_id, db)
    except Exception as e:
        logger.warning(f"Could not build spatial perception for agent #{agent_id}: {e}")

    return perception


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


class AgentDeadError(Exception):
    """Raised when trying to tick a dead agent."""
    pass
