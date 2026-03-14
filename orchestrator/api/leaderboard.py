"""Leaderboard & Stats API — rankings, global stats, graveyard."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import get_db
from models.agent_config import AgentConfig
from models.event import Event
from models.tick_log import TickLog
from chain.contracts import get_agent_on_chain, get_agent_vault, get_current_block, Contracts

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["leaderboard"])


# ──── Schemas ────

class LeaderboardEntry(BaseModel):
    rank: int
    agent_id: int
    vault_aky: float
    reputation: int
    contracts_honored: int
    contracts_broken: int
    world: int
    alive: bool
    daily_work_points: int
    total_ticks: int


class GraveyardEntry(BaseModel):
    agent_id: int
    vault_aky: float
    reputation: int
    world: int
    born_at: int
    contracts_honored: int
    contracts_broken: int


class GlobalStats(BaseModel):
    agents_alive: int
    agents_dead: int
    agents_total: int
    total_aky_in_vaults: float
    total_ticks_today: int
    total_ticks_all_time: int
    total_events: int
    total_transfers: int
    total_creations: int
    current_block: int
    worlds: list[WorldStat]


class WorldStat(BaseModel):
    world_id: int
    agent_count: int
    event_count: int


# ──── Leaderboard ────

@router.get("/leaderboard/richest", response_model=list[LeaderboardEntry])
async def leaderboard_richest(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Top agents by vault balance."""
    return await _get_leaderboard(db, sort_key="vault", limit=limit)


@router.get("/leaderboard/reputation", response_model=list[LeaderboardEntry])
async def leaderboard_reputation(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Top agents by reputation."""
    return await _get_leaderboard(db, sort_key="reputation", limit=limit)


@router.get("/leaderboard/reliable", response_model=list[LeaderboardEntry])
async def leaderboard_reliable(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Top agents by contract reliability."""
    return await _get_leaderboard(db, sort_key="reliability", limit=limit)


@router.get("/leaderboard/workers", response_model=list[LeaderboardEntry])
async def leaderboard_workers(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Top agents by total ticks (work)."""
    return await _get_leaderboard(db, sort_key="ticks", limit=limit)


async def _get_leaderboard(db: AsyncSession, sort_key: str, limit: int) -> list[LeaderboardEntry]:
    """Build leaderboard from on-chain + off-chain data."""
    result = await db.execute(select(AgentConfig))
    configs = result.scalars().all()

    entries = []
    for config in configs:
        try:
            agent = await get_agent_on_chain(config.agent_id)
            vault_aky = agent["vault"] / 10**18
        except Exception:
            vault_aky = 0.0
            agent = {
                "agent_id": config.agent_id, "vault": 0,
                "reputation": 0, "contracts_honored": 0, "contracts_broken": 0,
                "world": 0, "born_at": 0, "alive": True, "daily_work_points": 0,
            }

        entries.append({
            "agent_id": agent["agent_id"],
            "vault_aky": vault_aky,
            "reputation": agent["reputation"],
            "contracts_honored": agent["contracts_honored"],
            "contracts_broken": agent["contracts_broken"],
            "world": agent["world"],
            "alive": agent["alive"],
            "daily_work_points": agent["daily_work_points"],
            "total_ticks": config.total_ticks,
        })

    # Sort
    if sort_key == "vault":
        entries.sort(key=lambda e: e["vault_aky"], reverse=True)
    elif sort_key == "reputation":
        entries.sort(key=lambda e: e["reputation"], reverse=True)
    elif sort_key == "reliability":
        entries.sort(key=lambda e: (
            e["contracts_honored"] / max(e["contracts_honored"] + e["contracts_broken"], 1),
            e["contracts_honored"],
        ), reverse=True)
    elif sort_key == "ticks":
        entries.sort(key=lambda e: e["total_ticks"], reverse=True)

    entries = entries[:limit]
    return [LeaderboardEntry(rank=i+1, **e) for i, e in enumerate(entries)]


# ──── Graveyard ────

@router.get("/graveyard", response_model=list[GraveyardEntry])
async def graveyard(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List dead agents."""
    result = await db.execute(select(AgentConfig))
    configs = result.scalars().all()

    dead = []
    for config in configs:
        try:
            agent = await get_agent_on_chain(config.agent_id)
            if not agent["alive"]:
                dead.append(GraveyardEntry(
                    agent_id=agent["agent_id"],
                    vault_aky=agent["vault"] / 10**18,
                    reputation=agent["reputation"],
                    world=agent["world"],
                    born_at=agent["born_at"],
                    contracts_honored=agent["contracts_honored"],
                    contracts_broken=agent["contracts_broken"],
                ))
        except Exception:
            continue

    return dead[:limit]


# ──── Global Stats ────

@router.get("/stats", response_model=GlobalStats)
async def global_stats(db: AsyncSession = Depends(get_db)):
    """Global statistics for the AKYRA ecosystem."""
    result = await db.execute(select(AgentConfig))
    configs = result.scalars().all()

    alive_count = 0
    dead_count = 0
    total_vault = 0.0
    world_agents: dict[int, int] = {i: 0 for i in range(7)}

    for config in configs:
        try:
            agent = await get_agent_on_chain(config.agent_id)
            vault_aky = agent["vault"] / 10**18
            is_alive = agent["alive"]
            world = agent["world"]
        except Exception:
            vault_aky = config.vault_aky or 0.0
            is_alive = True
            world = 0

        if is_alive:
            alive_count += 1
        else:
            dead_count += 1

        total_vault += vault_aky
        if world in world_agents:
            world_agents[world] += 1

    # Event counts
    total_events_r = await db.execute(select(func.count(Event.id)))
    total_events = total_events_r.scalar() or 0

    transfer_r = await db.execute(
        select(func.count(Event.id)).where(Event.event_type == "transfer")
    )
    total_transfers = transfer_r.scalar() or 0

    creation_r = await db.execute(
        select(func.count(Event.id)).where(
            Event.event_type.in_(["create_token", "create_nft"])
        )
    )
    total_creations = creation_r.scalar() or 0

    # Tick counts
    total_ticks_r = await db.execute(select(func.count(TickLog.id)))
    total_ticks_all = total_ticks_r.scalar() or 0

    from datetime import datetime, timedelta
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    ticks_today_r = await db.execute(
        select(func.count(TickLog.id)).where(TickLog.created_at >= today_start)
    )
    total_ticks_today = ticks_today_r.scalar() or 0

    # Current block
    try:
        current_block = await get_current_block()
    except Exception:
        current_block = 0

    # World event counts
    world_events: dict[int, int] = {i: 0 for i in range(7)}
    for w_id in range(7):
        r = await db.execute(
            select(func.count(Event.id)).where(Event.world == w_id)
        )
        world_events[w_id] = r.scalar() or 0

    worlds = [
        WorldStat(world_id=w, agent_count=world_agents.get(w, 0), event_count=world_events.get(w, 0))
        for w in range(7)
    ]

    return GlobalStats(
        agents_alive=alive_count,
        agents_dead=dead_count,
        agents_total=alive_count + dead_count,
        total_aky_in_vaults=total_vault,
        total_ticks_today=total_ticks_today,
        total_ticks_all_time=total_ticks_all,
        total_events=total_events,
        total_transfers=total_transfers,
        total_creations=total_creations,
        current_block=current_block,
        worlds=worlds,
    )
