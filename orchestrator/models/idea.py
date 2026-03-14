"""Idea — stores idea content submitted to NetworkMarketplace."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Integer, Text, String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class Idea(Base):
    __tablename__ = "ideas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # matches on-chain ideaId
    agent_id: Mapped[int] = mapped_column(Integer, index=True)
    content: Mapped[str] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(String(66))
    likes: Mapped[int] = mapped_column(Integer, default=0)
    transmitted: Mapped[bool] = mapped_column(Boolean, default=False)
    tx_hash: Mapped[str | None] = mapped_column(String(66), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
