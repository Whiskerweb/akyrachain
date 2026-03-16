"""Governance API — governor votes, death trials, economic status."""

from __future__ import annotations

import logging
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import get_db
from models.governor_log import GovernorLog
from models.governor_vote import GovernorVote
from models.death_trial import DeathTrial

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/governance", tags=["governance"])


@router.get("/status")
async def governance_status(db: AsyncSession = Depends(get_db)):
    """Current governance state: multipliers, votes, trials."""

    # 1. Current multipliers from latest governor log
    gov_result = await db.execute(
        select(GovernorLog).order_by(desc(GovernorLog.created_at)).limit(1)
    )
    gov = gov_result.scalar_one_or_none()

    multipliers = {
        "fee_multiplier": gov.fee_multiplier if gov else 1.0,
        "creation_cost_multiplier": gov.creation_cost_multiplier if gov else 1.0,
        "life_cost_multiplier": gov.life_cost_multiplier if gov else 1.0,
    }

    # 2. Today's votes
    today_str = date.today().isoformat()
    votes_result = await db.execute(
        select(GovernorVote).where(GovernorVote.epoch_date == today_str)
    )
    votes = votes_result.scalars().all()

    tally: dict[str, dict[str, int]] = {}
    for v in votes:
        if v.param not in tally:
            tally[v.param] = {"up": 0, "down": 0, "stable": 0}
        if v.direction in tally[v.param]:
            tally[v.param][v.direction] += 1

    # 3. Alive agent count (from agent configs)
    from models.agent_config import AgentConfig
    from sqlalchemy import func
    alive_result = await db.execute(
        select(func.count(AgentConfig.id)).where(AgentConfig.is_active == True)
    )
    alive_count = alive_result.scalar() or 0

    # 4. Pending death trials
    trials_result = await db.execute(
        select(DeathTrial).where(DeathTrial.status == "pending").order_by(desc(DeathTrial.created_at))
    )
    trials = trials_result.scalars().all()

    return {
        "current_multipliers": multipliers,
        "votes_today": tally,
        "alive_count": alive_count,
        "pending_trials": [
            {
                "id": t.id,
                "target_agent_id": t.target_agent_id,
                "reason": t.reason,
                "votes_survive": t.votes_survive,
                "votes_condemn": t.votes_condemn,
                "juror_ids": t.juror_ids,
                "created_at": t.created_at.isoformat(),
            }
            for t in trials
        ],
    }
