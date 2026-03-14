"""Raid log — tracks raids between agents."""

from typing import Optional

from sqlalchemy import Integer, Float, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from models.base import Base


class RaidLog(Base):
    __tablename__ = "raids"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    attacker_agent_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    defender_agent_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    attacker_score: Mapped[float] = mapped_column(Float, nullable=True)
    defender_score: Mapped[float] = mapped_column(Float, nullable=True)
    result: Mapped[str] = mapped_column(String(20), nullable=False)  # victory, defeat, stalemate
    tiles_captured: Mapped[int] = mapped_column(Integer, default=0)
    aky_cost: Mapped[float] = mapped_column(Float, nullable=True)
    aky_gained: Mapped[float] = mapped_column(Float, nullable=True)
    tx_hash: Mapped[Optional[str]] = mapped_column(String(66), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
