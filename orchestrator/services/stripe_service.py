"""Stripe integration — checkout sessions, customer portal, webhook handling."""

from __future__ import annotations

import logging
from typing import Optional

import stripe

from config import get_settings

logger = logging.getLogger(__name__)

# Tier → Stripe Price ID mapping (set in .env)
TIER_PRICE_MAP: dict[str, str] = {}


def _init_stripe() -> None:
    """Initialize Stripe SDK with API key."""
    settings = get_settings()
    stripe.api_key = settings.stripe_secret_key
    global TIER_PRICE_MAP
    TIER_PRICE_MAP = {
        "wanderer": settings.stripe_price_wanderer,
        "predator": settings.stripe_price_predator,
        "apex": settings.stripe_price_apex,
    }


def create_checkout_session(
    user_id: str,
    user_email: str,
    tier: str,
    success_url: str,
    cancel_url: str,
    stripe_customer_id: Optional[str] = None,
) -> stripe.checkout.Session:
    """Create a Stripe Checkout Session for a subscription."""
    _init_stripe()

    price_id = TIER_PRICE_MAP.get(tier)
    if not price_id or not price_id.strip():
        raise ValueError(f"No Stripe price configured for tier: {tier}")

    params: dict = {
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {"user_id": user_id, "tier": tier},
    }

    if stripe_customer_id:
        params["customer"] = stripe_customer_id
    else:
        params["customer_email"] = user_email

    session = stripe.checkout.Session.create(**params)
    logger.info(f"Created checkout session {session.id} for user {user_id} tier {tier}")
    return session


def create_portal_session(stripe_customer_id: str, return_url: str) -> stripe.billing_portal.Session:
    """Create a Stripe Customer Portal session for managing subscriptions."""
    _init_stripe()
    session = stripe.billing_portal.Session.create(
        customer=stripe_customer_id,
        return_url=return_url,
    )
    return session


def construct_webhook_event(payload: bytes, sig_header: str) -> stripe.Event:
    """Verify and construct a Stripe webhook event."""
    settings = get_settings()
    return stripe.Webhook.construct_event(
        payload, sig_header, settings.stripe_webhook_secret
    )


def cancel_subscription(stripe_subscription_id: str) -> stripe.Subscription:
    """Cancel a Stripe subscription at period end."""
    _init_stripe()
    return stripe.Subscription.modify(
        stripe_subscription_id,
        cancel_at_period_end=True,
    )


def change_subscription_tier(stripe_subscription_id: str, new_tier: str) -> stripe.Subscription:
    """Change the tier (price) of an existing Stripe subscription."""
    _init_stripe()
    price_id = TIER_PRICE_MAP.get(new_tier)
    if not price_id:
        raise ValueError(f"No Stripe price configured for tier: {new_tier}")

    sub = stripe.Subscription.retrieve(stripe_subscription_id)
    return stripe.Subscription.modify(
        stripe_subscription_id,
        items=[{"id": sub["items"]["data"][0].id, "price": price_id}],
        proration_behavior="create_prorations",
    )
