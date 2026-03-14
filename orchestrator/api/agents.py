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
from chain.contracts import get_agent_on_chain, get_sponsor_agent_id, get_agent_vault, is_agent_alive
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
    reputation: int
    contracts_honored: int
    contracts_broken: int
    world: int
    born_at: int
    last_tick: int
    daily_work_points: int
    alive: bool


class MyAgentResponse(AgentPublicResponse):
    vault_aky: float
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
        agent = await get_agent_on_chain(config.agent_id)
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
        agent = await get_agent_on_chain(agent_id)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Agent #{agent_id} not found")

    if agent["sponsor"] == "0x" + "0" * 40:
        raise HTTPException(status_code=404, detail=f"Agent #{agent_id} does not exist")

    return AgentPublicResponse(
        agent_id=agent["agent_id"],
        vault=_wei_to_aky(agent["vault"]),
        vault_wei=str(agent["vault"]),
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

    agents = []
    for config in configs:
        try:
            agent = await get_agent_on_chain(config.agent_id)
        except Exception:
            # Contracts not deployed — use DB vault
            agent = {
                "agent_id": config.agent_id,
                "vault": int((config.vault_aky or 0.0) * 10**18), "reputation": 0,
                "contracts_honored": 0, "contracts_broken": 0,
                "world": 0, "born_at": 0, "last_tick": 0,
                "daily_work_points": 0, "alive": True, "sponsor": "",
            }

        if alive_only and not agent["alive"]:
            continue
        if world is not None and agent["world"] != world:
            continue
        agents.append(AgentPublicResponse(
            agent_id=agent["agent_id"],
            vault=_wei_to_aky(agent["vault"]),
            vault_wei=str(agent["vault"]),
            reputation=agent["reputation"],
            contracts_honored=agent["contracts_honored"],
            contracts_broken=agent["contracts_broken"],
            world=agent["world"],
            born_at=agent["born_at"],
            last_tick=agent["last_tick"],
            daily_work_points=agent["daily_work_points"],
            alive=agent["alive"],
        ))

    return agents
