"""Sponsor API — deposit, withdraw, claim rewards."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import get_db
from models.user import User
from models.agent_config import AgentConfig
from security.auth import get_current_user
from chain.contracts import get_agent_vault, get_agent_on_chain
from chain.tx_manager import deposit_for_agent, wait_for_receipt

router = APIRouter(prefix="/api/sponsor", tags=["sponsor"])


class DepositRequest(BaseModel):
    amount_aky: float  # Amount in AKY (will be converted to wei)


class DepositResponse(BaseModel):
    tx_hash: str
    amount_wei: str
    new_vault_balance: str


class WithdrawResponse(BaseModel):
    status: str
    message: str


@router.post("/deposit", response_model=DepositResponse)
async def deposit(
    req: DepositRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deposit AKY into the user's agent vault.

    Note: In the MVP, the orchestrator sends the deposit TX from its own funds.
    In production, the frontend would construct the TX and the user signs it with their wallet.
    """
    result = await db.execute(select(AgentConfig).where(AgentConfig.user_id == user.id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="No agent found")

    amount_wei = int(req.amount_aky * 10**18)
    if amount_wei <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    tx_hash = await deposit_for_agent(config.agent_id, amount_wei)
    receipt = await wait_for_receipt(tx_hash)

    if receipt["status"] != 1:
        raise HTTPException(status_code=500, detail="Deposit transaction failed")

    new_vault = await get_agent_vault(config.agent_id)

    return DepositResponse(
        tx_hash=tx_hash,
        amount_wei=str(amount_wei),
        new_vault_balance=f"{new_vault / 10**18:.2f} AKY",
    )


@router.get("/status")
async def sponsor_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get sponsor's agent status — vault balance, tier, world."""
    result = await db.execute(select(AgentConfig).where(AgentConfig.user_id == user.id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="No agent found")

    agent = await get_agent_on_chain(config.agent_id)
    vault_aky = agent["vault"] / 10**18

    # Determine tier
    if vault_aky >= 5000:
        tier = "T4"
    elif vault_aky >= 500:
        tier = "T3"
    elif vault_aky >= 50:
        tier = "T2"
    else:
        tier = "T1"

    return {
        "agent_id": config.agent_id,
        "vault_aky": f"{vault_aky:.2f}",
        "vault_wei": str(agent["vault"]),
        "tier": tier,
        "world": agent["world"],
        "reputation": agent["reputation"],
        "alive": agent["alive"],
        "is_active": config.is_active,
        "total_ticks": config.total_ticks,
    }
