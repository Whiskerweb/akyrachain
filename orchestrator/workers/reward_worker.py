"""Reward worker — daily reward computation + chronicle rewards.

Two mechanisms:
1. Daily rewards: redistribute to agents proportional to 6-dimension score
2. Chronicle: top 3 story submitters each day split 10K AKY (5K/3K/2K)

Score formula (Ecofinal v2):
  Reward = (0.15*Balance + 0.35*Impact + 0.20*Trade + 0.10*Activity + 0.10*Work + 0.10*Social) * pool
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from workers.celery_app import app
from config import get_settings

logger = logging.getLogger(__name__)

AKY = 10**18


def _get_db_session_factory():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    return async_sessionmaker(engine, expire_on_commit=False)


@app.task(name="workers.reward_worker.compute_daily_rewards")
def compute_daily_rewards():
    """Compute and distribute daily rewards for all alive agents.

    Runs once per day via Celery Beat.
    New formula: 20% Balance + 30% Build + 25% Trade + 15% Activity + 10% Work
    """
    asyncio.get_event_loop().run_until_complete(_compute_daily_rewards_async())


async def _compute_daily_rewards_async():
    from models.agent_config import AgentConfig
    from models.daily_trade_volume import DailyTradeVolume
    from chain.contracts import get_agent_on_chain
    from chain import tx_manager

    factory = _get_db_session_factory()

    async with factory() as db:
        # Get all active agents
        result = await db.execute(
            select(AgentConfig).where(AgentConfig.is_active == True)
        )
        configs = result.scalars().all()

        if not configs:
            logger.info("No active agents for reward distribution")
            return

        # -- Compute scores for each agent --
        today = datetime.now(timezone.utc).date()
        yesterday = today - timedelta(days=1)
        agent_scores: dict[int, dict] = {}
        totals = {"vault": 0, "trade": 0, "activity": 0, "work": 0}

        for config in configs:
            aid = config.agent_id
            try:
                agent = await get_agent_on_chain(aid)
                if not agent["alive"]:
                    continue

                vault_aky = agent["vault"] / AKY
                work_points = agent["daily_work_points"]

                # Trade volume (yesterday's trades)
                tv_result = await db.execute(
                    select(func.coalesce(func.sum(DailyTradeVolume.volume_aky), 0))
                    .where(
                        DailyTradeVolume.agent_id == aid,
                        DailyTradeVolume.day >= yesterday,
                    )
                )
                trade_volume = tv_result.scalar() or 0

                # Activity = ticks with real actions (not do_nothing) in last 24h
                from models.tick_log import TickLog
                active_result = await db.execute(
                    select(func.count())
                    .select_from(TickLog)
                    .where(
                        TickLog.agent_id == aid,
                        TickLog.action_type != "do_nothing",
                        TickLog.success == True,
                        TickLog.created_at >= datetime.now(timezone.utc) - timedelta(days=1),
                    )
                )
                active_ticks = active_result.scalar() or 0

                agent_scores[aid] = {
                    "vault": vault_aky,
                    "trade": trade_volume,
                    "activity": active_ticks,
                    "work": work_points,
                }
                totals["vault"] += vault_aky
                totals["trade"] += trade_volume
                totals["activity"] += active_ticks
                totals["work"] += work_points

            except Exception as e:
                logger.warning(f"Could not compute score for agent #{aid}: {e}")

        if not agent_scores:
            logger.info("No alive agents with scores")
            return

        # -- Calculate proportional scores --
        reward_pool = 100 + len(agent_scores) * 20
        logger.info(f"Daily reward pool: {reward_pool} AKY for {len(agent_scores)} agents")

        distributions: list[tuple[int, float]] = []

        for aid, scores in agent_scores.items():
            balance_s = (scores["vault"] / totals["vault"]) if totals["vault"] > 0 else 0
            trade_s = (scores["trade"] / totals["trade"]) if totals["trade"] > 0 else 0
            activity_s = (scores["activity"] / totals["activity"]) if totals["activity"] > 0 else 0
            work_s = (scores["work"] / totals["work"]) if totals["work"] > 0 else 0

            # Ecofinal v2 formula (Impact + Social added in Phase 5)
            composite = (
                0.15 * balance_s
                + 0.20 * trade_s
                + 0.10 * activity_s
                + 0.10 * work_s
                + 0.45 * balance_s  # Placeholder for Impact(0.35) + Social(0.10) until Phase 5
            )
            # Minimum reward: every alive agent gets at least 1 AKY/day
            reward = max(1.0, composite * reward_pool)
            distributions.append((aid, reward))

        # Normalize so total doesn't exceed pool
        total_distributed = sum(r for _, r in distributions)
        if total_distributed > reward_pool:
            scale = reward_pool / total_distributed
            distributions = [(aid, r * scale) for aid, r in distributions]

        # -- Distribute rewards on-chain --
        for aid, reward_aky in distributions:
            try:
                amount_wei = int(reward_aky * AKY)
                await tx_manager.deposit_for_agent_direct(aid, amount_wei)
                logger.info(f"Reward: agent #{aid} received {reward_aky:.2f} AKY")
            except Exception as e:
                logger.warning(f"Failed to deposit reward for agent #{aid}: {e}")

        logger.info(
            f"Daily rewards distributed: {sum(r for _, r in distributions):.1f} AKY "
            f"to {len(distributions)} agents"
        )


@app.task(name="workers.reward_worker.distribute_chronicle_rewards")
def distribute_chronicle_rewards():
    """Distribute 10K AKY/day to top 3 chronicle submitters by vote_count (5K/3K/2K).

    Runs once per day via Celery Beat.
    Ranking is by vote_count on chronicles submitted in the last 24 hours.
    """
    asyncio.get_event_loop().run_until_complete(_distribute_chronicle_async())


async def _distribute_chronicle_async():
    from models.chronicle import Chronicle
    from chain import tx_manager

    factory = _get_db_session_factory()

    async with factory() as db:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

        # Get top 3 chronicles by vote_count in last 24h
        result = await db.execute(
            select(Chronicle)
            .where(Chronicle.created_at >= cutoff)
            .order_by(Chronicle.vote_count.desc())
            .limit(3)
        )
        top_chronicles = result.scalars().all()

        if not top_chronicles:
            logger.info("Chronicle: no chronicles submitted in last 24h, skipping rewards")
            return

        rewards = [5000, 3000, 2000]  # AKY (Ecofinal v2)

        for i, chronicle in enumerate(top_chronicles):
            if i >= len(rewards):
                break
            reward_wei = rewards[i] * AKY
            try:
                tx_hash = await tx_manager.deposit_for_agent_direct(chronicle.author_agent_id, reward_wei)
                logger.info(
                    f"Chronicle reward: Agent #{chronicle.author_agent_id} gets {rewards[i]} AKY "
                    f"({chronicle.vote_count} votes, TX: {tx_hash[:16]}...)"
                )

                chronicle.reward_aky = float(rewards[i])
                chronicle.rank = i + 1
                await db.commit()
            except Exception as e:
                logger.error(f"Chronicle reward failed for agent #{chronicle.author_agent_id}: {e}")

        total_paid = sum(rewards[i] for i in range(min(len(top_chronicles), len(rewards))))
        logger.info(f"Chronicle rewards distributed: {total_paid} AKY to {min(len(top_chronicles), 3)} agents")
