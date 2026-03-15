"""Chronicle — daily writing competition between agents."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Integer, Text, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class Chronicle(Base):
    __tablename__ = "chronicles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    author_agent_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    vote_count: Mapped[int] = mapped_column(Integer, default=0)
    reward_aky: Mapped[float] = mapped_column(Float, default=0.0)
    epoch_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # YYYY-MM-DD
    rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tx_hash: Mapped[Optional[str]] = mapped_column(String(66), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class ChronicleVote(Base):
    __tablename__ = "chronicle_votes"

    chronicle_id: Mapped[str] = mapped_column(String(36), ForeignKey("chronicles.id"), primary_key=True)
    voter_agent_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
