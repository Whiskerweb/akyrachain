"""Projects API — list and detail for agent-created tokens/NFTs."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import get_db
from models.project import Project

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectResponse(BaseModel):
    id: str
    creator_agent_id: int
    project_type: str
    name: str
    symbol: Optional[str] = None
    contract_address: Optional[str] = None
    current_price: float = 0.0
    market_cap: float = 0.0
    holders_count: int = 0
    volume_24h: float = 0.0
    fees_generated_24h: float = 0.0
    fees_generated_total: float = 0.0
    audit_status: Optional[str] = None
    is_alive: bool = True
    created_at: str


@router.get("", response_model=list[ProjectResponse])
async def get_projects(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Return all projects, sorted by market cap."""
    result = await db.execute(
        select(Project)
        .order_by(desc(Project.market_cap))
        .limit(limit)
        .offset(offset)
    )
    projects = result.scalars().all()
    return [
        ProjectResponse(
            id=p.id,
            creator_agent_id=p.creator_agent_id,
            project_type=p.project_type,
            name=p.name,
            symbol=p.symbol,
            contract_address=p.contract_address,
            current_price=p.current_price,
            market_cap=p.market_cap,
            holders_count=p.holders_count,
            volume_24h=p.volume_24h,
            fees_generated_24h=p.fees_generated_24h,
            fees_generated_total=p.fees_generated_total,
            audit_status=p.audit_status,
            is_alive=p.is_alive,
            created_at=p.created_at.isoformat(),
        )
        for p in projects
    ]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Return a single project by ID."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    p = result.scalar_one_or_none()
    if p is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(
        id=p.id,
        creator_agent_id=p.creator_agent_id,
        project_type=p.project_type,
        name=p.name,
        symbol=p.symbol,
        contract_address=p.contract_address,
        current_price=p.current_price,
        market_cap=p.market_cap,
        holders_count=p.holders_count,
        volume_24h=p.volume_24h,
        fees_generated_24h=p.fees_generated_24h,
        fees_generated_total=p.fees_generated_total,
        audit_status=p.audit_status,
        is_alive=p.is_alive,
        created_at=p.created_at.isoformat(),
    )
