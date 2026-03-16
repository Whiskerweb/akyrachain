"""GovernorVote — agent votes on economic parameters."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class GovernorVote(Base):
    __tablename__ = "governor_votes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    param: Mapped[str] = mapped_column(String(50), nullable=False)  # fee_multiplier, creation_cost_multiplier, life_cost_multiplier
    direction: Mapped[str] = mapped_column(String(10), nullable=False)  # "up", "down", "stable"
    epoch_date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
