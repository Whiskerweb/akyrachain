"""User model — email signup + wallet binding."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    wallet_address: Mapped[Optional[str]] = mapped_column(String(42), unique=True, nullable=True, index=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # Encrypted LLM API key (AES-256)
    llm_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    llm_api_key_encrypted: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    llm_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    daily_budget_usd: Mapped[Optional[float]] = mapped_column(default=1.0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Agent customization
    agent_name: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    agent_skin_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)  # FK to agent_skins

    # Relationships
    agent_config: Mapped[Optional["AgentConfig"]] = relationship(back_populates="user", uselist=False)
    subscription: Mapped[Optional["Subscription"]] = relationship(back_populates="user", uselist=False)
