"""Billing API — subscription management, Stripe checkout, webhooks."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import get_db
from models.user import User
from models.subscription import Subscription, SubscriptionTier, SubscriptionStatus, PaymentMethod
from models.agent_config import AgentConfig
from security.auth import get_current_user
from services import stripe_service
from services.platform_keys import TIER_CONFIG
from config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing", tags=["billing"])


# ──── Schemas ────


class CheckoutRequest(BaseModel):
    tier: str  # wanderer, predator, apex
    success_url: str
    cancel_url: str


class ChangeTierRequest(BaseModel):
    new_tier: str


class SubscriptionResponse(BaseModel):
    tier: str
    status: str
    payment_method: str
    current_period_end: str | None
    cancel_at_period_end: bool
    daily_ticks_limit: int
    model_name: str


class PortalRequest(BaseModel):
    return_url: str


# ──── Helpers ────


async def _get_or_create_subscription(user_id: str, session: AsyncSession) -> Subscription:
    """Get existing subscription or create a free Explorer one."""
    result = await session.execute(select(Subscription).where(Subscription.user_id == user_id))
    sub = result.scalar_one_or_none()
    if not sub:
        sub = Subscription(user_id=user_id, tier=SubscriptionTier.explorer, status=SubscriptionStatus.active)
        session.add(sub)
        await session.flush()
    return sub


# ──── Endpoints ────


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Get the current user's subscription info."""
    sub = await _get_or_create_subscription(user.id, session)
    tier_cfg = TIER_CONFIG[sub.tier.value if isinstance(sub.tier, SubscriptionTier) else sub.tier]
    return SubscriptionResponse(
        tier=sub.tier.value if isinstance(sub.tier, SubscriptionTier) else sub.tier,
        status=sub.status.value if isinstance(sub.status, SubscriptionStatus) else sub.status,
        payment_method=sub.payment_method.value if isinstance(sub.payment_method, PaymentMethod) else sub.payment_method,
        current_period_end=sub.current_period_end.isoformat() if sub.current_period_end else None,
        cancel_at_period_end=sub.cancel_at_period_end,
        daily_ticks_limit=tier_cfg.max_ticks_per_day,
        model_name=tier_cfg.model,
    )


