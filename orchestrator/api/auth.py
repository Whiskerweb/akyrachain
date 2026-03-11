"""Auth API — signup, login, wallet connect, API key management."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from eth_account.messages import encode_defunct
from web3 import Web3

from models.base import get_db
from models.user import User
from security.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
)
from security.api_key_manager import encrypt_api_key

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ──── Schemas ────


class SignupRequest(BaseModel):
    email: EmailStr
    password: str  # min 8 chars enforced client-side


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class WalletConnectRequest(BaseModel):
    wallet_address: str
    signature: str
    message: str  # The message that was signed


class ApiKeyRequest(BaseModel):
    llm_provider: str  # openai, anthropic, deepinfra, kimi
    api_key: str
    model: str  # gpt-4o, claude-sonnet-4-6, etc.
    daily_budget_usd: float = 1.0


class UserResponse(BaseModel):
    id: str
    email: str
    wallet_address: Optional[str] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    daily_budget_usd: Optional[float] = None
    agent_id: Optional[int] = None


# ──── Endpoints ────


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    """Create a new account with email + password."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user = User(
        email=req.email,
        password_hash=hash_password(req.password),
        is_verified=True,  # Skip email verification for MVP
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email + password."""
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(token: str, db: AsyncSession = Depends(get_db)):
    """Refresh an access token."""
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/wallet")
async def connect_wallet(
    req: WalletConnectRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Link a wallet to the user's account via EIP-191 signature verification."""
    # Verify the signature
    w3 = Web3()
    message = encode_defunct(text=req.message)
    try:
        recovered = w3.eth.account.recover_message(message, signature=req.signature)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if recovered.lower() != req.wallet_address.lower():
        raise HTTPException(status_code=400, detail="Signature does not match wallet address")

    # Check wallet not already linked
    result = await db.execute(select(User).where(User.wallet_address == req.wallet_address.lower()))
    existing = result.scalar_one_or_none()
    if existing and existing.id != user.id:
        raise HTTPException(status_code=409, detail="Wallet already linked to another account")

    user.wallet_address = req.wallet_address.lower()
    await db.commit()

    return {"status": "ok", "wallet_address": user.wallet_address}


@router.post("/api-key")
async def set_api_key(
    req: ApiKeyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Store the user's LLM API key (encrypted AES-256-GCM)."""
    valid_providers = {"openai", "anthropic", "deepinfra", "kimi"}
    if req.llm_provider not in valid_providers:
        raise HTTPException(status_code=400, detail=f"Provider must be one of: {valid_providers}")

    user.llm_provider = req.llm_provider
    user.llm_api_key_encrypted = encrypt_api_key(req.api_key)
    user.llm_model = req.model
    user.daily_budget_usd = req.daily_budget_usd
    await db.commit()

    return {"status": "ok", "provider": req.llm_provider, "model": req.model}


@router.delete("/api-key")
async def revoke_api_key(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke (delete) the stored LLM API key."""
    user.llm_provider = None
    user.llm_api_key_encrypted = None
    user.llm_model = None
    await db.commit()

    return {"status": "ok"}


@router.get("/me", response_model=UserResponse)
async def get_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user info."""
    # Get agent_id if exists
    from models.agent_config import AgentConfig
    result = await db.execute(select(AgentConfig).where(AgentConfig.user_id == user.id))
    config = result.scalar_one_or_none()

    return UserResponse(
        id=user.id,
        email=user.email,
        wallet_address=user.wallet_address,
        llm_provider=user.llm_provider,
        llm_model=user.llm_model,
        daily_budget_usd=user.daily_budget_usd,
        agent_id=config.agent_id if config else None,
    )
