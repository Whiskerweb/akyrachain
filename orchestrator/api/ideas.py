"""Ideas API — list and detail ideas from NetworkMarketplace."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import get_db
from models.idea import Idea

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ideas", tags=["ideas"])


# ──── Schemas ────

class IdeaResponse(BaseModel):
    id: int
    agent_id: int
    content: str
    likes: int
    transmitted: bool
    tx_hash: Optional[str] = None
    created_at: str


# ──── Endpoints ────

@router.get("", response_model=list[IdeaResponse])
async def list_ideas(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """List all ideas, sorted by likes descending.

    Args:
        limit: Max number of ideas to return.
        offset: Pagination offset.
        active_only: If True, exclude transmitted ideas.
    """
    q = select(Idea).order_by(desc(Idea.likes), desc(Idea.created_at))

    if active_only:
        q = q.where(Idea.transmitted == False)  # noqa: E712

    q = q.offset(offset).limit(limit)
    result = await db.execute(q)
    ideas = result.scalars().all()

    # Try to sync likes from on-chain for returned ideas
    await _sync_likes_from_chain(ideas, db)

    return [_to_response(idea) for idea in ideas]


@router.get("/{idea_id}", response_model=IdeaResponse)
async def get_idea(
    idea_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a single idea by ID."""
    result = await db.execute(select(Idea).where(Idea.id == idea_id))
    idea = result.scalar_one_or_none()
    if idea is None:
        raise HTTPException(status_code=404, detail="Idea not found")

    # Sync likes from on-chain
    await _sync_likes_from_chain([idea], db)

    return _to_response(idea)


# ──── Helpers ────

async def _sync_likes_from_chain(ideas: list[Idea], db: AsyncSession) -> None:
    """Best-effort sync of like counts from on-chain data."""
    try:
        from chain.contracts import Contracts
        marketplace = Contracts.network_marketplace()

        for idea in ideas:
            try:
                on_chain = await marketplace.functions.getIdea(idea.id).call()
                # AkyraTypes.Idea struct: (authorAgentId, sponsorAgentId, contentHash,
                #   escrowAmount, likeCount, createdAt, expiresAt, transmitted, expired)
                chain_likes = on_chain[4]
                chain_transmitted = on_chain[7]

                if idea.likes != chain_likes or idea.transmitted != chain_transmitted:
                    idea.likes = chain_likes
                    idea.transmitted = chain_transmitted
                    db.add(idea)

            except Exception:
                # Skip individual idea sync failures silently
                continue

        await db.commit()
    except Exception as e:
        logger.debug(f"On-chain likes sync skipped: {e}")
        await db.rollback()


def _to_response(idea: Idea) -> IdeaResponse:
    return IdeaResponse(
        id=idea.id,
        agent_id=idea.agent_id,
        content=idea.content,
        likes=idea.likes,
        transmitted=idea.transmitted,
        tx_hash=idea.tx_hash,
        created_at=idea.created_at.isoformat(),
    )
