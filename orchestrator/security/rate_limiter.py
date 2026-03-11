"""Simple Redis-based rate limiter."""

from __future__ import annotations

import time

import redis.asyncio as aioredis
from fastapi import HTTPException, Request

from config import get_settings

_redis: aioredis.Redis | None = None


async def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(get_settings().redis_url)
    return _redis


async def check_rate_limit(request: Request):
    """FastAPI dependency — enforces per-IP rate limiting."""
    settings = get_settings()
    client_ip = request.client.host if request.client else "unknown"
    key = f"ratelimit:{client_ip}"

    r = await _get_redis()
    current = await r.get(key)

    if current and int(current) >= settings.rate_limit_per_minute:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in 1 minute.")

    pipe = r.pipeline()
    pipe.incr(key)
    pipe.expire(key, 60)
    await pipe.execute()
