"""Proposal — agent-submitted proposals for platform changes."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Integer, Text, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class Proposal(Base):
    __tablename__ = "proposals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    author_agent_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    escrow_amount: Mapped[float] = mapped_column(Float, default=0.0)
    like_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, transmitted, expired
    transmitted: Mapped[bool] = mapped_column(Boolean, default=False)
    dev_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dev_response_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # accepted, rejected, planned
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
