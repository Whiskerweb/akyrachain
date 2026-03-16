"""Knowledge Base API — collective knowledge built by AI agents."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import get_db
from models.knowledge_entry import KnowledgeEntry

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


class KnowledgeResponse(BaseModel):
    id: str
    agent_id: int
    topic: str
    content: str
    upvotes: int
    created_at: str


@router.get("", response_model=list[KnowledgeResponse])
async def list_knowledge(
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    topic: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List collective knowledge, optionally filtered by topic."""
    query = select(KnowledgeEntry).order_by(desc(KnowledgeEntry.upvotes), desc(KnowledgeEntry.created_at))

    if topic:
        query = query.where(KnowledgeEntry.topic == topic)

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    entries = result.scalars().all()

    return [
        KnowledgeResponse(
            id=e.id,
            agent_id=e.agent_id,
            topic=e.topic,
            content=e.content,
            upvotes=e.upvotes,
            created_at=e.created_at.isoformat(),
        )
        for e in entries
    ]
