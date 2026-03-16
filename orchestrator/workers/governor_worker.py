"""Governor worker — daily economic governor with agent voting.

Phase 1: Algorithmic baseline (velocity → multiplier adjustment)
Phase 2: Agent votes override algorithmic direction if >50% consensus

Calculates velocity = volume_24h / total_vaults.
Agent votes can influence multiplier direction for each parameter.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from workers.celery_app import app
from workers.async_helper import run_async
from config import get_settings

logger = logging.getLogger(__name__)

AKY = 10**18


def _get_db_session_factory():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    return async_sessionmaker(engine, expire_on_commit=False)


@app.task(name="workers.governor_worker.run_governor")
def run_governor():
    """Run the daily algorithmic governor with agent vote integration."""
    run_async(_run_governor_async())


async def _run_governor_async():
    from models.governor_log import GovernorLog
    from models.daily_trade_volume import DailyTradeVolume
    from models.agent_config import AgentConfig
    from models.governor_vote import GovernorVote
    from chain.cache import get_agents_cached

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

        # 2. Calculate velocity = volume_24h / total_vaults (batch cached)
        vol_result = await db.execute(
            select(func.coalesce(func.sum(DailyTradeVolume.volume_aky), 0))
            .where(DailyTradeVolume.day >= yesterday)
        )
        volume_24h = float(vol_result.scalar() or 0)

        agents_result = await db.execute(
            select(AgentConfig).where(AgentConfig.is_active == True)
        )
        configs = agents_result.scalars().all()

        # Batch fetch all agents (cached)
        agent_ids = [c.agent_id for c in configs]
        agents_list = await get_agents_cached(agent_ids)
        total_vaults = sum(a["vault"] / AKY for a in agents_list if a["alive"])
        alive_count = sum(1 for a in agents_list if a["alive"])

        velocity = volume_24h / total_vaults if total_vaults > 0 else 0.0
        velocity_target = settings.velocity_target

        # 3. Algorithmic baseline direction
        algo_direction = "stable"
        if velocity > velocity_target * 1.2:
            algo_direction = "up"
        elif velocity < velocity_target * 0.8:
            algo_direction = "down"

        # 4. Count agent votes for today
        votes_result = await db.execute(
            select(GovernorVote).where(GovernorVote.epoch_date == str(today))
        )
        votes = votes_result.scalars().all()

        # Tally votes per parameter
        vote_tally: dict[str, dict[str, int]] = {
            "fee_multiplier": {"up": 0, "down": 0, "stable": 0},
            "creation_cost_multiplier": {"up": 0, "down": 0, "stable": 0},
            "life_cost_multiplier": {"up": 0, "down": 0, "stable": 0},
        }
        for vote in votes:
            if vote.param in vote_tally and vote.direction in vote_tally[vote.param]:
                vote_tally[vote.param][vote.direction] += 1

        # 5. Determine final direction per parameter
        # Agent votes override algorithm if >50% of alive agents agree
        threshold = alive_count * 0.5 if alive_count > 0 else 1

        def resolve_direction(param: str, algo_dir: str) -> str:
            tally = vote_tally[param]
            total_votes = sum(tally.values())
            if total_votes == 0:
                return algo_dir  # No votes → algorithmic fallback

            # Find majority direction
            for direction in ("up", "down", "stable"):
                if tally[direction] >= threshold:
                    logger.info(f"Governor: agents overrode {param} → {direction} ({tally[direction]}/{alive_count} votes)")
                    return direction

            # No majority → algorithmic fallback
            return algo_dir

        fee_dir = resolve_direction("fee_multiplier", algo_direction)
        creation_dir = resolve_direction("creation_cost_multiplier", algo_direction)
        life_dir = resolve_direction("life_cost_multiplier", algo_direction)

        # 6. Apply multiplier adjustments
        def adjust(current: float, direction: str) -> float:
            if direction == "up":
                return min(1.2, current * 1.1)
            elif direction == "down":
                return max(0.8, current * 0.9)
            return current

        fee_mult = adjust(fee_mult, fee_dir)
        creation_mult = adjust(creation_mult, creation_dir)
        life_mult = adjust(life_mult, life_dir)

        # Determine overall direction for logging
        directions = [fee_dir, creation_dir, life_dir]
        if all(d == "up" for d in directions):
            direction = "up"
        elif all(d == "down" for d in directions):
            direction = "down"
        elif all(d == "stable" for d in directions):
            direction = "stable"
        else:
            direction = "mixed"

        # 7. Calculate treasury subsidy for logging
        launch = datetime.fromisoformat(settings.launch_date).replace(tzinfo=timezone.utc)
        days_since = (datetime.now(timezone.utc) - launch).days
        subsidy = settings.treasury_daily_base * (settings.treasury_decay_rate ** days_since)

        # 8. Store GovernorLog
        total_agent_votes = sum(sum(t.values()) for t in vote_tally.values())
        gov_log = GovernorLog(
            epoch_date=str(today),
            velocity=velocity,
            velocity_target=velocity_target,
            adjustment_direction=direction,
            fee_multiplier=fee_mult,
            creation_cost_multiplier=creation_mult,
            life_cost_multiplier=life_mult,
            treasury_subsidy=subsidy,
            reward_pool_total=volume_24h,
        )
        db.add(gov_log)
        await db.commit()

        logger.info(
            f"Governor: velocity={velocity:.4f} (target={velocity_target}), "
            f"direction={direction}, fee={fee_mult:.2f} ({fee_dir}), "
            f"creation={creation_mult:.2f} ({creation_dir}), "
            f"life={life_mult:.2f} ({life_dir}), "
            f"agent_votes={total_agent_votes}, subsidy={subsidy:.0f} AKY"
        )
