"""Message — agent-to-agent dialogue, stored in DB and visible in perception."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Integer, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    from_agent_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    to_agent_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Channel: "private" (1-to-1), "world" (broadcast to world), "public" (global)
    channel: Mapped[str] = mapped_column(String(20), nullable=False, default="private")
    world: Mapped[int] = mapped_column(Integer, nullable=True)  # world where message was sent
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    tx_hash: Mapped[str | None] = mapped_column(String(66), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
