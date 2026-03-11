"""Faucet API — claim test AKY (testnet only, 1x per wallet)."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from models.base import get_db
from models.user import User
from models.faucet_claim import FaucetClaim
from security.auth import get_current_user
from chain.tx_manager import send_native, wait_for_receipt

router = APIRouter(prefix="/api/faucet", tags=["faucet"])


class ClaimResponse(BaseModel):
    tx_hash: str
    amount_aky: str
    wallet_address: str


@router.post("/claim", response_model=ClaimResponse)
async def claim_faucet(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Claim 1000 AKY from the testnet faucet. One claim per wallet."""
    settings = get_settings()

    if not settings.faucet_enabled:
        raise HTTPException(status_code=403, detail="Faucet is disabled")

    if not user.wallet_address:
        raise HTTPException(status_code=400, detail="Connect your wallet first")

    # Check if already claimed
    result = await db.execute(
        select(FaucetClaim).where(FaucetClaim.wallet_address == user.wallet_address)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Faucet already claimed for this wallet")

    # Send AKY
    amount_wei = int(settings.faucet_amount_wei)
    tx_hash = await send_native(user.wallet_address, amount_wei)
    receipt = await wait_for_receipt(tx_hash)

    if receipt["status"] != 1:
        raise HTTPException(status_code=500, detail="Faucet transaction failed")

    # Record claim
    claim = FaucetClaim(
        wallet_address=user.wallet_address,
        tx_hash=tx_hash,
        amount_wei=settings.faucet_amount_wei,
    )
    db.add(claim)
    await db.commit()

    amount_aky = amount_wei / 10**18
    return ClaimResponse(
        tx_hash=tx_hash,
        amount_aky=f"{amount_aky:.0f} AKY",
        wallet_address=user.wallet_address,
    )
