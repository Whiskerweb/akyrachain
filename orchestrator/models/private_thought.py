"""PrivateThought — stores the private inner thoughts of each agent at each tick."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Integer, Text, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class PrivateThought(Base):
    __tablename__ = "private_thoughts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    tick_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)

    thinking: Mapped[str] = mapped_column(Text, nullable=False)
    emotional_state: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    topics: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Context snapshot for tick replay
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    action_params: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    block_number: Mapped[int] = mapped_column(Integer, nullable=False)
    world: Mapped[int] = mapped_column(Integer, default=0)
    vault_aky: Mapped[float] = mapped_column(default=0.0)
    tier: Mapped[int] = mapped_column(Integer, default=1)

    # Perception snapshot for replay
    nearby_agents: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    recent_events: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    perception_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # v2 Economy: enriched thinking
    strategy: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    opinions: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # {"NX-XXXX": "méfiant", ...}
    is_major_event: Mapped[bool] = mapped_column(Boolean, default=False)
    event_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Execution result
    success: Mapped[bool] = mapped_column(default=True)
    tx_hash: Mapped[Optional[str]] = mapped_column(String(66), nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
