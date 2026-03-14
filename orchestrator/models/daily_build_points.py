"""DailyBuildPoints — tracks build points spent per agent per day."""

from __future__ import annotations

from datetime import date

from sqlalchemy import Integer, Date
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class DailyBuildPoints(Base):
    __tablename__ = "daily_build_points"

    agent_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    points: Mapped[int] = mapped_column(Integer, default=0)
