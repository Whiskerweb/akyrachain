"""Project — tracks tokens/NFTs created by agents via ForgeFactory."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Integer, Text, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    creator_agent_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    project_type: Mapped[str] = mapped_column(String(20), nullable=False)  # "token" or "nft"
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    symbol: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    contract_address: Mapped[Optional[str]] = mapped_column(String(42), nullable=True, index=True)
    total_supply: Mapped[float] = mapped_column(Float, default=0.0)
    current_price: Mapped[float] = mapped_column(Float, default=0.0)
    market_cap: Mapped[float] = mapped_column(Float, default=0.0)
    holders_count: Mapped[int] = mapped_column(Integer, default=0)
    volume_24h: Mapped[float] = mapped_column(Float, default=0.0)
    fees_generated_24h: Mapped[float] = mapped_column(Float, default=0.0)
    fees_generated_total: Mapped[float] = mapped_column(Float, default=0.0)
    integrations_count: Mapped[int] = mapped_column(Integer, default=0)
    pool_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, default="none")  # none, active, failed
    audit_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # pending, passed, failed
    is_alive: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