@router.post("/checkout")
async def create_checkout(
    req: CheckoutRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout session for subscribing to a paid tier."""
    if req.tier not in ("wanderer", "predator", "apex"):
        raise HTTPException(status_code=400, detail="Invalid tier. Choose wanderer, predator, or apex.")

    sub = await _get_or_create_subscription(user.id, session)

    session_obj = stripe_service.create_checkout_session(
        user_id=user.id,
        user_email=user.email,
        tier=req.tier,
        success_url=req.success_url,
        cancel_url=req.cancel_url,
        stripe_customer_id=sub.stripe_customer_id,
    )
    return {"checkout_url": session_obj.url}


@router.post("/portal")
async def create_portal(
    req: PortalRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Create a Stripe Customer Portal session."""
    sub = await _get_or_create_subscription(user.id, session)
    if not sub.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer linked. Subscribe first.")

    portal = stripe_service.create_portal_session(sub.stripe_customer_id, req.return_url)
    return {"portal_url": portal.url}


@router.post("/change-tier")
async def change_tier(
    req: ChangeTierRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Upgrade or downgrade subscription tier."""
    if req.new_tier not in ("explorer", "wanderer", "predator", "apex"):
        raise HTTPException(status_code=400, detail="Invalid tier.")

    sub = await _get_or_create_subscription(user.id, session)

    # Downgrade to explorer = cancel Stripe
    if req.new_tier == "explorer":
        if sub.stripe_subscription_id:
            stripe_service.cancel_subscription(sub.stripe_subscription_id)
        sub.tier = SubscriptionTier.explorer
        sub.cancel_at_period_end = True
        await _update_agent_config_for_tier(session, user.id, "explorer")
        await session.commit()
        return {"status": "downgraded", "tier": "explorer"}

    # Upgrade/change paid tier
    if sub.stripe_subscription_id:
        stripe_service.change_subscription_tier(sub.stripe_subscription_id, req.new_tier)
        sub.tier = SubscriptionTier(req.new_tier)
        await _update_agent_config_for_tier(session, user.id, req.new_tier)
        await session.commit()
        return {"status": "changed", "tier": req.new_tier}

    raise HTTPException(status_code=400, detail="No active subscription to change. Use /checkout first.")


# ──── Redis for webhook idempotency ────

_webhook_redis = None

async def _get_webhook_redis():
    global _webhook_redis
    if _webhook_redis is None:
        _webhook_redis = aioredis.from_url(get_settings().redis_url)
    return _webhook_redis


async def _update_agent_config_for_tier(session: AsyncSession, user_id: str, tier: str):
    """Update AgentConfig to match subscription tier."""
    result = await session.execute(
        select(AgentConfig).where(AgentConfig.user_id == user_id)
    )
    agent_config = result.scalar_one_or_none()
    if agent_config:
        agent_config.subscription_tier = tier
        agent_config.uses_platform_key = True
        agent_config.daily_ticks_remaining = TIER_CONFIG[tier].max_ticks_per_day


@router.post("/webhook")
async def stripe_webhook(request: Request, session: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events with idempotency protection."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe_service.construct_webhook_event(payload, sig_header)
    except Exception as e:
        logger.error(f"Stripe webhook verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    # Idempotency: skip already-processed events
    event_id = event["id"]
    r = await _get_webhook_redis()
    if await r.sismember("stripe_events_processed", event_id):
        logger.info(f"Webhook event {event_id} already processed, skipping")
        return {"status": "already_processed"}

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        user_id = data["metadata"]["user_id"]
        tier = data["metadata"]["tier"]
        # Validate tier against known values
        if tier not in ("explorer", "wanderer", "predator", "apex"):
            logger.warning(f"Invalid tier in webhook metadata: {tier}")
            return {"status": "invalid_tier"}

        stripe_customer_id = data["customer"]
        stripe_subscription_id = data["subscription"]

        sub = await _get_or_create_subscription(user_id, session)
        sub.tier = SubscriptionTier(tier)
        sub.status = SubscriptionStatus.active
        sub.payment_method = PaymentMethod.stripe
        sub.stripe_customer_id = stripe_customer_id
        sub.stripe_subscription_id = stripe_subscription_id
        # Use Stripe's actual period data
        sub.current_period_start = datetime.utcnow()
        period_end = data.get("current_period_end")
        sub.current_period_end = datetime.fromtimestamp(period_end) if period_end else datetime.utcnow() + timedelta(days=30)
        sub.cancel_at_period_end = False

        await _update_agent_config_for_tier(session, user_id, tier)
        await session.commit()
        logger.info(f"Subscription activated: user={user_id} tier={tier}")

    elif event_type == "invoice.paid":
        stripe_subscription_id = data.get("subscription")
        if stripe_subscription_id:
            result = await session.execute(
                select(Subscription).where(Subscription.stripe_subscription_id == stripe_subscription_id)
            )
            sub = result.scalar_one_or_none()
            if sub:
                sub.status = SubscriptionStatus.active
                # Use Stripe's actual period
                period_start = data.get("period_start")
                period_end = data.get("period_end")
                sub.current_period_start = datetime.fromtimestamp(period_start) if period_start else datetime.utcnow()
                sub.current_period_end = datetime.fromtimestamp(period_end) if period_end else datetime.utcnow() + timedelta(days=30)
                await session.commit()
                logger.info(f"Subscription renewed: {stripe_subscription_id}")

    elif event_type == "invoice.payment_failed":
        stripe_subscription_id = data.get("subscription")
        if stripe_subscription_id:
            result = await session.execute(
                select(Subscription).where(Subscription.stripe_subscription_id == stripe_subscription_id)
            )
            sub = result.scalar_one_or_none()
            if sub:
                sub.status = SubscriptionStatus.past_due
                await session.commit()
                logger.warning(f"Payment failed: {stripe_subscription_id}")

    elif event_type == "customer.subscription.deleted":
        stripe_subscription_id = data.get("id")
        if stripe_subscription_id:
            result = await session.execute(
                select(Subscription).where(Subscription.stripe_subscription_id == stripe_subscription_id)
            )
            sub = result.scalar_one_or_none()
            if sub:
                sub.tier = SubscriptionTier.explorer
                sub.status = SubscriptionStatus.active
                sub.stripe_subscription_id = None
                sub.cancel_at_period_end = False
                await _update_agent_config_for_tier(session, sub.user_id, "explorer")
                await session.commit()
                logger.info(f"Subscription cancelled, downgraded to explorer: {stripe_subscription_id}")

    # Mark event as processed (TTL 48h)
    await r.sadd("stripe_events_processed", event_id)
    await r.expire("stripe_events_processed", 172800)

    return {"status": "ok"}
