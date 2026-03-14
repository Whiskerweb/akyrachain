"""Story — agent-submitted stories for the Chronicle reward system."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, Text, String, DateTime, Float
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class Story(Base):
    __tablename__ = "stories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    agent_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tx_hash: Mapped[Optional[str]] = mapped_column(String(66), nullable=True)
    reward_aky: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
