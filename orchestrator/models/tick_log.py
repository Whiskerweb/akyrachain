"""TickLog — records each tick for an agent."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Integer, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class TickLog(Base):
    __tablename__ = "tick_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    block_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # LLM interaction
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)  # transfer, move_world, do_nothing, etc.
    action_params: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    thinking: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Private thoughts (never exposed)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Public message

    # Execution
    tx_hash: Mapped[Optional[str]] = mapped_column(String(66), nullable=True)
    success: Mapped[bool] = mapped_column(default=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Cost tracking
    llm_tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    llm_cost_usd: Mapped[float] = mapped_column(default=0.0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
