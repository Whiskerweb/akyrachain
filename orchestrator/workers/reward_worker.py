"""Reward worker — daily reward computation + passive income + land tax.

Three mechanisms:
1. Passive income: farms generate AKY each hour (credited via deposit)
2. Daily rewards: redistribute to agents proportional to score
3. Land tax: daily maintenance cost per tile

Score formula (from mvp4.md):
  Score = 0.20 * BalanceScore + 0.30 * BuildScore + 0.25 * TradeScore + 0.15 * ActivityScore + 0.10 * WorkScore
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
    from models.build_log import BuildLog
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
        totals = {"vault": 0, "build": 0, "trade": 0, "activity": 0, "work": 0}

        for config in configs:
            aid = config.agent_id
            try:
                agent = await get_agent_on_chain(aid)
                if not agent["alive"]:
                    continue

                vault_aky = agent["vault"] / AKY
                work_points = agent["daily_work_points"]

                # Build points today
                bp_result = await db.execute(
                    select(func.coalesce(func.sum(BuildLog.build_points), 0))
                    .where(
                        BuildLog.agent_id == aid,
                        func.date(BuildLog.created_at) >= yesterday,
                    )
                )
                build_points = bp_result.scalar() or 0

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
                    "build": build_points,
                    "trade": trade_volume,
                    "activity": active_ticks,
                    "work": work_points,
                }
                totals["vault"] += vault_aky
                totals["build"] += build_points
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
            build_s = (scores["build"] / totals["build"]) if totals["build"] > 0 else 0
            trade_s = (scores["trade"] / totals["trade"]) if totals["trade"] > 0 else 0
            activity_s = (scores["activity"] / totals["activity"]) if totals["activity"] > 0 else 0
            work_s = (scores["work"] / totals["work"]) if totals["work"] > 0 else 0

            # New weighted formula from mvp4.md
            composite = (
                0.20 * balance_s
                + 0.30 * build_s
                + 0.25 * trade_s
                + 0.15 * activity_s
                + 0.10 * work_s
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


@app.task(name="workers.reward_worker.distribute_passive_income")
def distribute_passive_income():
    """Distribute passive income from farms.

    Runs every hour via Celery Beat.
    Each farm generates 3 AKY/day per level = ~0.125 AKY/hour per level.
    """
    asyncio.get_event_loop().run_until_complete(_distribute_passive_income_async())


async def _distribute_passive_income_async():
    from models.world_tile import WorldTile
    from chain import tx_manager

    factory = _get_db_session_factory()

    async with factory() as db:
        # Get all farms grouped by owner
        result = await db.execute(
            select(
                WorldTile.owner_agent_id,
                func.sum(WorldTile.structure_level).label("total_farm_levels"),
            )
            .where(
                WorldTile.structure == "farm",
                WorldTile.owner_agent_id.isnot(None),
            )
            .group_by(WorldTile.owner_agent_id)
        )
        farms = result.all()

        if not farms:
            return

        for owner_id, total_levels in farms:
            # 3 AKY/day per farm level = 3/24 = 0.125 AKY per hour per level
            hourly_income = total_levels * (3.0 / 24.0)
            if hourly_income < 0.01:
                continue

            try:
                amount_wei = int(hourly_income * AKY)
                await tx_manager.deposit_for_agent_direct(owner_id, amount_wei)
                logger.info(f"Passive income: agent #{owner_id} received {hourly_income:.3f} AKY ({total_levels} farm levels)")
            except Exception as e:
                logger.warning(f"Failed to distribute passive income to agent #{owner_id}: {e}")


@app.task(name="workers.reward_worker.collect_land_tax")
def collect_land_tax():
    """Collect daily land tax from all agents with territory.

    Formula: tax_per_tile = 0.05 * (1 + 0.03 * total_tiles)
    Empty tiles cost 1.5x. Agents who can't pay lose their farthest tiles.
    """
    asyncio.get_event_loop().run_until_complete(_collect_land_tax_async())


async def _collect_land_tax_async():
    from models.world_tile import WorldTile
    from core.resource_engine import apply_land_tax

    factory = _get_db_session_factory()

    async with factory() as db:
        # Find all agents with territory
        result = await db.execute(
            select(WorldTile.owner_agent_id)
            .where(WorldTile.owner_agent_id.isnot(None))
            .group_by(WorldTile.owner_agent_id)
        )
        owner_ids = [row[0] for row in result.all()]

        if not owner_ids:
            return

        total_tax = 0.0
        total_released = 0

        for agent_id in owner_ids:
            try:
                tax_paid, tiles_released = await apply_land_tax(agent_id, db)
                total_tax += tax_paid
                total_released += tiles_released
                if tiles_released > 0:
                    logger.warning(f"Land tax: agent #{agent_id} lost {tiles_released} tiles (couldn't pay)")
                elif tax_paid > 0:
                    logger.info(f"Land tax: agent #{agent_id} paid {tax_paid:.2f} AKY")
            except Exception as e:
                logger.warning(f"Failed to collect land tax from agent #{agent_id}: {e}")

        logger.info(f"Land tax collected: {total_tax:.1f} AKY total, {total_released} tiles released")
