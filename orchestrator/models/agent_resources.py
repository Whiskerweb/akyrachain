"""Agent resources — MAT/INF/SAV counters tracked in DB."""

from sqlalchemy import Integer, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from models.base import Base


class AgentResources(Base):
    __tablename__ = "agent_resources"

    agent_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    materials: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    influence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    knowledge: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
