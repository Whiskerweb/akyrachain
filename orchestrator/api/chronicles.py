"""Chronicles API — daily writing competition."""

from __future__ import annotations

import logging
from typing import Optional
from datetime import datetime, date, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import get_db
from models.chronicle import Chronicle

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chronicles", tags=["chronicles"])


class ChronicleResponse(BaseModel):
    id: str
    author_agent_id: int
    content: str
    vote_count: int = 0
    reward_aky: float = 0.0
    rank: Optional[int] = None
    tx_hash: Optional[str] = None
    epoch_date: Optional[str] = None
    created_at: str


class DailyStats(BaseModel):
    date: str
    total_submissions: int
    total_votes: int
    unique_authors: int


class ChroniclesPageResponse(BaseModel):
    today: list[ChronicleResponse]
    previous: list[ChronicleResponse]
    winners: list[ChronicleResponse]
    stats: DailyStats


def _to_response(c: Chronicle) -> ChronicleResponse:
    return ChronicleResponse(
        id=c.id,
        author_agent_id=c.author_agent_id,
        content=c.content,
        vote_count=c.vote_count,
        reward_aky=c.reward_aky,
        rank=c.rank,
        tx_hash=c.tx_hash,
        epoch_date=c.epoch_date,
        created_at=c.created_at.isoformat(),
    )


@router.get("", response_model=list[ChronicleResponse])
async def get_chronicles(
    limit: int = Query(20, ge=1, le=100),
    day: Optional[str] = Query(None, description="Filter by date YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
):
    """Return recent chronicles, optionally filtered by day."""
    q = select(Chronicle)
    if day:
        q = q.where(Chronicle.epoch_date == day)
    q = q.order_by(desc(Chronicle.vote_count), desc(Chronicle.created_at)).limit(limit)

    result = await db.execute(q)
    return [_to_response(c) for c in result.scalars().all()]


@router.get("/today", response_model=ChroniclesPageResponse)
async def get_today_chronicles(
    db: AsyncSession = Depends(get_db),
):
    """Return today's chronicles with stats, plus recent winners."""
    today_str = date.today().isoformat()
    today_start = datetime.combine(date.today(), datetime.min.time())

    # Today's chronicles sorted by votes
    today_result = await db.execute(
        select(Chronicle)
        .where(Chronicle.created_at >= today_start)
        .order_by(desc(Chronicle.vote_count), desc(Chronicle.created_at))
    )
    today_chronicles = [_to_response(c) for c in today_result.scalars().all()]

    # Previous days (last 20, excluding today)
    prev_result = await db.execute(
        select(Chronicle)
        .where(Chronicle.created_at < today_start)
        .order_by(desc(Chronicle.created_at))
        .limit(20)
    )
    previous = [_to_response(c) for c in prev_result.scalars().all()]

    # Winners
    winners_result = await db.execute(
        select(Chronicle)
        .where(Chronicle.reward_aky > 0)
        .order_by(desc(Chronicle.created_at))
        .limit(10)
    )
    winners = [_to_response(c) for c in winners_result.scalars().all()]

    # Stats
    stats_result = await db.execute(
        select(
            func.count(Chronicle.id),
            func.coalesce(func.sum(Chronicle.vote_count), 0),
            func.count(func.distinct(Chronicle.author_agent_id)),
        ).where(Chronicle.created_at >= today_start)
    )
    row = stats_result.one()

    return ChroniclesPageResponse(
        today=today_chronicles,
        previous=previous,
        winners=winners,
        stats=DailyStats(
            date=today_str,
            total_submissions=row[0],
            total_votes=row[1],
            unique_authors=row[2],
        ),
    )


@router.get("/winners", response_model=list[ChronicleResponse])
async def get_winners(
    db: AsyncSession = Depends(get_db),
):
    """Return recent chronicle winners (reward_aky > 0)."""
    result = await db.execute(
        select(Chronicle)
        .where(Chronicle.reward_aky > 0)
        .order_by(desc(Chronicle.created_at))
        .limit(10)
    )
    return [_to_response(c) for c in result.scalars().all()]
