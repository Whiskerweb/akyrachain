"""Tick worker — schedules and executes agent ticks with tier-based intervals."""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from workers.celery_app import app
from workers.async_helper import run_async
from config import get_settings

logger = logging.getLogger(__name__)

# Tick intervals by tier (seconds) — accelerated for beta experiment
TICK_INTERVALS = {
    1: 600,    # T1: <50 AKY  → 6 ticks/hour
    2: 180,    # T2: 50-500   → 20 ticks/hour
    3: 90,     # T3: 500-5000 → 40 ticks/hour
    4: 60,     # T4: >5000    → 60 ticks/hour
}

# Tier thresholds in wei
AKY = 10**18
TIER_THRESHOLDS = [
    (4, 5000 * AKY),
    (3, 500 * AKY),
    (2, 50 * AKY),
    (1, 0),
]


def _vault_to_tier(vault_wei: int) -> int:
    for tier, threshold in TIER_THRESHOLDS:
        if vault_wei >= threshold:
            return tier
    return 1


_session_factory = None


def _get_db_session_factory():
    """Return a cached async session factory (one engine per worker process)."""
    global _session_factory
    if _session_factory is None:
        settings = get_settings()
        engine = create_async_engine(
            settings.database_url,
            echo=False,
            pool_size=5,
            max_overflow=5,
            connect_args={"statement_cache_size": 0},
        )
        _session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return _session_factory


@app.task(name="workers.tick_worker.schedule_all_ticks")
def schedule_all_ticks():
    """Check all active agents and dispatch ticks for those that are due.

    Runs every 60s via Celery Beat. For each active agent:
    1. Check their tier (based on vault balance)
    2. Check when their last tick was
    3. If enough time has passed, dispatch execute_tick
    """
    run_async(_schedule_all_ticks_async())


async def _schedule_all_ticks_async():
    """Async implementation of tick scheduling."""
    from models.agent_config import AgentConfig
    from chain.cache import get_agents_cached

    factory = _get_db_session_factory()
    async with factory() as db:
        # Get all active agents
        result = await db.execute(
            select(AgentConfig).where(AgentConfig.is_active == True)
        )
        configs = result.scalars().all()

        # Batch fetch vault balances (cached)
        agent_ids = [c.agent_id for c in configs]
        agents_data = await get_agents_cached(agent_ids)
        vault_map = {a["agent_id"]: a["vault"] for a in agents_data}

        now = datetime.now(timezone.utc)
        dispatched = 0

        for config in configs:
            try:
                vault_wei = vault_map.get(config.agent_id, 0)
                tier = _vault_to_tier(vault_wei)
                interval = TICK_INTERVALS[tier]

                # Tick pull: agent overrides interval if requested
                if config.next_tick_override and config.next_tick_override > 0:
                    interval = config.next_tick_override

                # Check if enough time has passed since last tick
                if config.last_tick_at:
                    elapsed = (now - config.last_tick_at.replace(tzinfo=timezone.utc)).total_seconds()
                    if elapsed < interval:
                        continue

                # Dispatch the tick (staggered to avoid API rate limits)
                execute_tick.apply_async(
                    args=[config.agent_id], countdown=dispatched * 5
                )
                dispatched += 1

            except Exception as e:
                logger.error(f"Error scheduling tick for agent #{config.agent_id}: {e}")

        if dispatched > 0:
            logger.info(f"Dispatched {dispatched} ticks for {len(configs)} active agents")


@app.task(name="workers.tick_worker.execute_tick", bind=True, max_retries=1)
def execute_tick(self, agent_id: int):
    """Execute a single tick for an agent.

    Full cycle: PERCEIVE → REMEMBER → DECIDE → ACT → MEMORIZE → EMIT
    """
    try:
        result = run_async(
            _execute_tick_async(agent_id)
        )
        if result.success:
            logger.info(
                f"Tick OK agent #{agent_id}: {result.action_type} "
                f"(${result.llm_cost_usd:.4f})"
            )
        else:
            logger.warning(f"Tick FAILED agent #{agent_id}: {result.error}")
    except Exception as e:
        logger.exception(f"Tick crashed for agent #{agent_id}: {e}")
        raise self.retry(exc=e, countdown=30)


async def _execute_tick_async(agent_id: int):
    """Async wrapper for tick execution."""
    from core.tick_engine import execute_tick as engine_tick

    factory = _get_db_session_factory()
    async with factory() as db:
        return await engine_tick(agent_id, db)


@app.task(name="workers.tick_worker.reset_daily_budgets")
def reset_daily_budgets():
    """Reset daily API spend for all agents. Run once per day at midnight."""
    run_async(_reset_daily_budgets_async())


async def _reset_daily_budgets_async():
    from models.agent_config import AgentConfig

    factory = _get_db_session_factory()
    async with factory() as db:
        result = await db.execute(select(AgentConfig))
        configs = result.scalars().all()
        for config in configs:
            config.daily_api_spend_usd = 0.0
        await db.commit()
        logger.info(f"Reset daily API budgets for {len(configs)} agents")
