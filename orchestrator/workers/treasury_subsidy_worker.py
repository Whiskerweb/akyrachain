"""Treasury subsidy worker — daily AKY injection into RewardPool.

Formula: subsidy = treasury_daily_base × (treasury_decay_rate ^ days_since_launch)
Default: 50,000 × (0.997 ^ days_since_launch) AKY per day.
"""

import asyncio
import logging
from datetime import datetime, timezone

from workers.celery_app import app
from workers.async_helper import run_async
from config import get_settings

logger = logging.getLogger(__name__)

AKY = 10**18


@app.task(name="workers.treasury_subsidy_worker.inject_treasury_subsidy")
def inject_treasury_subsidy():
    """Inject daily treasury subsidy into the RewardPool."""
    run_async(_inject_subsidy_async())


async def _inject_subsidy_async():
    from chain import tx_manager

    settings = get_settings()

    # Calculate days since launch
    launch = datetime.fromisoformat(settings.launch_date).replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    days_since_launch = (now - launch).days

    # Exponentially decaying subsidy
    subsidy_aky = settings.treasury_daily_base * (settings.treasury_decay_rate ** days_since_launch)

    if subsidy_aky < 1.0:
        logger.info(f"Treasury subsidy too small ({subsidy_aky:.4f} AKY), skipping")
        return

    subsidy_wei = int(subsidy_aky * AKY)

    try:
        tx_hash = await tx_manager.fund_reward_pool(subsidy_wei)
        logger.info(
            f"Treasury subsidy: {subsidy_aky:.1f} AKY injected into RewardPool "
            f"(day {days_since_launch}, TX: {tx_hash[:16]}...)"
        )
    except Exception as e:
        logger.error(f"Failed to inject treasury subsidy: {e}")
