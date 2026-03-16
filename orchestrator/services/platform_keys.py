"""Platform API key management — maps subscription tiers to LLM providers."""

from __future__ import annotations

from dataclasses import dataclass
from config import get_settings


@dataclass(frozen=True)
class TierConfig:
    provider: str
    model: str
    max_ticks_per_day: int
    tick_interval_seconds: int
    daily_aky_deposit: int  # in AKY (not wei)


TIER_CONFIG: dict[str, TierConfig] = {
    "explorer": TierConfig(
        provider="deepinfra",
        model="meta-llama/Llama-3.1-8B-Instruct",
        max_ticks_per_day=6,
        tick_interval_seconds=14400,  # 4h
        daily_aky_deposit=50,
    ),
    "wanderer": TierConfig(
        provider="openai",
        model="gpt-4.1-mini",
        max_ticks_per_day=72,
        tick_interval_seconds=900,  # 15min
        daily_aky_deposit=500,
    ),
    "predator": TierConfig(
        provider="openai",
        model="gpt-4o",
        max_ticks_per_day=144,
        tick_interval_seconds=600,  # 10min
        daily_aky_deposit=2000,
    ),
    "apex": TierConfig(
        provider="anthropic",
        model="claude-sonnet-4-6",
        max_ticks_per_day=200,
        tick_interval_seconds=432,  # ~7min
        daily_aky_deposit=5000,
    ),
}

# Fallback models when primary provider is down
TIER_FALLBACK: dict[str, TierConfig] = {
    "explorer": TierConfig(
        provider="deepinfra",
        model="meta-llama/Llama-3.1-8B-Instruct",
        max_ticks_per_day=6,
        tick_interval_seconds=14400,
        daily_aky_deposit=50,
    ),
    "wanderer": TierConfig(
        provider="deepinfra",
        model="meta-llama/Llama-3.3-70B-Instruct",
        max_ticks_per_day=72,
        tick_interval_seconds=900,
        daily_aky_deposit=500,
    ),
    "predator": TierConfig(
        provider="deepinfra",
        model="meta-llama/Llama-3.3-70B-Instruct",
        max_ticks_per_day=144,
        tick_interval_seconds=600,
        daily_aky_deposit=2000,
    ),
    "apex": TierConfig(
        provider="openai",
        model="gpt-4o",
        max_ticks_per_day=200,
        tick_interval_seconds=432,
        daily_aky_deposit=5000,
    ),
}


def get_tier_config(tier: str) -> TierConfig:
    """Get the LLM config for a subscription tier."""
    return TIER_CONFIG[tier]


def get_tier_fallback(tier: str) -> TierConfig:
    """Get the fallback LLM config for a subscription tier."""
    return TIER_FALLBACK[tier]


def get_platform_key(provider: str) -> str:
    """Get the platform API key for a given LLM provider."""
    settings = get_settings()
    key_map = {
        "openai": settings.platform_openai_key,
        "anthropic": settings.platform_anthropic_key,
        "deepinfra": settings.platform_deepinfra_key,
    }
    key = key_map.get(provider)
    if not key:
        raise ValueError(f"No platform API key configured for provider: {provider}")
    return key
