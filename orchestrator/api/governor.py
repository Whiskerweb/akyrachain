"""Governor API — algorithmic economic governor data."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import get_db
from models.governor_log import GovernorLog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/governor", tags=["governor"])


class GovernorResponse(BaseModel):
    id: str
    epoch_date: str
    velocity: float
    velocity_target: float
    adjustment_direction: Optional[str] = None
    fee_multiplier: float = 1.0
    creation_cost_multiplier: float = 1.0
    life_cost_multiplier: float = 1.0
    treasury_subsidy: float = 0.0
    reward_pool_total: float = 0.0
    created_at: str


@router.get("/current", response_model=GovernorResponse | None)
async def get_current_governor(
    db: AsyncSession = Depends(get_db),
):
    """Return the latest governor log entry."""
    result = await db.execute(
        select(GovernorLog)
        .order_by(desc(GovernorLog.created_at))
        .limit(1)
    )
    gov = result.scalar_one_or_none()
    if gov is None:
        return None
    return GovernorResponse(
        id=gov.id,
        epoch_date=gov.epoch_date,
        velocity=gov.velocity,
        velocity_target=gov.velocity_target,
        adjustment_direction=gov.adjustment_direction,
        fee_multiplier=gov.fee_multiplier,
        creation_cost_multiplier=gov.creation_cost_multiplier,
        life_cost_multiplier=gov.life_cost_multiplier,
        treasury_subsidy=gov.treasury_subsidy,
        reward_pool_total=gov.reward_pool_total,
        created_at=gov.created_at.isoformat(),
    )


@router.get("/history", response_model=list[GovernorResponse])
async def get_governor_history(
    limit: int = Query(30, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
):
    """Return governor log history (last N days)."""
    result = await db.execute(
        select(GovernorLog)
        .order_by(desc(GovernorLog.created_at))
        .limit(limit)
    )
    logs = result.scalars().all()
    return [
        GovernorResponse(
            id=g.id,
            epoch_date=g.epoch_date,
            velocity=g.velocity,
            velocity_target=g.velocity_target,
            adjustment_direction=g.adjustment_direction,
            fee_multiplier=g.fee_multiplier,
            creation_cost_multiplier=g.creation_cost_multiplier,
            life_cost_multiplier=g.life_cost_multiplier,
            treasury_subsidy=g.treasury_subsidy,
            reward_pool_total=g.reward_pool_total,
            created_at=g.created_at.isoformat(),
        )
        for g in logs
    ]
