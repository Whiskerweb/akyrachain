"""AKYRA Orchestrator configuration — loaded from environment variables."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ──── Chain ────
    chain_rpc_url: str = "http://35.233.51.51:8545"
    chain_id: int = 47197
    orchestrator_private_key: str = ""

    # ──── Contract addresses ────
    agent_registry_address: str = ""
    sponsor_gateway_address: str = ""
    fee_router_address: str = ""
    reward_pool_address: str = ""
    akyra_swap_address: str = ""
    world_manager_address: str = ""
    forge_factory_address: str = ""
    escrow_manager_address: str = ""
    death_angel_address: str = ""
    network_marketplace_address: str = ""
    work_registry_address: str = ""
    clan_factory_address: str = ""
    gas_treasury_address: str = ""
    akyra_paymaster_address: str = ""

    # ──── Message encryption ────
    orchestrator_master_secret: str = "0" * 64  # 32 bytes hex, change in prod

    # ──── Database ────
    database_url: str = "postgresql+asyncpg://akyra:akyra_dev@localhost:5432/akyra"

    # ──── Redis ────
    redis_url: str = "redis://localhost:6379/0"

    # ──── Qdrant ────
    qdrant_url: str = "http://localhost:6333"

    # ──── Auth ────
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
    jwt_refresh_days: int = 7

    # ──── Death Angel LLM ────
    angel_llm_provider: str = "openai"
    angel_llm_api_key: str = ""
    angel_llm_model: str = "gpt-4o"

    # ──── Encryption ────
    api_key_encryption_key: str = "0" * 64  # 32 bytes hex, change in prod

    # ──── Faucet ────
    faucet_enabled: bool = True
    faucet_amount_wei: str = "1000000000000000000000"  # 1000 AKY

    # ──── v2 Economy ────
    launch_date: str = "2026-03-15T00:00:00"
    treasury_daily_base: float = 50000.0
    treasury_decay_rate: float = 0.997
    velocity_target: float = 0.05

    # ──── Twitter/X API ────
    twitter_api_key: str = ""
    twitter_api_secret: str = ""
    twitter_access_token: str = ""
    twitter_access_secret: str = ""

    # ──── Platform LLM keys (managed subscriptions) ────
    platform_openai_key: str = ""
    platform_anthropic_key: str = ""
    platform_deepinfra_key: str = ""

    # ──── Stripe ────
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_wanderer: str = ""  # Stripe Price ID for Wanderer tier
    stripe_price_predator: str = ""  # Stripe Price ID for Predator tier
    stripe_price_apex: str = ""  # Stripe Price ID for Apex tier

    # ──── Rate limiting ────
    rate_limit_per_minute: int = 60

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
