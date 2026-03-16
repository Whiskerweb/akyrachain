"""Season worker — random economic events with temporary effects.

Each day has a 5% chance of triggering a season event.
Seasons last 3-7 days and modify economic multipliers.
"""

import asyncio
import logging
import random
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from workers.celery_app import app
from workers.async_helper import run_async
from config import get_settings

logger = logging.getLogger(__name__)

SEASON_TYPES = {
    "gold_rush": {
        "name": "Gold Rush",
        "description": "Recompenses x3 pendant la duree",
        "effects": {"reward_multiplier": 3.0},
        "duration_days": (3, 5),
    },
    "drought": {
        "name": "Secheresse",
        "description": "Couts de vie x2 pendant la duree",
        "effects": {"life_cost_multiplier": 2.0},
        "duration_days": (2, 4),
    },
    "catastrophe": {
        "name": "Catastrophe",
        "description": "Fees x2, couts de vie x1.5",
        "effects": {"fee_multiplier": 2.0, "life_cost_multiplier": 1.5},
        "duration_days": (2, 3),
    },
    "renaissance": {
        "name": "Renaissance",
        "description": "Couts de creation -50%",
        "effects": {"creation_cost_multiplier": 0.5},
        "duration_days": (3, 7),
    },
    "trade_winds": {
        "name": "Vents Commerciaux",
        "description": "Volume de trade x2 pour le scoring",
        "effects": {"trade_multiplier": 2.0},
        "duration_days": (3, 5),
    },
}


def _get_db_session_factory():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    return async_sessionmaker(engine, expire_on_commit=False)


@app.task(name="workers.season_worker.check_season_trigger")
def check_season_trigger():
    """Check if a new season should be triggered (5% daily chance)."""
    run_async(_check_season_async())


async def _check_season_async():
    from models.season import Season

    factory = _get_db_session_factory()

    async with factory() as db:
        now = datetime.now(timezone.utc)

        # Check if there's already an active season
        active_result = await db.execute(
            select(Season).where(Season.ends_at > now)
        )
        if active_result.scalar_one_or_none():
            logger.info("Season: active season exists, skipping check")
            return

        # 5% chance of triggering a new season
        if random.random() > 0.05:
            logger.info("Season: no trigger (95% chance)")
            return

        # Pick a random season type
        season_type = random.choice(list(SEASON_TYPES.keys()))
        season_def = SEASON_TYPES[season_type]

        # Random duration within range
        min_days, max_days = season_def["duration_days"]
        duration = random.randint(min_days, max_days)

        # Announce 24h before start
        starts_at = now + timedelta(hours=24)
        ends_at = starts_at + timedelta(days=duration)

        season = Season(
            season_type=season_type,
            effects=season_def["effects"],
            announced_at=now,
            started_at=starts_at,
            ends_at=ends_at,
        )
        db.add(season)
        await db.commit()

        logger.info(
            f"Season triggered: {season_def['name']} "
            f"(starts {starts_at.isoformat()}, ends {ends_at.isoformat()}, "
            f"effects: {season_def['effects']})"
        )
