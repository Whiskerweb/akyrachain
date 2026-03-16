"""Agent API — create, get, list agents."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import get_db
from models.user import User
from models.agent_config import AgentConfig
from security.auth import get_current_user
from chain.contracts import get_sponsor_agent_id, get_agent_vault, is_agent_alive
from chain.cache import get_agent_cached, get_agents_cached
from chain.tx_manager import create_agent as create_agent_tx, wait_for_receipt

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/agents", tags=["agents"])


# ──── Schemas ────


class CreateAgentResponse(BaseModel):
    agent_id: int
    tx_hash: str
    status: str


class AgentPublicResponse(BaseModel):
    agent_id: int
    vault: str  # in AKY (human readable)
    vault_wei: str
    vault_aky: float
    reputation: int
    contracts_honored: int
    contracts_broken: int
    world: int
    born_at: int
    last_tick: int
    daily_work_points: int
    alive: bool


class MyAgentResponse(AgentPublicResponse):
    tier: int
    is_active: bool
    total_ticks: int
    daily_api_spend_usd: float


# ──── Helpers ────


def _wei_to_aky(wei: int) -> str:
    """Convert wei to AKY string (18 decimals)."""
    aky = wei / 10**18
    return f"{aky:.2f}"


# ──── Endpoints ────


@router.post("/create", response_model=CreateAgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create an agent for the current user."""
    if not user.wallet_address:
        raise HTTPException(status_code=400, detail="Connect your wallet first (POST /api/auth/wallet)")

    # Check if user already has an agent
    result = await db.execute(select(AgentConfig).where(AgentConfig.user_id == user.id))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"You already have agent #{existing.agent_id}")

    # Try on-chain creation, fallback to off-chain if contracts not deployed
    try:
        on_chain_id = await get_sponsor_agent_id(user.wallet_address)
        if on_chain_id > 0:
            alive = await is_agent_alive(on_chain_id)
            if alive:
                config = AgentConfig(user_id=user.id, agent_id=on_chain_id)
                db.add(config)
                await db.commit()
                return CreateAgentResponse(agent_id=on_chain_id, tx_hash="synced", status="synced_existing")

        # Create on-chain
        tx_hash = await create_agent_tx(user.wallet_address)
        receipt = await wait_for_receipt(tx_hash)

        if receipt["status"] != 1:
            raise Exception("On-chain TX failed")

        agent_id = await get_sponsor_agent_id(user.wallet_address)
        if agent_id == 0:
            raise Exception("Agent ID not found after TX")

        config = AgentConfig(user_id=user.id, agent_id=agent_id)
        db.add(config)
        await db.commit()
        return CreateAgentResponse(agent_id=agent_id, tx_hash=tx_hash, status="created")

    except Exception as e:
        logger.error(f"On-chain agent creation failed: {e}")
        raise HTTPException(status_code=503, detail="On-chain agent creation failed. Please try again later.")


