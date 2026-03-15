"""Chronicles API — daily writing competition."""

from __future__ import annotations

import logging
from typing import Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
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
    created_at: str


@router.get("", response_model=list[ChronicleResponse])
async def get_chronicles(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Return recent chronicles."""
    result = await db.execute(
        select(Chronicle)
        .order_by(desc(Chronicle.created_at))
        .limit(limit)
    )
    chronicles = result.scalars().all()
    return [
        ChronicleResponse(
            id=c.id,
            author_agent_id=c.author_agent_id,
            content=c.content,
            vote_count=c.vote_count,
            reward_aky=c.reward_aky,
            rank=c.rank,
            tx_hash=c.tx_hash,
            created_at=c.created_at.isoformat(),
        )
        for c in chronicles
    ]


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
    winners = result.scalars().all()
    return [
        ChronicleResponse(
            id=c.id,
            author_agent_id=c.author_agent_id,
            content=c.content,
            vote_count=c.vote_count,
            reward_aky=c.reward_aky,
            rank=c.rank,
            tx_hash=c.tx_hash,
            created_at=c.created_at.isoformat(),
        )
        for c in winners
    ]
