"""Resource engine — production, diminishing returns, adjacency bonuses, zone bonuses, land tax.

Implements the 3-resource system from mvp4.md:
- MAT (Materials) — produced by farms, mines
- INF (Influence) — produced by markets, embassies, monuments
- SAV (Knowledge) — produced by workshops, libraries
"""

from __future__ import annotations

import logging
import math
from collections import Counter
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.world_tile import WorldTile
from models.agent_resources import AgentResources
from chain import tx_manager

logger = logging.getLogger(__name__)

# ──── Structure production (base per tick) ────

STRUCTURE_PRODUCTION: dict[str, dict[str, int]] = {
    "farm":        {"mat": 2},
    "mine":        {"mat": 4},
    "market":      {"inf": 3},
    "workshop":    {"sav": 2},
    "library":     {"sav": 4},
    "embassy":     {"inf": 3},
    "monument":    {"inf": 1},  # Prestige, not production-focused
    "bank":        {},  # Special: AKY yield bonus
    "watchtower":  {},
    "wall":        {},
    "road":        {},
    "habitat":     {},
    "fortress":    {},
    "clan_hq":     {},
}

# ──── Zone bonuses (multipliers) ────

ZONE_BONUSES: dict[int, dict[str, float]] = {
    0: {"mat": 1.0, "inf": 1.0, "sav": 1.0, "cost_mult": 0.5},     # Nursery: -50% costs
    1: {"mat": 1.0, "inf": 1.5, "sav": 1.0, "cost_mult": 1.0},     # Agora: +50% INF
    2: {"mat": 1.3, "inf": 1.2, "sav": 1.0, "cost_mult": 1.0},     # Bazar: +30% MAT, +20% INF
    3: {"mat": 1.5, "inf": 1.0, "sav": 1.1, "cost_mult": 1.0},     # Forge: +50% MAT, +10% SAV
    4: {"mat": 1.0, "inf": 1.0, "sav": 1.0, "aky_mult": 1.3},      # Banque: +30% AKY passif
    5: {"mat": 1.0, "inf": 1.0, "sav": 1.5, "cost_mult": 1.0},     # Noir: +50% SAV
    6: {"mat": 1.0, "inf": 2.0, "sav": 1.0, "cost_mult": 1.0},     # Sommet: +100% INF
}

# ──── Adjacency bonuses ────

ADJACENCY_BONUSES: dict[tuple[str, str], float] = {
    ("farm", "market"):       0.25,   # Farm next to Market: +25%
    ("workshop", "library"):  0.30,   # Workshop next to Library: +30%
    ("watchtower", "wall"):   0.40,   # Tower next to Wall: +40% defense
    ("market", "road"):       0.20,   # Market next to Road: +20%
    ("farm", "road"):         0.10,   # Farm next to Road: +10%
    # Any structure next to clan_hq: +15% (handled specially)
}

# ──── Structure prerequisites ────

STRUCTURE_PREREQUISITES: dict[str, dict[str, int]] = {
    "market":     {"farm": 1},
    "workshop":   {"farm": 1, "market": 1},
    "library":    {"workshop": 1},
    "embassy":    {"market": 1},
    "bank":       {"market": 1, "workshop": 1},
    "monument":   {"farm": 1, "market": 1, "workshop": 1},
    "fortress":   {"watchtower": 2},
    "clan_hq":    {},  # Requires 5 different structure types (special check)
}

# ──── Structure costs (AKY + resources) ────

STRUCTURE_COSTS_FULL: dict[str, dict] = {
    "farm":       {"aky": 3,  "mat": 0,  "inf": 0, "sav": 0},
    "mine":       {"aky": 8,  "mat": 0,  "inf": 0, "sav": 0},
    "market":     {"aky": 10, "mat": 20, "inf": 0, "sav": 0},
    "workshop":   {"aky": 15, "mat": 30, "inf": 0, "sav": 0},
    "library":    {"aky": 20, "mat": 40, "inf": 10, "sav": 0},
    "embassy":    {"aky": 12, "mat": 0,  "inf": 20, "sav": 0},
    "watchtower": {"aky": 15, "mat": 25, "inf": 0, "sav": 0},
    "wall":       {"aky": 5,  "mat": 15, "inf": 0, "sav": 0},
    "fortress":   {"aky": 40, "mat": 60, "inf": 20, "sav": 0},
    "monument":   {"aky": 50, "mat": 30, "inf": 30, "sav": 30},
    "bank":       {"aky": 30, "mat": 40, "inf": 0, "sav": 20},
    "road":       {"aky": 1,  "mat": 5,  "inf": 0, "sav": 0},
    "habitat":    {"aky": 2,  "mat": 0,  "inf": 0, "sav": 0},
    "clan_hq":    {"aky": 50, "mat": 50, "inf": 50, "sav": 50},
}

# Resource costs for actions
ACTION_RESOURCE_COSTS: dict[str, dict[str, int]] = {
    "claim_tile":   {"inf": 5},      # Claiming requires influence
    "create_token": {"sav": 30},     # Creating token requires knowledge
    "create_nft":   {"sav": 15},     # Creating NFT requires knowledge
    "upgrade":      {"mat": 10},     # Upgrading requires materials (base, scales with level)
}


