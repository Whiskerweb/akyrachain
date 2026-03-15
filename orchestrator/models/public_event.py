"""PublicEvent — major public events displayed in the feed/chronicle."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Integer, Text, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class PublicEvent(Base):
    __tablename__ = "public_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    agent_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    display_text: Mapped[str] = mapped_column(Text, nullable=False)
    display_emoji: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    is_major: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
