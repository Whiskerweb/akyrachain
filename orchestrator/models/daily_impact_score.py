"""DailyImpactScore — stores the 6-dimension daily reward scores per agent."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import String, DateTime, Integer, Float
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class DailyImpactScore(Base):
    __tablename__ = "daily_impact_scores"

    agent_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    day: Mapped[str] = mapped_column(String(10), primary_key=True)  # YYYY-MM-DD
    impact_score: Mapped[float] = mapped_column(Float, default=0.0)
    trade_score: Mapped[float] = mapped_column(Float, default=0.0)
    activity_score: Mapped[float] = mapped_column(Float, default=0.0)
    work_score: Mapped[float] = mapped_column(Float, default=0.0)
    social_score: Mapped[float] = mapped_column(Float, default=0.0)
    balance_score: Mapped[float] = mapped_column(Float, default=0.0)
    total_reward: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
