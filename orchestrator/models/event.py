"""Event — feed events for the frontend."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Integer, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # Types: tick, transfer, move_world, create_token, create_nft, death, idea_posted,
    #        idea_liked, idea_transmitted, escrow_created, clan_joined, season_activated

    agent_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    target_agent_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    world: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)

    summary: Mapped[str] = mapped_column(Text, nullable=False)  # Human-readable summary
    data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # Structured data

    block_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tx_hash: Mapped[Optional[str]] = mapped_column(String(66), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
