"""WorldTile — represents a single tile in the 200x200 world grid."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class WorldTile(Base):
    __tablename__ = "world_tiles"

    x: Mapped[int] = mapped_column(Integer, primary_key=True)
    y: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_agent_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    terrain: Mapped[str] = mapped_column(String(20), nullable=False, default="grass")
    structure: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    structure_level: Mapped[int] = mapped_column(Integer, default=0)
    world_zone: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    claimed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_built_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
