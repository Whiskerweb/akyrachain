"""Redis cache layer for on-chain reads — eliminates N+1 RPC calls."""

import asyncio
import json
import logging

import redis.asyncio as aioredis

from config import get_settings

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None

# TTLs in seconds
AGENT_TTL = 10        # Agent data refreshes every 10s
IDEA_TTL = 15         # Idea likes refresh every 15s
BLOCK_TTL = 3         # Current block number
BALANCE_TTL = 10      # Address balances


async def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(get_settings().redis_url, decode_responses=True)
    return _redis


# ──── Agent cache ────

async def get_agent_cached(agent_id: int) -> dict:
    """Get agent from Redis cache, fallback to chain RPC."""
    r = await _get_redis()
    key = f"agent:{agent_id}"

    cached = await r.get(key)
    if cached is not None:
        return json.loads(cached)

    # Cache miss — call chain
    from chain.contracts import get_agent_on_chain
    agent = await get_agent_on_chain(agent_id)
    await r.set(key, json.dumps(agent), ex=AGENT_TTL)
    return agent


async def get_agents_cached(agent_ids: list[int]) -> list[dict]:
    """Batch fetch agents — parallel cache lookups + parallel RPC for misses."""
    if not agent_ids:
        return []

    r = await _get_redis()
    keys = [f"agent:{aid}" for aid in agent_ids]
    cached_values = await r.mget(keys)

    results: dict[int, dict] = {}
    missing_ids: list[int] = []

    for aid, cached in zip(agent_ids, cached_values):
        if cached is not None:
            results[aid] = json.loads(cached)
        else:
            missing_ids.append(aid)

    # Parallel RPC for all cache misses
    if missing_ids:
        from chain.contracts import get_agent_on_chain

        async def _fetch_and_cache(aid: int) -> tuple[int, dict | None]:
            try:
                agent = await get_agent_on_chain(aid)
                await r.set(f"agent:{aid}", json.dumps(agent), ex=AGENT_TTL)
                return aid, agent
            except Exception:
                return aid, None

        fetched = await asyncio.gather(*[_fetch_and_cache(aid) for aid in missing_ids])
        for aid, agent in fetched:
            if agent is not None:
                results[aid] = agent

    # Return in original order
    return [results[aid] for aid in agent_ids if aid in results]


async def get_agents_cached_map(agent_ids: list[int]) -> dict[int, dict]:
    """Like get_agents_cached but returns {agent_id: data} dict."""
    agents = await get_agents_cached(agent_ids)
    return {a["agent_id"]: a for a in agents}


# ──── Idea cache ────

async def get_idea_cached(idea_id: int) -> tuple:
    """Get idea from Redis cache, fallback to chain RPC."""
    r = await _get_redis()
    key = f"idea:{idea_id}"

    cached = await r.get(key)
    if cached is not None:
        return tuple(json.loads(cached))

    from chain.contracts import Contracts
    marketplace = Contracts.network_marketplace()
    on_chain = await marketplace.functions.getIdea(idea_id).call()
    await r.set(key, json.dumps(list(on_chain)), ex=IDEA_TTL)
    return on_chain


async def get_ideas_cached(idea_ids: list[int]) -> dict[int, tuple]:
    """Batch fetch ideas — parallel cache lookups + parallel RPC for misses."""
    if not idea_ids:
        return {}

    r = await _get_redis()
    keys = [f"idea:{iid}" for iid in idea_ids]
    cached_values = await r.mget(keys)

    results: dict[int, tuple] = {}
    missing_ids: list[int] = []

    for iid, cached in zip(idea_ids, cached_values):
        if cached is not None:
            results[iid] = tuple(json.loads(cached))
        else:
            missing_ids.append(iid)

    if missing_ids:
        from chain.contracts import Contracts
        marketplace = Contracts.network_marketplace()

        async def _fetch_idea(iid: int) -> tuple[int, tuple | None]:
            try:
                on_chain = await marketplace.functions.getIdea(iid).call()
                await r.set(f"idea:{iid}", json.dumps(list(on_chain)), ex=IDEA_TTL)
                return iid, tuple(on_chain)
            except Exception:
                return iid, None

        fetched = await asyncio.gather(*[_fetch_idea(iid) for iid in missing_ids])
        for iid, data in fetched:
            if data is not None:
                results[iid] = data

    return results


# ──── Invalidation ────

async def invalidate_agent(agent_id: int) -> None:
    """Call after writing a TX that modifies agent state."""
    r = await _get_redis()
    await r.delete(f"agent:{agent_id}")


async def invalidate_agents(agent_ids: list[int]) -> None:
    """Batch invalidate multiple agents."""
    if not agent_ids:
        return
    r = await _get_redis()
    await r.delete(*[f"agent:{aid}" for aid in agent_ids])


async def invalidate_idea(idea_id: int) -> None:
    r = await _get_redis()
    await r.delete(f"idea:{idea_id}")


async def invalidate_all_agents() -> None:
    """Flush all agent cache entries (e.g., after season reset)."""
    r = await _get_redis()
    cursor = 0
    while True:
        cursor, keys = await r.scan(cursor, match="agent:*", count=100)
        if keys:
            await r.delete(*keys)
        if cursor == 0:
            break
