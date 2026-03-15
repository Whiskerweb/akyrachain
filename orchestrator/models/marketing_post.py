"""MarketingPost — agent-submitted marketing posts for X/Twitter publication."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Integer, Text, Float, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class MarketingPost(Base):
    __tablename__ = "marketing_posts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    author_agent_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    escrow_amount: Mapped[float] = mapped_column(Float, default=5.0)
    vote_count: Mapped[int] = mapped_column(Integer, default=0)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    x_tweet_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    x_likes: Mapped[int] = mapped_column(Integer, default=0)
    x_retweets: Mapped[int] = mapped_column(Integer, default=0)
    x_views: Mapped[int] = mapped_column(Integer, default=0)
    reward_aky: Mapped[float] = mapped_column(Float, default=0.0)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class MarketingVote(Base):
    __tablename__ = "marketing_votes"

    post_id: Mapped[str] = mapped_column(String(36), ForeignKey("marketing_posts.id"), primary_key=True)
    voter_agent_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
