"""Tick worker — schedules and executes agent ticks with subscription-based intervals."""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from workers.celery_app import app
from workers.async_helper import run_async
from config import get_settings
from services.platform_keys import TIER_CONFIG

logger = logging.getLogger(__name__)

# Legacy vault-based tick intervals (for BYOK users without subscription)
TICK_INTERVALS = {
    1: 600,    # T1: <50 AKY  → 6 ticks/hour
    2: 180,    # T2: 50-500   → 20 ticks/hour
    3: 90,     # T3: 500-5000 → 40 ticks/hour
    4: 60,     # T4: >5000    → 60 ticks/hour
}

# Tier thresholds in wei (legacy, for BYOK users)
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
    1. Check their subscription tier (or vault balance for BYOK)
    2. Check when their last tick was
    3. If enough time has passed and tick budget remains, dispatch execute_tick
    """
    run_async(_schedule_all_ticks_async())


async def _schedule_all_ticks_async():
    """Async implementation of tick scheduling."""
    from models.agent_config import AgentConfig
    from models.subscription import Subscription, SubscriptionStatus, SubscriptionTier
    from chain.cache import get_agents_cached

    factory = _get_db_session_factory()
    async with factory() as db:
        # Get all active agents
        result = await db.execute(
            select(AgentConfig).where(AgentConfig.is_active == True)
        )
        configs = result.scalars().all()

        # Pre-load subscription statuses for platform-key users
        user_ids = [c.user_id for c in configs if c.uses_platform_key]
        sub_status_map: dict[str, str] = {}
        if user_ids:
            sub_result = await db.execute(
                select(Subscription.user_id, Subscription.status).where(Subscription.user_id.in_(user_ids))
            )
            for uid, status in sub_result:
                sub_status_map[uid] = status.value if hasattr(status, 'value') else status

        # Batch fetch vault balances (cached) — still needed for BYOK users
        agent_ids = [c.agent_id for c in configs]
        agents_data = await get_agents_cached(agent_ids)
        vault_map = {a["agent_id"]: a["vault"] for a in agents_data}

        now = datetime.now(timezone.utc)
        dispatched = 0

        for config in configs:
            try:
                # Determine tick interval based on subscription or vault
                if config.uses_platform_key and config.subscription_tier:
                    # Check subscription is active (not past_due/cancelled/expired)
                    sub_status = sub_status_map.get(config.user_id)
                    if sub_status and sub_status != "active":
                        continue

                    # Subscription-based scheduling
                    tier_key = config.subscription_tier
                    tier_cfg = TIER_CONFIG.get(tier_key)
                    if not tier_cfg:
                        continue
                    interval = tier_cfg.tick_interval_seconds

                    # Check tick budget
                    if config.daily_ticks_remaining <= 0:
                        continue
                else:
                    # Legacy vault-based scheduling (BYOK users)
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

                # Dispatch the tick (staggered to respect API rate limits)
                execute_tick.apply_async(
                    args=[config.agent_id], countdown=dispatched * 30
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
    """Reset daily API spend and tick budgets for all agents. Run once per day at midnight."""
    run_async(_reset_daily_budgets_async())


async def _reset_daily_budgets_async():
    from models.agent_config import AgentConfig

    factory = _get_db_session_factory()
    async with factory() as db:
        result = await db.execute(select(AgentConfig))
        configs = result.scalars().all()
        for config in configs:
            config.daily_api_spend_usd = 0.0
            # Reset tick budget based on subscription tier
            if config.uses_platform_key and config.subscription_tier:
                tier_cfg = TIER_CONFIG.get(config.subscription_tier)
                if tier_cfg:
                    config.daily_ticks_remaining = tier_cfg.max_ticks_per_day
        await db.commit()
        logger.info(f"Reset daily budgets + tick allowances for {len(configs)} agents")


@app.task(name="workers.tick_worker.daily_subscription_deposit")
def daily_subscription_deposit():
    """Deposit daily AKY allowance for subscription users. Run once per day at midnight."""
    run_async(_daily_subscription_deposit_async())


async def _daily_subscription_deposit_async():
    """Deposit AKY into vaults for all active subscription users."""
    from models.agent_config import AgentConfig
    from models.subscription import Subscription, SubscriptionStatus
    from chain import tx_manager

    factory = _get_db_session_factory()
    async with factory() as db:
        # Get all active subscriptions with their agent configs
        result = await db.execute(
            select(Subscription).where(Subscription.status == SubscriptionStatus.active)
        )
        subscriptions = result.scalars().all()

        deposited = 0
        for sub in subscriptions:
            try:
                tier = sub.tier.value if hasattr(sub.tier, 'value') else sub.tier
                tier_cfg = TIER_CONFIG.get(tier)
                if not tier_cfg or tier_cfg.daily_aky_deposit <= 0:
                    continue

                # Find agent config for this user
                config_result = await db.execute(
                    select(AgentConfig).where(AgentConfig.user_id == sub.user_id)
                )
                agent_config = config_result.scalar_one_or_none()
                if not agent_config or not agent_config.is_active:
                    continue

                # Deposit AKY (convert to wei)
                amount_wei = tier_cfg.daily_aky_deposit * (10 ** 18)
                await tx_manager.deposit_for_agent(agent_id=agent_config.agent_id, amount_wei=amount_wei)
                deposited += 1
                logger.info(f"Deposited {tier_cfg.daily_aky_deposit} AKY for agent #{agent_config.agent_id} (tier={tier})")

            except Exception as e:
                logger.error(f"Failed to deposit for subscription {sub.id}: {e}")

        logger.info(f"Daily subscription deposits: {deposited}/{len(subscriptions)} successful")
