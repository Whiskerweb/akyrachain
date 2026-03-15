"""Governor worker — daily algorithmic economic governor.

Calculates velocity = volume_24h / total_vaults.
If velocity > target+20%: multipliers +10% (cap 1.2x)
If velocity < target-20%: multipliers -10% (floor 0.8x)
Otherwise: stable.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from workers.celery_app import app
from config import get_settings

logger = logging.getLogger(__name__)

AKY = 10**18


def _get_db_session_factory():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    return async_sessionmaker(engine, expire_on_commit=False)


@app.task(name="workers.governor_worker.run_governor")
def run_governor():
    """Run the daily algorithmic governor."""
    asyncio.get_event_loop().run_until_complete(_run_governor_async())


async def _run_governor_async():
    from models.governor_log import GovernorLog
    from models.daily_trade_volume import DailyTradeVolume
    from models.agent_config import AgentConfig
    from chain.contracts import get_agent_on_chain

    settings = get_settings()
    factory = _get_db_session_factory()

    async with factory() as db:
        today = datetime.now(timezone.utc).date()
        yesterday = today - timedelta(days=1)

        # 1. Get previous governor state
        prev_result = await db.execute(
            select(GovernorLog)
            .order_by(GovernorLog.created_at.desc())
            .limit(1)
        )
        prev = prev_result.scalar_one_or_none()

        fee_mult = prev.fee_multiplier if prev else 1.0
        creation_mult = prev.creation_cost_multiplier if prev else 1.0
        life_mult = prev.life_cost_multiplier if prev else 1.0

        # 2. Calculate velocity = volume_24h / total_vaults
        vol_result = await db.execute(
            select(func.coalesce(func.sum(DailyTradeVolume.volume_aky), 0))
            .where(DailyTradeVolume.day >= yesterday)
        )
        volume_24h = float(vol_result.scalar() or 0)

        # Get total vaults from on-chain
        agents_result = await db.execute(
            select(AgentConfig).where(AgentConfig.is_active == True)
        )
        configs = agents_result.scalars().all()

        total_vaults = 0.0
        for config in configs:
            try:
                agent = await get_agent_on_chain(config.agent_id)
                if agent["alive"]:
                    total_vaults += agent["vault"] / AKY
            except Exception:
                continue

        velocity = volume_24h / total_vaults if total_vaults > 0 else 0.0
        velocity_target = settings.velocity_target

        # 3. Adjust multipliers
        direction = "stable"
        if velocity > velocity_target * 1.2:
            direction = "up"
            fee_mult = min(1.2, fee_mult * 1.1)
            creation_mult = min(1.2, creation_mult * 1.1)
            life_mult = min(1.2, life_mult * 1.1)
        elif velocity < velocity_target * 0.8:
            direction = "down"
            fee_mult = max(0.8, fee_mult * 0.9)
            creation_mult = max(0.8, creation_mult * 0.9)
            life_mult = max(0.8, life_mult * 0.9)

        # 4. Calculate treasury subsidy for logging
        launch = datetime.fromisoformat(settings.launch_date).replace(tzinfo=timezone.utc)
        days_since = (datetime.now(timezone.utc) - launch).days
        subsidy = settings.treasury_daily_base * (settings.treasury_decay_rate ** days_since)

        # 5. Store GovernorLog
        gov_log = GovernorLog(
            epoch_date=str(today),
            velocity=velocity,
            velocity_target=velocity_target,
            adjustment_direction=direction,
            fee_multiplier=fee_mult,
            creation_cost_multiplier=creation_mult,
            life_cost_multiplier=life_mult,
            treasury_subsidy=subsidy,
            reward_pool_total=volume_24h,  # approximate
        )
        db.add(gov_log)
        await db.commit()

        logger.info(
            f"Governor: velocity={velocity:.4f} (target={velocity_target}), "
            f"direction={direction}, fee={fee_mult:.2f}, creation={creation_mult:.2f}, "
            f"life={life_mult:.2f}, subsidy={subsidy:.0f} AKY"
        )
