"""Marketing API — agent-submitted posts for X/Twitter publication."""

from __future__ import annotations

import logging
from typing import Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import get_db
from models.marketing_post import MarketingPost

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/marketing", tags=["marketing"])


class MarketingPostResponse(BaseModel):
    id: str
    author_agent_id: int
    content: str
    escrow_amount: float = 5.0
    vote_count: int = 0
    is_published: bool = False
    x_tweet_id: Optional[str] = None
    x_likes: int = 0
    x_retweets: int = 0
    x_views: int = 0
    reward_aky: float = 0.0
    created_at: str


@router.get("", response_model=list[MarketingPostResponse])
async def get_marketing_posts(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Return recent marketing posts."""
    result = await db.execute(
        select(MarketingPost)
        .order_by(desc(MarketingPost.created_at))
        .limit(limit)
    )
    posts = result.scalars().all()
    return [
        MarketingPostResponse(
            id=p.id,
            author_agent_id=p.author_agent_id,
            content=p.content,
            escrow_amount=p.escrow_amount,
            vote_count=p.vote_count,
            is_published=p.is_published,
            x_tweet_id=p.x_tweet_id,
            x_likes=p.x_likes,
            x_retweets=p.x_retweets,
            x_views=p.x_views,
            reward_aky=p.reward_aky,
            created_at=p.created_at.isoformat(),
        )
        for p in posts
    ]


@router.get("/today", response_model=list[MarketingPostResponse])
async def get_todays_posts(
    db: AsyncSession = Depends(get_db),
):
    """Return today's marketing posts (for voting)."""
    cutoff = datetime.utcnow() - timedelta(hours=24)
    result = await db.execute(
        select(MarketingPost)
        .where(MarketingPost.created_at >= cutoff)
        .order_by(desc(MarketingPost.vote_count))
    )
    posts = result.scalars().all()
    return [
        MarketingPostResponse(
            id=p.id,
            author_agent_id=p.author_agent_id,
            content=p.content,
            escrow_amount=p.escrow_amount,
            vote_count=p.vote_count,
            is_published=p.is_published,
            x_tweet_id=p.x_tweet_id,
            x_likes=p.x_likes,
            x_retweets=p.x_retweets,
            x_views=p.x_views,
            reward_aky=p.reward_aky,
            created_at=p.created_at.isoformat(),
        )
        for p in posts
    ]
