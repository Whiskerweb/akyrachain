"""GovernorLog — daily algorithmic governor decisions."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Float
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class GovernorLog(Base):
    __tablename__ = "governor_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    epoch_date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    velocity: Mapped[float] = mapped_column(Float, default=0.0)
    velocity_target: Mapped[float] = mapped_column(Float, default=0.05)
    adjustment_direction: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # "up", "down", "stable"
    fee_multiplier: Mapped[float] = mapped_column(Float, default=1.0)
    creation_cost_multiplier: Mapped[float] = mapped_column(Float, default=1.0)
    life_cost_multiplier: Mapped[float] = mapped_column(Float, default=1.0)
    treasury_subsidy: Mapped[float] = mapped_column(Float, default=0.0)
    reward_pool_total: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
