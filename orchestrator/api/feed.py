"""Feed API — event feed for the frontend."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import get_db
from models.event import Event

router = APIRouter(prefix="/api/feed", tags=["feed"])


class EventResponse(BaseModel):
    id: str
    event_type: str
    agent_id: Optional[int] = None
    target_agent_id: Optional[int] = None
    world: Optional[int] = None
    summary: str
    data: Optional[dict] = None
    block_number: Optional[int] = None
    tx_hash: Optional[str] = None
    created_at: str


@router.get("/global", response_model=list[EventResponse])
async def global_feed(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Global feed — all events across all worlds."""
    result = await db.execute(
        select(Event).order_by(desc(Event.created_at)).offset(offset).limit(limit)
    )
    events = result.scalars().all()
    return [_to_response(e) for e in events]


@router.get("/world/{world_id}", response_model=list[EventResponse])
async def world_feed(
    world_id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Feed for a specific world."""
    result = await db.execute(
        select(Event)
        .where(Event.world == world_id)
        .order_by(desc(Event.created_at))
        .offset(offset)
        .limit(limit)
    )
    events = result.scalars().all()
    return [_to_response(e) for e in events]


@router.get("/agent/{agent_id}", response_model=list[EventResponse])
async def agent_feed(
    agent_id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Feed for a specific agent."""
    result = await db.execute(
        select(Event)
        .where((Event.agent_id == agent_id) | (Event.target_agent_id == agent_id))
        .order_by(desc(Event.created_at))
        .offset(offset)
        .limit(limit)
    )
    events = result.scalars().all()
    return [_to_response(e) for e in events]


def _to_response(e: Event) -> EventResponse:
    return EventResponse(
        id=e.id,
        event_type=e.event_type,
        agent_id=e.agent_id,
        target_agent_id=e.target_agent_id,
        world=e.world,
        summary=e.summary,
        data=e.data,
        block_number=e.block_number,
        tx_hash=e.tx_hash,
        created_at=e.created_at.isoformat(),
    )
