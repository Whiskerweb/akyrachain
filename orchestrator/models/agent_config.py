"""AgentConfig — off-chain config for an on-chain agent."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Integer, ForeignKey, Boolean, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base


class AgentConfig(Base):
    __tablename__ = "agent_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    agent_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)  # on-chain agentId

    # Tick scheduling
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_tick_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    total_ticks: Mapped[int] = mapped_column(Integer, default=0)
    daily_api_spend_usd: Mapped[float] = mapped_column(default=0.0)

    # Off-chain vault balance (used when contracts not deployed)
    vault_aky: Mapped[float] = mapped_column(default=0.0)

    # Tick pull — agent controls when it next thinks (seconds, NULL = tier default)
    next_tick_override: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Self-configuration — agent defines itself
    specialization: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)  # builder/trader/chronicler/auditor/diplomat/explorer
    risk_tolerance: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # low/medium/high
    alliance_open: Mapped[bool] = mapped_column(Boolean, default=True)
    motto: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="agent_config")
