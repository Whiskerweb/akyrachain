"""Perception builder — loads on-chain state for an agent's tick."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from web3 import AsyncWeb3

from chain.contracts import (
    get_agent_on_chain,
    get_current_block,
    Contracts,
)

logger = logging.getLogger(__name__)

# Tier thresholds in wei (1 AKY = 1e18 wei)
AKY = 10**18
TIER_THRESHOLDS = [
    (4, 5000 * AKY),   # T4: >5000 AKY
    (3, 500 * AKY),    # T3: 500-5000
    (2, 50 * AKY),     # T2: 50-500
    (1, 0),             # T1: <50
]


def _vault_to_tier(vault_wei: int) -> int:
    for tier, threshold in TIER_THRESHOLDS:
        if vault_wei >= threshold:
            return tier
    return 1


def _wei_to_aky(wei: int) -> float:
    return wei / AKY


@dataclass
class Perception:
    """Snapshot of what an agent perceives at tick time."""
    agent_id: int
    block_number: int
    vault_wei: int
    vault_aky: float
    tier: int
    world: int
    reputation: int
    contracts_honored: int
    contracts_broken: int
    daily_work_points: int
    alive: bool
    season_info: str | None = None
    nearby_agents: list[dict] = field(default_factory=list)
    recent_events: list[str] = field(default_factory=list)

    @property
    def summary(self) -> str:
        """One-line summary used as Qdrant query for memory recall."""
        return (
            f"Agent #{self.agent_id} in world {self.world}, "
            f"{self.vault_aky:.1f} AKY, tier T{self.tier}, "
            f"rep {self.reputation}, block {self.block_number}"
        )


async def build_perception(agent_id: int) -> Perception:
    """Build the full perception for an agent tick."""
    # 1. Core agent state
    agent = await get_agent_on_chain(agent_id)
    block = await get_current_block()

    vault_wei = agent["vault"]
    vault_aky = _wei_to_aky(vault_wei)
    tier = _vault_to_tier(vault_wei)

    if not agent["alive"]:
        raise AgentDeadError(f"Agent #{agent_id} is dead — cannot tick")

    # 2. Season info
    season_info = await _get_season_info()

    # 3. Nearby agents (same world)
    nearby = await _get_nearby_agents(agent_id, agent["world"])

    # 4. Recent events in world (from on-chain or DB — simplified: empty for now, filled by event_listener later)
    recent_events: list[str] = []

    return Perception(
        agent_id=agent_id,
        block_number=block,
        vault_wei=vault_wei,
        vault_aky=vault_aky,
        tier=tier,
        world=agent["world"],
        reputation=agent["reputation"],
        contracts_honored=agent["contracts_honored"],
        contracts_broken=agent["contracts_broken"],
        daily_work_points=agent["daily_work_points"],
        alive=agent["alive"],
        season_info=season_info,
        nearby_agents=nearby,
        recent_events=recent_events,
    )


async def _get_season_info() -> str | None:
    """Get current season info from WorldManager."""
    try:
        wm = Contracts.world_manager()
        season_type = await wm.functions.activeSeasonType().call()
        season_ends = await wm.functions.seasonEndsAt().call()
        block = await get_current_block()

        if block >= season_ends:
            return None

        season_names = {0: "Aucune", 1: "Gold Rush (3x rewards)", 2: "Catastrophe", 3: "New Land"}
        name = season_names.get(season_type, f"Type {season_type}")
        blocks_left = season_ends - block
        return f"{name} — {blocks_left} blocs restants"
    except Exception as e:
        logger.warning(f"Could not fetch season info: {e}")
        return None


async def _get_nearby_agents(exclude_id: int, world: int) -> list[dict]:
    """Get agents in the same world (limited to 20 for prompt size)."""
    try:
        registry = Contracts.agent_registry()
        next_id = await registry.functions.nextAgentId().call()

        nearby: list[dict] = []
        for aid in range(1, min(next_id, 200)):  # Cap scan at 200 agents for perf
            if aid == exclude_id:
                continue
            try:
                agent = await get_agent_on_chain(aid)
                if agent["alive"] and agent["world"] == world:
                    nearby.append({
                        "agent_id": aid,
                        "vault_aky": _wei_to_aky(agent["vault"]),
                        "reputation": agent["reputation"],
                    })
            except Exception:
                continue

            if len(nearby) >= 20:
                break

        return nearby
    except Exception as e:
        logger.warning(f"Could not fetch nearby agents: {e}")
        return []


class AgentDeadError(Exception):
    """Raised when trying to tick a dead agent."""
    pass