def _adjacent_coords(x: int, y: int) -> list[tuple[int, int]]:
    coords = []
    for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        nx, ny = x + dx, y + dy
        if 0 <= nx < 200 and 0 <= ny < 200:
            coords.append((nx, ny))
    return coords


def _diminishing_returns(base_production: float, count_of_type: int) -> float:
    """Apply diminishing returns formula from mvp4.md.

    production_effective = base × (1 / (1 + 0.15 × (count - 1)))
    """
    if count_of_type <= 1:
        return base_production
    return base_production / (1 + 0.15 * (count_of_type - 1))


async def produce_resources(agent_id: int, db: AsyncSession) -> dict[str, int]:
    """Calculate and credit resource production for one tick.

    Called during each tick to produce MAT/INF/SAV based on:
    1. Structures owned and their levels
    2. Diminishing returns per structure type
    3. Zone bonuses
    4. Adjacency bonuses

    Returns dict of produced resources {"mat": X, "inf": Y, "sav": Z}.
    """
    # Load all tiles owned by agent
    result = await db.execute(
        select(WorldTile).where(WorldTile.owner_agent_id == agent_id)
    )
    tiles = result.scalars().all()

    if not tiles:
        return {"mat": 0, "inf": 0, "sav": 0}

    # Build a map of (x,y) -> tile for adjacency lookups
    tile_map: dict[tuple[int, int], WorldTile] = {(t.x, t.y): t for t in tiles}

    # Count structures by type (for diminishing returns)
    type_counter: Counter[str] = Counter()
    for t in tiles:
        if t.structure:
            type_counter[t.structure] += 1

    # Track running count per type (for nth-structure diminishing returns)
    type_nth: Counter[str] = Counter()

    total_production = {"mat": 0.0, "inf": 0.0, "sav": 0.0}

    for tile in tiles:
        if not tile.structure:
            continue

        struct = tile.structure
        level = tile.structure_level or 1
        base_prod = STRUCTURE_PRODUCTION.get(struct, {})

        if not base_prod:
            continue

        type_nth[struct] += 1

        for resource, base_amount in base_prod.items():
            # 1. Level multiplier (production scales with level)
            production = base_amount * level

            # 2. Diminishing returns based on how many of this type
            production = _diminishing_returns(production, type_nth[struct])

            # 3. Zone bonus
            zone = tile.world_zone
            zone_bonus = ZONE_BONUSES.get(zone, {}).get(resource, 1.0)
            production *= zone_bonus

            # 4. Adjacency bonuses
            adj_bonus = 0.0
            for ax, ay in _adjacent_coords(tile.x, tile.y):
                adj_tile = tile_map.get((ax, ay))
                if adj_tile and adj_tile.structure:
                    # Check both directions of adjacency
                    bonus = ADJACENCY_BONUSES.get((struct, adj_tile.structure), 0)
                    if bonus == 0:
                        bonus = ADJACENCY_BONUSES.get((adj_tile.structure, struct), 0)
                    adj_bonus = max(adj_bonus, bonus)  # Take best bonus, don't stack

                    # Clan HQ bonus
                    if adj_tile.structure == "clan_hq":
                        adj_bonus = max(adj_bonus, 0.15)

            production *= (1 + adj_bonus)

            total_production[resource] += production

    # Round to integers
    produced = {
        "mat": int(total_production["mat"]),
        "inf": int(total_production["inf"]),
        "sav": int(total_production["sav"]),
    }

    # Credit resources to agent
    await _credit_resources(agent_id, produced, db)

    return produced


async def _credit_resources(agent_id: int, produced: dict[str, int], db: AsyncSession):
    """Credit produced resources on-chain first, then update DB cache."""
    mat = produced.get("mat", 0)
    inf = produced.get("inf", 0)
    sav = produced.get("sav", 0)

    if mat > 0 or inf > 0 or sav > 0:
        # On-chain first
        await tx_manager.credit_resources_onchain(agent_id, mat, inf, sav)

    # DB cache
    result = await db.execute(
        select(AgentResources).where(AgentResources.agent_id == agent_id)
    )
    resources = result.scalar_one_or_none()

    if resources is None:
        resources = AgentResources(
            agent_id=agent_id,
            materials=mat,
            influence=inf,
            knowledge=sav,
        )
        db.add(resources)
    else:
        resources.materials += mat
        resources.influence += inf
        resources.knowledge += sav
        resources.updated_at = datetime.utcnow()


async def get_agent_resources(agent_id: int, db: AsyncSession) -> dict[str, int]:
    """Get current resource levels for an agent."""
    result = await db.execute(
        select(AgentResources).where(AgentResources.agent_id == agent_id)
    )
    resources = result.scalar_one_or_none()

    if resources is None:
        return {"mat": 0, "inf": 0, "sav": 0}

    return {
        "mat": resources.materials,
        "inf": resources.influence,
        "sav": resources.knowledge,
    }


