"""AgentSkin — cosmetic avatars for AI agents."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class AgentSkin(Base):
    __tablename__ = "agent_skins"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    style: Mapped[str] = mapped_column(String(20), nullable=False)  # pixel, anime, cyber, jungle, abstract
    tier_required: Mapped[str] = mapped_column(String(20), nullable=False, default="explorer")  # min tier to access
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    border_color: Mapped[str] = mapped_column(String(7), nullable=False, default="#6B7280")  # hex
    glow_effect: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # CSS class name
    is_animated: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