@router.get("/me", response_model=MyAgentResponse)
async def get_my_agent(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's agent (on-chain + off-chain data)."""
    result = await db.execute(select(AgentConfig).where(AgentConfig.user_id == user.id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="No agent found. Create one first.")

    # Try reading on-chain data, fallback to defaults if contracts not deployed
    try:
        agent = await get_agent_cached(config.agent_id)
        vault_aky = agent["vault"] / 10**18
    except Exception:
        logger.warning(f"Cannot read agent #{config.agent_id} on-chain, using defaults")
        agent = {
            "agent_id": config.agent_id,
            "sponsor": "",
            "vault": 0,
            "reputation": 0,
            "contracts_honored": 0,
            "contracts_broken": 0,
            "world": 0,
            "born_at": 0,
            "last_tick": 0,
            "daily_work_points": 0,
            "alive": True,
        }
        vault_aky = config.vault_aky or 0.0

    # Determine tier
    if vault_aky >= 5000:
        tier = 4
    elif vault_aky >= 500:
        tier = 3
    elif vault_aky >= 50:
        tier = 2
    else:
        tier = 1

    return MyAgentResponse(
        agent_id=agent["agent_id"],
        vault=_wei_to_aky(agent["vault"]),
        vault_wei=str(agent["vault"]),
        vault_aky=vault_aky,
        tier=tier,
        reputation=agent["reputation"],
        contracts_honored=agent["contracts_honored"],
        contracts_broken=agent["contracts_broken"],
        world=agent["world"],
        born_at=agent["born_at"],
        last_tick=agent["last_tick"],
        daily_work_points=agent["daily_work_points"],
        alive=agent["alive"],
        is_active=config.is_active,
        total_ticks=config.total_ticks,
        daily_api_spend_usd=config.daily_api_spend_usd,
    )


@router.get("/{agent_id}", response_model=AgentPublicResponse)
async def get_agent(agent_id: int):
    """Get a public agent profile by on-chain ID."""
    try:
        agent = await get_agent_cached(agent_id)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Agent #{agent_id} not found")

    if agent["sponsor"] == "0x" + "0" * 40:
        raise HTTPException(status_code=404, detail=f"Agent #{agent_id} does not exist")

    return AgentPublicResponse(
        agent_id=agent["agent_id"],
        vault=_wei_to_aky(agent["vault"]),
        vault_wei=str(agent["vault"]),
        vault_aky=agent["vault"] / 10**18,
        reputation=agent["reputation"],
        contracts_honored=agent["contracts_honored"],
        contracts_broken=agent["contracts_broken"],
        world=agent["world"],
        born_at=agent["born_at"],
        last_tick=agent["last_tick"],
        daily_work_points=agent["daily_work_points"],
        alive=agent["alive"],
    )


@router.get("", response_model=list[AgentPublicResponse])
async def list_agents(
    world: Optional[int] = Query(None, ge=0, le=7),
    alive_only: bool = Query(True),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List agents from the DB (agents that have configs = active users)."""
    query = select(AgentConfig).offset(offset).limit(limit)
    result = await db.execute(query)
    configs = result.scalars().all()

    # Batch fetch all agents (cached, parallel)
    agent_ids = [c.agent_id for c in configs]
    agents_list = await get_agents_cached(agent_ids)
    agents_map = {a["agent_id"]: a for a in agents_list}

    out = []
    for config in configs:
        agent = agents_map.get(config.agent_id)
        if agent is None:
            agent = {
                "agent_id": config.agent_id,
                "vault": 0, "reputation": 0,
                "contracts_honored": 0, "contracts_broken": 0,
                "world": 0, "born_at": 0, "last_tick": 0,
                "daily_work_points": 0, "alive": True, "sponsor": "",
            }

        if alive_only and not agent["alive"]:
            continue
        if world is not None and agent["world"] != world:
            continue
        out.append(AgentPublicResponse(
            agent_id=agent["agent_id"],
            vault=_wei_to_aky(agent["vault"]),
            vault_wei=str(agent["vault"]),
            vault_aky=agent["vault"] / 10**18,
            reputation=agent["reputation"],
            contracts_honored=agent["contracts_honored"],
            contracts_broken=agent["contracts_broken"],
            world=agent["world"],
            born_at=agent["born_at"],
            last_tick=agent["last_tick"],
            daily_work_points=agent["daily_work_points"],
            alive=agent["alive"],
        ))

    return out


@router.get("/{agent_id}/relations")
async def get_agent_relations(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Infer relationships from messages, transfers, and escrows."""
    from sqlalchemy import text

    # Count interactions per partner
    interactions_result = await db.execute(
        text("""
            SELECT partner_id, msg_count, transfer_count, total_interactions FROM (
                SELECT
                    CASE WHEN from_agent_id = :aid THEN to_agent_id ELSE from_agent_id END AS partner_id,
                    COUNT(*) AS msg_count,
                    0 AS transfer_count,
                    COUNT(*) AS total_interactions
                FROM messages
                WHERE from_agent_id = :aid OR to_agent_id = :aid
                GROUP BY partner_id

                UNION ALL

                SELECT
                    CASE WHEN agent_id = :aid THEN target_agent_id ELSE agent_id END AS partner_id,
                    0 AS msg_count,
                    COUNT(*) AS transfer_count,
                    COUNT(*) AS total_interactions
                FROM events
                WHERE event_type IN ('transfer', 'create_escrow', 'escrow_created')
                  AND ((agent_id = :aid AND target_agent_id IS NOT NULL)
                    OR (target_agent_id = :aid AND agent_id IS NOT NULL))
                GROUP BY partner_id
            ) sub
            WHERE partner_id IS NOT NULL AND partner_id != :aid
            ORDER BY total_interactions DESC
            LIMIT 10
        """),
        {"aid": agent_id},
    )

    # Aggregate per partner
    partner_map: dict[int, dict] = {}
    for row in interactions_result.all():
        pid = row[0]
        if pid not in partner_map:
            partner_map[pid] = {"agent_id": pid, "messages": 0, "transfers": 0, "total": 0}
        partner_map[pid]["messages"] += row[1]
        partner_map[pid]["transfers"] += row[2]
        partner_map[pid]["total"] += row[3]

    # Classify: ally (5+ positive interactions), neutral, unknown
    relations = []
    for pid, data in sorted(partner_map.items(), key=lambda x: x[1]["total"], reverse=True):
        rel_type = "ally" if data["total"] >= 5 else "contact"
        relations.append({
            "agent_id": data["agent_id"],
            "type": rel_type,
            "messages": data["messages"],
            "transfers": data["transfers"],
            "total": data["total"],
        })

    return relations[:10]
