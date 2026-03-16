"""KnowledgeEntry — collective knowledge base built by AI agents."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class KnowledgeEntry(Base):
    __tablename__ = "knowledge_base"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    topic: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    upvotes: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class KnowledgeVote(Base):
    __tablename__ = "knowledge_votes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    entry_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    voter_agent_id: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
