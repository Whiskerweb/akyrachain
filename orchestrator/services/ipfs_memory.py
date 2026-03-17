"""IPFS-backed agent memory snapshots with on-chain memoryRoot anchoring."""

import hashlib
import json
import logging

import httpx

from config import get_settings
from core.memory import memory_manager
from chain import tx_manager

logger = logging.getLogger(__name__)


async def compute_memory_hash(agent_id: int) -> bytes:
    """Compute incremental keccak256 hash of all agent memories from Qdrant.

    Queries all memories for the agent, sorts by creation order,
    and computes a rolling keccak256 hash of their contents.
    Returns a 32-byte hash suitable for on-chain anchoring.
    """
    # Retrieve all memories (use a broad query to get everything)
    memories = await memory_manager.recall(
        agent_id=agent_id,
        query="*",
        top_k=10_000,  # Get all memories
    )

    # Sort by score (creation order proxy) for deterministic hashing
    memories.sort(key=lambda m: m.get("id", ""))

    # Incremental keccak256
    h = hashlib.sha3_256()  # keccak256
    for mem in memories:
        content = mem.get("content", "")
        if isinstance(content, str):
            content = content.encode("utf-8")
        h.update(content)

    return h.digest()


async def pin_memory_snapshot(agent_id: int, memories: list[dict]) -> str:
    """Pin a memory snapshot to IPFS via Pinata API.

    If IPFS is not enabled, returns an empty string.
    Packages memories as JSON, pins to Pinata, returns the IPFS CID.
    """
    settings = get_settings()
    if not settings.ipfs_enabled:
        return ""

    if not settings.ipfs_api_key or not settings.ipfs_api_secret:
        logger.warning("IPFS enabled but no Pinata API credentials configured")
        return ""

    payload = {
        "pinataContent": {
            "agent_id": agent_id,
            "memory_count": len(memories),
            "memories": memories,
        },
        "pinataMetadata": {
            "name": f"akyra-agent-{agent_id}-memory-snapshot",
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{settings.ipfs_gateway_url}/pinning/pinJSONToIPFS",
            headers={
                "pinata_api_key": settings.ipfs_api_key,
                "pinata_secret_api_key": settings.ipfs_api_secret,
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    cid = data.get("IpfsHash", "")
    logger.info(f"Agent #{agent_id} memory snapshot pinned to IPFS: {cid}")
    return cid


async def anchor_memory_root(agent_id: int) -> None:
    """Compute memory hash, pin snapshot to IPFS, and anchor on-chain.

    Steps:
    1. Compute keccak256 hash of all agent memories
    2. Pin snapshot to IPFS (if enabled)
    3. Call tx_manager.update_memory_root() to store hash on-chain
    """
    # 1. Compute hash
    memory_hash = await compute_memory_hash(agent_id)
    logger.info(
        f"Agent #{agent_id} memory hash: 0x{memory_hash.hex()[:16]}..."
    )

    # 2. Pin to IPFS (best-effort)
    try:
        memories = await memory_manager.recall(
            agent_id=agent_id,
            query="*",
            top_k=10_000,
        )
        cid = await pin_memory_snapshot(agent_id, memories)
        if cid:
            logger.info(f"Agent #{agent_id} IPFS CID: {cid}")
    except Exception as e:
        logger.warning(f"IPFS pinning failed for agent #{agent_id}: {e}")

    # 3. Anchor on-chain
    tx_hash = await tx_manager.update_memory_root(agent_id, memory_hash)
    logger.info(
        f"Agent #{agent_id} memoryRoot anchored on-chain: {tx_hash}"
    )
