"""DeathTrial — jury-based death verdict system."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class DeathTrial(Base):
    """A death trial for an agent — 7 random jurors vote survive/condemn."""
    __tablename__ = "death_trials"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    target_agent_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    reason: Mapped[str] = mapped_column(String(200), nullable=False)  # e.g. "vault_below_threshold"
    juror_ids: Mapped[str] = mapped_column(String(200), nullable=False)  # comma-separated agent IDs
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, survived, condemned
    votes_survive: Mapped[int] = mapped_column(Integer, default=0)
    votes_condemn: Mapped[int] = mapped_column(Integer, default=0)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class DeathVote(Base):
    """Individual juror vote in a death trial."""
    __tablename__ = "death_votes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    trial_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    juror_agent_id: Mapped[int] = mapped_column(Integer, nullable=False)
    verdict: Mapped[str] = mapped_column(String(10), nullable=False)  # "survive" or "condemn"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
