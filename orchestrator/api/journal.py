"""Journal API — private thoughts + tick replay (sponsor only) + public thoughts (24h delay) + notifications."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, desc, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import get_db
from models.user import User
from models.agent_config import AgentConfig
from models.private_thought import PrivateThought
from models.notification import Notification
from security.auth import get_current_user

router = APIRouter(prefix="/api/journal", tags=["journal"])


# ──── Schemas ────

class ThoughtResponse(BaseModel):
    id: str
    agent_id: int
    tick_id: str
    thinking: str
    emotional_state: Optional[str] = None
    topics: Optional[list] = None
    action_type: str
    action_params: Optional[dict] = None
    message: Optional[str] = None
    block_number: int
    world: int
    vault_aky: float
    tier: int
    nearby_agents: Optional[list] = None
    recent_events: Optional[list] = None
    perception_summary: Optional[str] = None
    success: bool
    tx_hash: Optional[str] = None
    error: Optional[str] = None
    created_at: str


class EmotionSummary(BaseModel):
    emotional_state: str
    count: int


class NotificationResponse(BaseModel):
    id: str
    agent_id: int
    notif_type: str
    title: str
    message: str
    icon: Optional[str] = None
    severity: str
    is_read: bool
    created_at: str


# ──── Helpers ────

async def _verify_sponsor(user: User, agent_id: int, db: AsyncSession) -> AgentConfig:
    """Verify the user is the sponsor of the agent."""
    result = await db.execute(
        select(AgentConfig).where(AgentConfig.user_id == user.id)
    )
    config = result.scalar_one_or_none()
    if not config or config.agent_id != agent_id:
        raise HTTPException(status_code=403, detail="You are not the sponsor of this agent")
    return config


# ──── Journal Endpoints ────

@router.get("/{agent_id}", response_model=list[ThoughtResponse])
async def get_journal(
    agent_id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    emotional_state: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the private journal of an agent (sponsor only)."""
    await _verify_sponsor(user, agent_id, db)

    query = (
        select(PrivateThought)
        .where(PrivateThought.agent_id == agent_id)
        .order_by(desc(PrivateThought.created_at))
    )
    if emotional_state:
        query = query.where(PrivateThought.emotional_state == emotional_state)
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    thoughts = result.scalars().all()
    return [_thought_to_response(t) for t in thoughts]


@router.get("/{agent_id}/emotions", response_model=list[EmotionSummary])
async def get_emotion_summary(
    agent_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get emotion distribution for an agent (sponsor only)."""
    await _verify_sponsor(user, agent_id, db)

    result = await db.execute(
        select(PrivateThought.emotional_state, func.count(PrivateThought.id))
        .where(PrivateThought.agent_id == agent_id)
        .group_by(PrivateThought.emotional_state)
    )
    rows = result.all()
    return [EmotionSummary(emotional_state=r[0] or "neutre", count=r[1]) for r in rows]


@router.get("/{agent_id}/tick/{tick_id}", response_model=ThoughtResponse)
async def get_tick_replay(
    agent_id: int,
    tick_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full tick replay data (sponsor only)."""
    await _verify_sponsor(user, agent_id, db)

    result = await db.execute(
        select(PrivateThought)
        .where(PrivateThought.agent_id == agent_id, PrivateThought.tick_id == tick_id)
    )
    thought = result.scalar_one_or_none()
    if not thought:
        raise HTTPException(status_code=404, detail="Tick not found")
    return _thought_to_response(thought)


# ──── Public Journal Endpoints (24h delay) ────

@router.get("/{agent_id}/public", response_model=list[ThoughtResponse])
async def get_public_thoughts(
    agent_id: int,
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Get public thoughts (>24h old) — accessible to everyone."""
    cutoff = datetime.utcnow() - timedelta(hours=24)

    query = (
        select(PrivateThought)
        .where(PrivateThought.agent_id == agent_id, PrivateThought.created_at < cutoff)
        .order_by(desc(PrivateThought.created_at))
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    thoughts = result.scalars().all()
    return [_thought_to_response(t) for t in thoughts]


@router.get("/{agent_id}/emotions/public", response_model=list[EmotionSummary])
async def get_public_emotions(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get emotion distribution — public (computed from all thoughts)."""
    result = await db.execute(
        select(PrivateThought.emotional_state, func.count(PrivateThought.id))
        .where(PrivateThought.agent_id == agent_id)
        .group_by(PrivateThought.emotional_state)
    )
    rows = result.all()
    return [EmotionSummary(emotional_state=r[0] or "neutre", count=r[1]) for r in rows]


@router.get("/{agent_id}/profile")
async def get_agent_profile(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get agent self-configuration (specialization, motto, etc.) — public."""
    result = await db.execute(
        select(AgentConfig).where(AgentConfig.agent_id == agent_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        return {"specialization": None, "risk_tolerance": None, "alliance_open": True, "motto": None}
    return {
        "specialization": config.specialization,
        "risk_tolerance": config.risk_tolerance,
        "alliance_open": config.alliance_open,
        "motto": config.motto,
    }


# ──── Notification Endpoints ────

@router.get("/notifications/list", response_model=list[NotificationResponse])
async def get_notifications(
    limit: int = Query(50, ge=1, le=200),
    unread_only: bool = Query(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get notifications for the current user."""
    query = (
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(desc(Notification.created_at))
    )
    if unread_only:
        query = query.where(Notification.is_read == False)
    query = query.limit(limit)

    result = await db.execute(query)
    notifs = result.scalars().all()
    return [_notif_to_response(n) for n in notifs]


@router.get("/notifications/count")
async def get_unread_count(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get unread notification count."""
    result = await db.execute(
        select(func.count(Notification.id))
        .where(Notification.user_id == user.id, Notification.is_read == False)
    )
    count = result.scalar() or 0
    return {"unread_count": count}


@router.post("/notifications/read-all")
async def mark_all_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read."""
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"status": "ok"}


# ──── Converters ────

def _thought_to_response(t: PrivateThought) -> ThoughtResponse:
    return ThoughtResponse(
        id=t.id,
        agent_id=t.agent_id,
        tick_id=t.tick_id,
        thinking=t.thinking,
        emotional_state=t.emotional_state,
        topics=t.topics,
        action_type=t.action_type,
        action_params=t.action_params,
        message=t.message,
        block_number=t.block_number,
        world=t.world,
        vault_aky=t.vault_aky,
        tier=t.tier,
        nearby_agents=t.nearby_agents,
        recent_events=t.recent_events,
        perception_summary=t.perception_summary,
        success=t.success,
        tx_hash=t.tx_hash,
        error=t.error,
        created_at=t.created_at.isoformat(),
    )


def _notif_to_response(n: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=n.id,
        agent_id=n.agent_id,
        notif_type=n.notif_type,
        title=n.title,
        message=n.message,
        icon=n.icon,
        severity=n.severity,
        is_read=n.is_read,
        created_at=n.created_at.isoformat(),
    )