async def deduct_resources(agent_id: int, costs: dict[str, int], db: AsyncSession, on_chain: bool = False) -> bool:
    """Deduct resources from agent. Returns False if insufficient.

    If on_chain=True, also debit on-chain via ResourceLedger (use when the caller
    hasn't already done the on-chain debit itself).
    """
    mat_cost = costs.get("mat", 0)
    inf_cost = costs.get("inf", 0)
    sav_cost = costs.get("sav", 0)

    if not any(v > 0 for v in (mat_cost, inf_cost, sav_cost)):
        return True

    result = await db.execute(
        select(AgentResources).where(AgentResources.agent_id == agent_id)
    )
    resources = result.scalar_one_or_none()

    if resources is None:
        return False

    if resources.materials < mat_cost or resources.influence < inf_cost or resources.knowledge < sav_cost:
        return False

    # On-chain debit if requested
    if on_chain:
        try:
            await tx_manager.debit_resources_onchain(agent_id, mat_cost, inf_cost, sav_cost)
        except Exception as e:
            logger.error(f"On-chain debit_resources failed for agent #{agent_id}: {e}")
            return False

    # DB cache update
    resources.materials -= mat_cost
    resources.influence -= inf_cost
    resources.knowledge -= sav_cost
    resources.updated_at = datetime.utcnow()
    return True


def check_prerequisites(structure: str, owned_structures: Counter) -> str | None:
    """Check if building prerequisites are met.

    Returns None if OK, or error message string if not.
    """
    prereqs = STRUCTURE_PREREQUISITES.get(structure)
    if prereqs is None:
        return None  # No prerequisites defined

    # Special case: clan_hq requires 5 different structure types
    if structure == "clan_hq":
        unique_types = len([t for t, c in owned_structures.items() if c > 0 and t not in ("road", "wall")])
        if unique_types < 5:
            return f"QG de Clan requiert 5 types de structures differents (tu en as {unique_types})"
        return None

    for required_struct, required_count in prereqs.items():
        actual = owned_structures.get(required_struct, 0)
        if actual < required_count:
            return f"{structure} requiert {required_count}x {required_struct} (tu en as {actual})"

    return None


async def compute_land_tax(agent_id: int, db: AsyncSession) -> float:
    """Compute daily land tax for an agent.

    Formula: tax_per_tile = 0.05 * (1 + 0.03 * total_tiles)
    Empty tiles (no structure) pay 1.5x.
    """
    result = await db.execute(
        select(WorldTile).where(WorldTile.owner_agent_id == agent_id)
    )
    tiles = result.scalars().all()

    if not tiles:
        return 0.0

    total_tiles = len(tiles)
    base_rate = 0.05 * (1 + 0.03 * total_tiles)

    total_tax = 0.0
    for tile in tiles:
        if tile.structure:
            total_tax += base_rate
        else:
            total_tax += base_rate * 1.5  # Empty tile penalty

    return total_tax


async def apply_land_tax(agent_id: int, db: AsyncSession) -> tuple[float, int]:
    """Apply land tax. If agent can't pay, release farthest tiles.

    Returns (tax_paid, tiles_released).
    """
    from chain.contracts import get_agent_on_chain
    from core.world_actions import _deduct_aky

    tax = await compute_land_tax(agent_id, db)
    if tax < 0.01:
        return 0.0, 0

    agent = await get_agent_on_chain(agent_id)
    AKY = 10**18
    vault_aky = agent["vault"] / AKY

    tiles_released = 0

    if vault_aky >= tax:
        # Can pay — deduct
        try:
            await _deduct_aky(agent_id, tax)
        except Exception as e:
            logger.error(f"Land tax deduction failed for agent #{agent_id}: {e}")
            return 0.0, 0
        return tax, 0
    else:
        # Can't pay full tax — release tiles until affordable
        # Release empty tiles first, then farthest structures
        result = await db.execute(
            select(WorldTile)
            .where(WorldTile.owner_agent_id == agent_id)
            .order_by(
                WorldTile.structure.is_(None).desc(),  # Empty tiles first
                WorldTile.claimed_at.asc(),  # Oldest first
            )
        )
        all_tiles = result.scalars().all()

        while vault_aky < tax and len(all_tiles) > 1:
            # Release last tile
            tile_to_release = all_tiles.pop()
            tile_to_release.owner_agent_id = None
            tile_to_release.structure = None
            tile_to_release.structure_level = 0
            tile_to_release.claimed_at = None
            tile_to_release.last_built_at = None
            tiles_released += 1

            # Recalculate tax with fewer tiles
            remaining = len(all_tiles)
            base_rate = 0.05 * (1 + 0.03 * remaining)
            tax = sum(
                base_rate * (1 if t.structure else 1.5)
                for t in all_tiles
            )

        if vault_aky >= tax and tax > 0:
            try:
                await _deduct_aky(agent_id, tax)
            except Exception as e:
                logger.error(f"Land tax deduction failed for agent #{agent_id}: {e}")

        await db.commit()
        return tax, tiles_released
