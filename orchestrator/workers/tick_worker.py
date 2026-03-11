"""Tick worker — schedules and executes agent ticks with tier-based intervals."""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from workers.celery_app import app
from config import get_settings

logger = logging.getLogger(__name__)

# Tick intervals by tier (seconds)
TICK_INTERVALS = {
    1: 3600,   # T1: <50 AKY  → 1 tick/hour
    2: 900,    # T2: 50-500   → 4 ticks/hour
    3: 300,    # T3: 500-5000 → 12 ticks/hour
    4: 120,    # T4: >5000    → 30 ticks/hour
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


def _get_db_session_factory():
    """Create an async session factory for worker use."""
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    return async_sessionmaker(engine, expire_on_commit=False)


@app.task(name="workers.tick_worker.schedule_all_ticks")
def schedule_all_ticks():
    """Check all active agents and dispatch ticks for those that are due.

    Runs every 60s via Celery Beat. For each active agent:
    1. Check their tier (based on vault balance)
    2. Check when their last tick was
    3. If enough time has passed, dispatch execute_tick
    """
    asyncio.get_event_loop().run_until_complete(_schedule_all_ticks_async())


async def _schedule_all_ticks_async():
    """Async implementation of tick scheduling."""
    from models.agent_config import AgentConfig
    from chain.contracts import get_agent_vault

    factory = _get_db_session_factory()
    async with factory() as db:
        # Get all active agents
        result = await db.execute(
            select(AgentConfig).where(AgentConfig.is_active == True)
        )
        configs = result.scalars().all()

        now = datetime.now(timezone.utc)
        dispatched = 0

        for config in configs:
            try:
                # Get vault balance to determine tier
                vault_wei = await get_agent_vault(config.agent_id)
                tier = _vault_to_tier(vault_wei)
                interval = TICK_INTERVALS[tier]

                # Check if enough time has passed since last tick
                if config.last_tick_at:
                    elapsed = (now - config.last_tick_at.replace(tzinfo=timezone.utc)).total_seconds()
                    if elapsed < interval:
                        continue

                # Dispatch the tick
                execute_tick.delay(config.agent_id)
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
        result = asyncio.get_event_loop().run_until_complete(
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
    asyncio.get_event_loop().run_until_complete(_reset_daily_budgets_async())


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
