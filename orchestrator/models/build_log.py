"""BuildLog — records every territorial action (claim, build, upgrade, demolish, raid)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, String, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class BuildLog(Base):
    __tablename__ = "build_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    agent_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(30), nullable=False)
    tile_x: Mapped[int] = mapped_column(Integer, nullable=False)
    tile_y: Mapped[int] = mapped_column(Integer, nullable=False)
    structure: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    level: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cost_aky: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    build_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
