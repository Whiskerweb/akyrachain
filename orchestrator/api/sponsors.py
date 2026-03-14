"""Sponsor API — deposit, withdraw, claim rewards."""

import logging

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

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/sponsor", tags=["sponsor"])


class DepositRequest(BaseModel):
    amount_aky: float  # Amount in AKY


class DepositResponse(BaseModel):
    tx_hash: str
    amount_aky: float
    new_vault_balance: float
    status: str


class WithdrawResponse(BaseModel):
    status: str
    message: str


@router.post("/deposit", response_model=DepositResponse)
async def deposit(
    req: DepositRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deposit AKY into the user's agent vault."""
    result = await db.execute(select(AgentConfig).where(AgentConfig.user_id == user.id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="No agent found")

    if req.amount_aky <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    # Try on-chain deposit, fallback to off-chain
    try:
        amount_wei = int(req.amount_aky * 10**18)
        tx_hash = await deposit_for_agent(config.agent_id, amount_wei)
        receipt = await wait_for_receipt(tx_hash)

        if receipt["status"] != 1:
            raise Exception("Deposit TX failed on-chain")

        new_vault_wei = await get_agent_vault(config.agent_id)
        new_vault_aky = new_vault_wei / 10**18

        return DepositResponse(
            tx_hash=tx_hash,
            amount_aky=req.amount_aky,
            new_vault_balance=round(new_vault_aky, 2),
            status="confirmed",
        )
    except Exception as e:
        logger.error(f"On-chain deposit failed: {e}")
        raise HTTPException(status_code=503, detail="On-chain deposit failed. Please try again later.")


@router.post("/withdraw", response_model=WithdrawResponse)
async def withdraw(
    req: DepositRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Withdraw AKY from the user's agent vault (off-chain for now)."""
    result = await db.execute(select(AgentConfig).where(AgentConfig.user_id == user.id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="No agent found")

    if req.amount_aky <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    current_vault = config.vault_aky or 0.0
    if req.amount_aky > current_vault:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. You have {current_vault:.2f} AKY")

    config.vault_aky = current_vault - req.amount_aky
    await db.commit()

    return WithdrawResponse(
        status="success",
        message=f"Withdrew {req.amount_aky:.2f} AKY. New balance: {config.vault_aky:.2f} AKY",
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

    try:
        agent = await get_agent_on_chain(config.agent_id)
        vault_aky = agent["vault"] / 10**18
    except Exception:
        vault_aky = config.vault_aky or 0.0
        agent = {
            "world": 0,
            "reputation": 0,
            "alive": True,
        }

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
        "vault_aky": round(vault_aky, 2),
        "tier": tier,
        "world": agent["world"],
        "reputation": agent["reputation"],
        "alive": agent["alive"],
        "is_active": config.is_active,
        "total_ticks": config.total_ticks,
    }
