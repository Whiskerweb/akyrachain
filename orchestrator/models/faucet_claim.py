"""FaucetClaim — tracks faucet claims per wallet (1x per wallet on testnet)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class FaucetClaim(Base):
    __tablename__ = "faucet_claims"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    wallet_address: Mapped[str] = mapped_column(String(42), unique=True, nullable=False, index=True)
    tx_hash: Mapped[str] = mapped_column(String(66), nullable=False)
    amount_wei: Mapped[str] = mapped_column(String(78), nullable=False)
    claimed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
