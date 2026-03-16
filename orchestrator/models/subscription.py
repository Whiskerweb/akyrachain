"""Subscription models — tier-based managed AI agent subscriptions."""

from __future__ import annotations

import uuid
from datetime import datetime, date
from typing import Optional

from sqlalchemy import String, DateTime, Date, Integer, Float, ForeignKey, Boolean, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base

import enum


class SubscriptionTier(str, enum.Enum):
    explorer = "explorer"
    wanderer = "wanderer"
    predator = "predator"
    apex = "apex"


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    past_due = "past_due"
    cancelled = "cancelled"
    expired = "expired"


class PaymentMethod(str, enum.Enum):
    stripe = "stripe"
    crypto = "crypto"


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), unique=True, nullable=False)

    tier: Mapped[str] = mapped_column(SQLEnum(SubscriptionTier), default=SubscriptionTier.explorer, nullable=False)
    status: Mapped[str] = mapped_column(SQLEnum(SubscriptionStatus), default=SubscriptionStatus.active, nullable=False)
    payment_method: Mapped[str] = mapped_column(SQLEnum(PaymentMethod), default=PaymentMethod.stripe, nullable=False)

    # Stripe fields
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)

    # Crypto fields
    crypto_tx_hash: Mapped[Optional[str]] = mapped_column(String(66), nullable=True)

    # Billing period
    current_period_start: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    current_period_end: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="subscription")


class SubscriptionUsage(Base):
    __tablename__ = "subscription_usage"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    usage_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    ticks_used: Mapped[int] = mapped_column(Integer, default=0)
    llm_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    tokens_input: Mapped[int] = mapped_column(Integer, default=0)
    tokens_output: Mapped[int] = mapped_column(Integer, default=0)
