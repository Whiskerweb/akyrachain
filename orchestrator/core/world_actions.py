"""World actions — territorial actions for the 2D tile-based world system.

Handles claim, build, upgrade, demolish, raid, and spatial queries.
"""

from __future__ import annotations

import logging
import random
from datetime import datetime, date, timedelta

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from core.execution import ExecutionResult
from chain.contracts import get_agent_on_chain
from chain import tx_manager
from models.world_tile import WorldTile
from models.build_log import BuildLog
from models.daily_build_points import DailyBuildPoints

logger = logging.getLogger(__name__)

# ──── Constants ────

from core.resource_engine import (
    STRUCTURE_COSTS_FULL, STRUCTURE_PREREQUISITES, ACTION_RESOURCE_COSTS,
    check_prerequisites, deduct_resources, get_agent_resources,
)

# AKY-only costs extracted from full costs (for backward compat)
STRUCTURE_COSTS = {k: v["aky"] for k, v in STRUCTURE_COSTS_FULL.items()}

BUILD_POINTS = {
    "claim": 1, "build": 3, "upgrade_multiplier": 2, "road": 1, "token_create": 5,
    # Rarity multipliers for build score
    "rarity": {
        "farm": 1, "mine": 1, "habitat": 1, "road": 1, "wall": 1,
        "market": 2, "workshop": 2, "embassy": 2, "watchtower": 2,
        "library": 3, "bank": 3, "fortress": 3,
        "monument": 5, "clan_hq": 5,
    }
}

CLAIM_COSTS = {0: 0.5, 1: 2, 2: 1.5, 3: 3, 4: 5, 5: 25, 6: 10}  # per zone in AKY

VALID_STRUCTURES = set(STRUCTURE_COSTS.keys())

AKY = 10**18  # 1 AKY in wei

# Maps Python structure name → Solidity StructureType enum value
STRUCTURE_TYPE_IDS = {
    "farm": 1, "mine": 2, "market": 3, "workshop": 4, "library": 5,
    "watchtower": 6, "wall": 7, "bank": 8, "embassy": 9, "monument": 10,
    "road": 11, "fortress": 12, "habitat": 13, "clan_hq": 14,
}


# ──── Helpers ────

def _adjacent_coords(x: int, y: int) -> list[tuple[int, int]]:
    """Return 4-directional adjacent tile coordinates (within bounds)."""
    coords = []
    for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        nx, ny = x + dx, y + dy
        if 0 <= nx < 200 and 0 <= ny < 200:
            coords.append((nx, ny))
    return coords


async def _get_tiles_owned_count(agent_id: int, db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(WorldTile)
        .where(WorldTile.owner_agent_id == agent_id)
    )
    return result.scalar() or 0


async def _log_build(
    db: AsyncSession,
    agent_id: int,
    action: str,
    tile_x: int,
    tile_y: int,
    structure: str | None = None,
    level: int | None = None,
    cost_aky: float | None = None,
    build_points: int = 0,
) -> None:
    """Log a build action and update daily build points."""
    log = BuildLog(
        agent_id=agent_id,
        action=action,
        tile_x=tile_x,
        tile_y=tile_y,
        structure=structure,
        level=level,
        cost_aky=cost_aky,
        build_points=build_points,
    )
    db.add(log)

    # Update daily build points
    today = date.today()
    result = await db.execute(
        select(DailyBuildPoints)
        .where(DailyBuildPoints.agent_id == agent_id, DailyBuildPoints.day == today)
    )
    daily = result.scalar_one_or_none()
    if daily:
        daily.points += build_points
    else:
        db.add(DailyBuildPoints(agent_id=agent_id, day=today, points=build_points))


async def _deduct_aky(agent_id: int, amount_aky: float) -> str:
    """Deduct AKY from agent vault on-chain. Returns tx_hash. Raises on failure."""
    amount_wei = int(amount_aky * AKY)
    from chain.contracts import Contracts
    registry_contract = Contracts.agent_registry()
    orch = tx_manager._get_orchestrator_account()
    tx = await registry_contract.functions.debitVault(agent_id, amount_wei).build_transaction({"value": 0, "from": orch.address})
    return await tx_manager._send_tx(tx)


# ──── Core Actions ────

async def claim_tile(agent_id: int, x: int, y: int, db: AsyncSession) -> ExecutionResult:
    """Claim an unclaimed tile for the agent.

    Rules:
    - Tile must be free (no owner)
    - Must be adjacent to an existing tile owned by agent, OR first claim in nursery
    - Agent must be in the same world_zone
    - Agent must have enough AKY: CLAIM_COSTS[zone] * (1 + 0.1 * tiles_owned)
    """
    # Validate coordinates
    if not (0 <= x < 200 and 0 <= y < 200):
        return ExecutionResult(success=False, error="Coordonnees hors limites (0-199)")

    # Get the tile
    result = await db.execute(
        select(WorldTile).where(WorldTile.x == x, WorldTile.y == y)
    )
    tile = result.scalar_one_or_none()
    if tile is None:
        return ExecutionResult(success=False, error=f"Tile ({x},{y}) n'existe pas")

    if tile.owner_agent_id is not None:
        return ExecutionResult(success=False, error=f"Tile ({x},{y}) est deja occupee par l'agent #{tile.owner_agent_id}")

    if tile.terrain in ("water", "void"):
        return ExecutionResult(success=False, error=f"Impossible de claim un terrain {tile.terrain}")

    # Check agent is in the correct world zone
    agent = await get_agent_on_chain(agent_id)
    if not agent["alive"]:
        return ExecutionResult(success=False, error="Agent mort")

    # Check adjacency (or first claim in nursery)
    tiles_owned = await _get_tiles_owned_count(agent_id, db)
    if tiles_owned == 0:
        # First claim must be in nursery (zone 0)
        if tile.world_zone != 0:
            return ExecutionResult(success=False, error="Premier claim doit etre dans la Nursery (zone 0)")
    else:
        # Must be adjacent to an owned tile
        adj = _adjacent_coords(x, y)
        adj_result = await db.execute(
            select(func.count())
            .select_from(WorldTile)
            .where(
                WorldTile.owner_agent_id == agent_id,
                or_(*[and_(WorldTile.x == ax, WorldTile.y == ay) for ax, ay in adj])
            )
        )
        adj_count = adj_result.scalar() or 0
        if adj_count == 0:
            return ExecutionResult(success=False, error="Le tile doit etre adjacent a un de tes territoires")

    # Calculate cost
    zone = tile.world_zone
    base_cost = CLAIM_COSTS.get(zone, 5)
    cost_aky = base_cost * (1 + 0.1 * tiles_owned)

    vault_aky = agent["vault"] / AKY
    if vault_aky < cost_aky:
        return ExecutionResult(success=False, error=f"Pas assez d'AKY ({vault_aky:.1f} < {cost_aky:.1f})")

    # Influence cost for claiming (5 INF per claim, scaled down for early game)
    inf_cost = max(1, min(5, tiles_owned))  # 1 INF first claim, up to 5
    if tiles_owned > 0:  # Skip resource check for very first claim
        has_inf = await deduct_resources(agent_id, {"inf": inf_cost, "mat": 0, "sav": 0}, db)
        if not has_inf:
            current = await get_agent_resources(agent_id, db)
            return ExecutionResult(
                success=False,
                error=f"Pas assez d'Influence pour claim ({current['inf']} < {inf_cost}). Construis des Marches pour gagner de l'INF."
            )

    # ── On-chain first: claim tile (includes AKY debit via debitVault) ──
    cost_wei = int(cost_aky * AKY)
    try:
        tx_hash = await tx_manager.claim_tile_onchain(agent_id, zone, x, y, cost_wei)
    except Exception as e:
        logger.error(f"On-chain claim_tile failed for agent #{agent_id}: {e}")
        return ExecutionResult(success=False, error=f"Transaction on-chain echouee: {e}")

    # ── DB cache update ──
    tile.owner_agent_id = agent_id
    tile.claimed_at = datetime.utcnow()

    await _log_build(db, agent_id, "claim", x, y, cost_aky=cost_aky, build_points=BUILD_POINTS["claim"])
    await db.commit()

    return ExecutionResult(success=True, tx_hash=tx_hash)


async def build_structure(agent_id: int, x: int, y: int, structure: str, db: AsyncSession) -> ExecutionResult:
    """Build a structure on an owned tile.

    Rules:
    - Agent must own the tile
    - No existing structure
    - Valid structure type
    - Prerequisites met (e.g. workshop needs farm+market)
    - Agent must have enough AKY AND resources (MAT/INF/SAV)
    - 1h cooldown since last build on this tile
    """
    if structure not in VALID_STRUCTURES:
        return ExecutionResult(success=False, error=f"Structure invalide: {structure}. Valides: {', '.join(sorted(VALID_STRUCTURES))}")

    result = await db.execute(
        select(WorldTile).where(WorldTile.x == x, WorldTile.y == y)
    )
    tile = result.scalar_one_or_none()
    if tile is None:
        return ExecutionResult(success=False, error=f"Tile ({x},{y}) n'existe pas")

    if tile.owner_agent_id != agent_id:
        return ExecutionResult(success=False, error=f"Tu ne possedes pas le tile ({x},{y})")

    if tile.structure is not None:
        return ExecutionResult(success=False, error=f"Le tile ({x},{y}) a deja une structure: {tile.structure}")

    # Cooldown check (1h since last build)
    if tile.last_built_at:
        elapsed = (datetime.utcnow() - tile.last_built_at).total_seconds()
        if elapsed < 3600:
            remaining = int(3600 - elapsed)
            return ExecutionResult(success=False, error=f"Cooldown: encore {remaining}s avant de construire ici")

    # Prerequisites check
    owned_structs_result = await db.execute(
        select(WorldTile.structure, func.count())
        .where(WorldTile.owner_agent_id == agent_id, WorldTile.structure.isnot(None))
        .group_by(WorldTile.structure)
    )
    from collections import Counter
    owned_structs = Counter(dict(owned_structs_result.all()))

    prereq_error = check_prerequisites(structure, owned_structs)
    if prereq_error:
        return ExecutionResult(success=False, error=prereq_error)

    # Cost check (AKY)
    cost_aky = STRUCTURE_COSTS.get(structure, 3)
    agent = await get_agent_on_chain(agent_id)
    vault_aky = agent["vault"] / AKY
    if vault_aky < cost_aky:
        return ExecutionResult(success=False, error=f"Pas assez d'AKY ({vault_aky:.1f} < {cost_aky})")

    # Resource cost check
    full_costs = STRUCTURE_COSTS_FULL.get(structure, {})
    res_costs = {
        "mat": full_costs.get("mat", 0),
        "inf": full_costs.get("inf", 0),
        "sav": full_costs.get("sav", 0),
    }
    if any(v > 0 for v in res_costs.values()):
        current = await get_agent_resources(agent_id, db)
        if current["mat"] < res_costs["mat"] or current["inf"] < res_costs["inf"] or current["sav"] < res_costs["sav"]:
            return ExecutionResult(
                success=False,
                error=f"Ressources insuffisantes. Requis: MAT={res_costs['mat']}, INF={res_costs['inf']}, SAV={res_costs['sav']}. "
                      f"Stock: MAT={current['mat']}, INF={current['inf']}, SAV={current['sav']}",
            )

    # ── On-chain: debit resources first ──
    if any(v > 0 for v in res_costs.values()):
        try:
            await tx_manager.debit_resources_onchain(agent_id, res_costs["mat"], res_costs["inf"], res_costs["sav"])
        except Exception as e:
            logger.error(f"On-chain debit_resources failed for agent #{agent_id}: {e}")
            return ExecutionResult(success=False, error=f"Debit ressources on-chain echoue: {e}")

    # ── On-chain: build structure ──
    structure_type_id = STRUCTURE_TYPE_IDS[structure]
    try:
        tx_hash = await tx_manager.build_structure_onchain(agent_id, tile.world_zone, x, y, structure_type_id)
    except Exception as e:
        logger.error(f"On-chain build_structure failed for agent #{agent_id}: {e}")
        return ExecutionResult(success=False, error=f"Transaction on-chain echouee: {e}")

    # ── DB cache update ──
    await deduct_resources(agent_id, res_costs, db)
    tile.structure = structure
    tile.structure_level = 1
    tile.last_built_at = datetime.utcnow()

    rarity = BUILD_POINTS.get("rarity", {}).get(structure, 1) if isinstance(BUILD_POINTS.get("rarity"), dict) else 1
    bp = BUILD_POINTS["build"] * rarity
    await _log_build(db, agent_id, "build", x, y, structure=structure, level=1, cost_aky=cost_aky, build_points=bp)
    await db.commit()

    return ExecutionResult(success=True, tx_hash=tx_hash)


async def upgrade_structure(agent_id: int, x: int, y: int, db: AsyncSession) -> ExecutionResult:
    """Upgrade a structure on an owned tile.

    Rules:
    - Agent owns tile with structure
    - Level < 5
    - Cost = base_cost * current_level
    """
    result = await db.execute(
        select(WorldTile).where(WorldTile.x == x, WorldTile.y == y)
    )
    tile = result.scalar_one_or_none()
    if tile is None:
        return ExecutionResult(success=False, error=f"Tile ({x},{y}) n'existe pas")

    if tile.owner_agent_id != agent_id:
        return ExecutionResult(success=False, error=f"Tu ne possedes pas le tile ({x},{y})")

    if tile.structure is None:
        return ExecutionResult(success=False, error=f"Pas de structure sur ({x},{y})")

    if tile.structure_level >= 5:
        return ExecutionResult(success=False, error=f"Structure deja au niveau max (5)")

    # Cost = base_cost * current_level
    base_cost = STRUCTURE_COSTS.get(tile.structure, 10)
    cost_aky = base_cost * tile.structure_level

    agent = await get_agent_on_chain(agent_id)
    vault_aky = agent["vault"] / AKY
    if vault_aky < cost_aky:
        return ExecutionResult(success=False, error=f"Pas assez d'AKY ({vault_aky:.1f} < {cost_aky})")

    # Resource cost for upgrade: 10 MAT * level
    mat_cost = 10 * tile.structure_level
    current = await get_agent_resources(agent_id, db)
    if current["mat"] < mat_cost:
        return ExecutionResult(
            success=False,
            error=f"Pas assez de Materiaux pour upgrade ({current['mat']} < {mat_cost}). Construis des Fermes."
        )

    # ── On-chain: debit resources ──
    try:
        await tx_manager.debit_resources_onchain(agent_id, mat_cost, 0, 0)
    except Exception as e:
        logger.error(f"On-chain debit_resources failed for agent #{agent_id}: {e}")
        return ExecutionResult(success=False, error=f"Debit ressources on-chain echoue: {e}")

    # ── On-chain: upgrade structure ──
    try:
        tx_hash = await tx_manager.upgrade_structure_onchain(agent_id, tile.world_zone, x, y)
    except Exception as e:
        logger.error(f"On-chain upgrade_structure failed for agent #{agent_id}: {e}")
        return ExecutionResult(success=False, error=f"Transaction on-chain echouee: {e}")

    # ── DB cache update ──
    await deduct_resources(agent_id, {"mat": mat_cost, "inf": 0, "sav": 0}, db)
    tile.structure_level += 1
    tile.last_built_at = datetime.utcnow()

    bp = BUILD_POINTS["build"] * BUILD_POINTS["upgrade_multiplier"]
    await _log_build(
        db, agent_id, "upgrade", x, y,
        structure=tile.structure, level=tile.structure_level,
        cost_aky=cost_aky, build_points=bp,
    )
    await db.commit()

    return ExecutionResult(success=True, tx_hash=tx_hash)


async def demolish_structure(agent_id: int, x: int, y: int, db: AsyncSession) -> ExecutionResult:
    """Demolish a structure on an owned tile.

    Rules:
    - Agent owns tile with structure
    - 24h since last_built_at
    - No refund
    """
    result = await db.execute(
        select(WorldTile).where(WorldTile.x == x, WorldTile.y == y)
    )
    tile = result.scalar_one_or_none()
    if tile is None:
        return ExecutionResult(success=False, error=f"Tile ({x},{y}) n'existe pas")

    if tile.owner_agent_id != agent_id:
        return ExecutionResult(success=False, error=f"Tu ne possedes pas le tile ({x},{y})")

    if tile.structure is None:
        return ExecutionResult(success=False, error=f"Pas de structure sur ({x},{y})")

    # 24h cooldown
    if tile.last_built_at:
        elapsed = (datetime.utcnow() - tile.last_built_at).total_seconds()
        if elapsed < 86400:
            remaining_h = int((86400 - elapsed) / 3600)
            return ExecutionResult(success=False, error=f"Il faut attendre 24h apres construction ({remaining_h}h restantes)")

    # ── On-chain: demolish structure ──
    try:
        tx_hash = await tx_manager.demolish_structure_onchain(agent_id, tile.world_zone, x, y)
    except Exception as e:
        logger.error(f"On-chain demolish_structure failed for agent #{agent_id}: {e}")
        return ExecutionResult(success=False, error=f"Transaction on-chain echouee: {e}")

    # ── DB cache update ──
    old_structure = tile.structure
    tile.structure = None
    tile.structure_level = 0
    tile.last_built_at = None

    await _log_build(db, agent_id, "demolish", x, y, structure=old_structure, build_points=0)
    await db.commit()

    return ExecutionResult(success=True, tx_hash=tx_hash)


async def raid_territory(agent_id: int, target_agent_id: int, db: AsyncSession) -> ExecutionResult:
    """Raid a neighboring agent's territory.

    Rules:
    - Agents must have adjacent tiles
    - Attacker pays 10% of vault
    - Attack score = vault * (1 + watchtowers * 0.2)
    - Defense score = vault * (1 + watchtowers * 0.3 + walls * 0.5)
    - If attack > defense: steal 1 tile (closest to frontier), destroy structure
    - If defense > attack: raid fails, defender +10 rep
    """
    if agent_id == target_agent_id:
        return ExecutionResult(success=False, error="Tu ne peux pas te raider toi-meme")

    # Check agents are neighbors (have adjacent tiles)
    # Find all tiles owned by attacker
    attacker_tiles_result = await db.execute(
        select(WorldTile.x, WorldTile.y).where(WorldTile.owner_agent_id == agent_id)
    )
    attacker_tiles = set(attacker_tiles_result.all())

    if not attacker_tiles:
        return ExecutionResult(success=False, error="Tu n'as aucun territoire")

    # Find frontier tiles (target tiles adjacent to attacker tiles)
    frontier_tiles = []
    for ax, ay in attacker_tiles:
        for nx, ny in _adjacent_coords(ax, ay):
            result = await db.execute(
                select(WorldTile)
                .where(WorldTile.x == nx, WorldTile.y == ny, WorldTile.owner_agent_id == target_agent_id)
            )
            tile = result.scalar_one_or_none()
            if tile:
                frontier_tiles.append(tile)

    if not frontier_tiles:
        return ExecutionResult(success=False, error=f"L'agent #{target_agent_id} n'est pas ton voisin")

    # Get both agents' on-chain data
    attacker = await get_agent_on_chain(agent_id)
    defender = await get_agent_on_chain(target_agent_id)

    if not attacker["alive"]:
        return ExecutionResult(success=False, error="Tu es mort")
    if not defender["alive"]:
        return ExecutionResult(success=False, error="L'agent cible est mort")

    # Attacker pays 10% of vault
    raid_cost_aky = (attacker["vault"] / AKY) * 0.1
    if raid_cost_aky < 1:
        return ExecutionResult(success=False, error="Coffre trop faible pour raider (cout min 1 AKY)")

    # Count watchtowers and walls for both
    attacker_structs = await db.execute(
        select(WorldTile.structure, func.count())
        .where(WorldTile.owner_agent_id == agent_id, WorldTile.structure.in_(["watchtower", "wall"]))
        .group_by(WorldTile.structure)
    )
    attacker_counts = dict(attacker_structs.all())

    defender_structs = await db.execute(
        select(WorldTile.structure, func.count())
        .where(WorldTile.owner_agent_id == target_agent_id, WorldTile.structure.in_(["watchtower", "wall"]))
        .group_by(WorldTile.structure)
    )
    defender_counts = dict(defender_structs.all())

    attacker_watchtowers = attacker_counts.get("watchtower", 0)
    defender_watchtowers = defender_counts.get("watchtower", 0)
    defender_walls = defender_counts.get("wall", 0)

    # Calculate scores
    attack_score = (attacker["vault"] / AKY) * (1 + attacker_watchtowers * 0.2)
    defense_score = (defender["vault"] / AKY) * (1 + defender_watchtowers * 0.3 + defender_walls * 0.5)

    attacker_won = attack_score > defense_score

    # Pick the target tile for the raid
    target_tile = random.choice(frontier_tiles)
    raid_cost_wei = int(raid_cost_aky * AKY)

    # ── On-chain: record raid (includes AKY debit + tile transfer if attacker wins) ──
    try:
        tx_hash = await tx_manager.record_raid_onchain(
            agent_id, target_agent_id, target_tile.world_zone,
            target_tile.x, target_tile.y, attacker_won, raid_cost_wei
        )
    except Exception as e:
        logger.error(f"On-chain record_raid failed for agent #{agent_id}: {e}")
        return ExecutionResult(success=False, error=f"Transaction on-chain echouee: {e}")

    # ── DB cache update ──
    if attacker_won:
        old_structure = target_tile.structure
        target_tile.owner_agent_id = agent_id
        target_tile.structure = None
        target_tile.structure_level = 0
        target_tile.claimed_at = datetime.utcnow()
        target_tile.last_built_at = None

        await _log_build(
            db, agent_id, "raid", target_tile.x, target_tile.y,
            structure=old_structure, cost_aky=raid_cost_aky, build_points=BUILD_POINTS["claim"],
        )
        await db.commit()

        return ExecutionResult(success=True, tx_hash=tx_hash)
    else:
        await _log_build(
            db, agent_id, "raid", target_tile.x, target_tile.y,
            cost_aky=raid_cost_aky, build_points=0,
        )
        await db.commit()

        return ExecutionResult(
            success=False,
            tx_hash=tx_hash,
            error=f"Raid echoue. Defense ({defense_score:.1f}) > Attaque ({attack_score:.1f}). Cout: {raid_cost_aky:.1f} AKY",
        )


# ──── Spatial Queries ────

async def get_agent_territory(agent_id: int, db: AsyncSession) -> dict:
    """Returns territory summary for prompt injection."""
    result = await db.execute(
        select(WorldTile)
        .where(WorldTile.owner_agent_id == agent_id)
    )
    tiles = result.scalars().all()

    structures = []
    farm_count = 0
    for t in tiles:
        if t.structure:
            structures.append({
                "structure": t.structure,
                "level": t.structure_level,
                "x": t.x,
                "y": t.y,
            })
            if t.structure == "farm":
                farm_count += 1

    # Count adjacent free tiles
    owned_coords = {(t.x, t.y) for t in tiles}
    adjacent_free = set()
    for t in tiles:
        for nx, ny in _adjacent_coords(t.x, t.y):
            if (nx, ny) not in owned_coords:
                adjacent_free.add((nx, ny))

    # Check which adjacent tiles are actually claimable
    if adjacent_free:
        adj_list = list(adjacent_free)[:50]  # Cap query size
        adj_result = await db.execute(
            select(func.count())
            .select_from(WorldTile)
            .where(
                WorldTile.owner_agent_id.is_(None),
                WorldTile.terrain.notin_(["water", "void"]),
                or_(*[and_(WorldTile.x == ax, WorldTile.y == ay) for ax, ay in adj_list])
            )
        )
        free_count = adj_result.scalar() or 0
    else:
        free_count = 0

    # Next claim cost
    tiles_owned = len(tiles)
    if tiles_owned > 0:
        # Get the zone of the first owned tile for cost estimate
        first_zone = tiles[0].world_zone
        base_cost = CLAIM_COSTS.get(first_zone, 5)
        next_cost = base_cost * (1 + 0.1 * tiles_owned)
    else:
        next_cost = CLAIM_COSTS[0]  # Nursery cost

    # Passive income from farms (1 AKY per farm level per day, simplified)
    passive_income = sum(
        s["level"] for s in structures if s["structure"] == "farm"
    )

    # Owned tile coords for prompt display
    owned_tile_coords = [{"x": t.x, "y": t.y} for t in tiles]

    # Suggested tiles to claim (adjacent free, or Nursery spots if no territory)
    suggested_tiles: list[tuple[int, int]] = []
    if tiles_owned > 0:
        # Suggest claimable adjacent tiles
        if adjacent_free:
            adj_list = list(adjacent_free)[:20]
            sugg_result = await db.execute(
                select(WorldTile.x, WorldTile.y)
                .where(
                    WorldTile.owner_agent_id.is_(None),
                    WorldTile.terrain.notin_(["water", "void"]),
                    or_(*[and_(WorldTile.x == ax, WorldTile.y == ay) for ax, ay in adj_list])
                )
                .limit(5)
            )
            suggested_tiles = [(r[0], r[1]) for r in sugg_result.all()]
    else:
        # No territory — suggest Nursery tiles
        sugg_result = await db.execute(
            select(WorldTile.x, WorldTile.y)
            .where(
                WorldTile.world_zone == 0,
                WorldTile.owner_agent_id.is_(None),
                WorldTile.terrain == "grass",
            )
            .order_by(func.random())
            .limit(5)
        )
        suggested_tiles = [(r[0], r[1]) for r in sugg_result.all()]

    return {
        "tiles_owned": tiles_owned,
        "structures": structures,
        "adjacent_free_tiles": free_count,
        "next_claim_cost": next_cost,
        "passive_income": passive_income,
        "owned_tile_coords": owned_tile_coords,
        "suggested_tiles": suggested_tiles,
    }


async def get_nearby_territories(agent_id: int, db: AsyncSession) -> list[dict]:
    """Returns info about neighboring agents' territories."""
    # Get all tiles owned by the agent
    result = await db.execute(
        select(WorldTile.x, WorldTile.y).where(WorldTile.owner_agent_id == agent_id)
    )
    my_tiles = result.all()

    if not my_tiles:
        return []

    # Find neighboring agent IDs (owners of tiles adjacent to ours)
    neighbor_ids: set[int] = set()
    for mx, my in my_tiles:
        for nx, ny in _adjacent_coords(mx, my):
            adj_result = await db.execute(
                select(WorldTile.owner_agent_id)
                .where(
                    WorldTile.x == nx,
                    WorldTile.y == ny,
                    WorldTile.owner_agent_id.isnot(None),
                    WorldTile.owner_agent_id != agent_id,
                )
            )
            row = adj_result.scalar_one_or_none()
            if row:
                neighbor_ids.add(row)

    if not neighbor_ids:
        return []

    # Get territory info for each neighbor
    neighbors = []
    for nid in list(neighbor_ids)[:10]:  # Cap at 10 neighbors
        n_result = await db.execute(
            select(
                func.count().label("tiles"),
                func.count(WorldTile.structure).label("structs"),
            )
            .select_from(WorldTile)
            .where(WorldTile.owner_agent_id == nid)
        )
        row = n_result.first()
        tiles_count = row[0] if row else 0
        structs_count = row[1] if row else 0

        # Check specific structures
        struct_result = await db.execute(
            select(WorldTile.structure)
            .where(WorldTile.owner_agent_id == nid, WorldTile.structure.isnot(None))
        )
        struct_types = [r[0] for r in struct_result.all()]

        neighbors.append({
            "agent_id": nid,
            "tiles": tiles_count,
            "structures_count": structs_count,
            "has_wall": "wall" in struct_types,
            "has_watchtower": "watchtower" in struct_types,
        })

    return neighbors


async def spawn_agent(agent_id: int, db: AsyncSession) -> tuple[int, int]:
    """Find a birth spot in nursery, claim it for the agent. Returns (x, y)."""
    from core.world_generator import find_spawn_point

    spawn = await find_spawn_point(db)
    if spawn is None:
        # Fallback: find any unclaimed grass tile in nursery
        result = await db.execute(
            select(WorldTile)
            .where(
                WorldTile.world_zone == 0,
                WorldTile.owner_agent_id.is_(None),
                WorldTile.terrain == "grass",
            )
            .limit(1)
        )
        tile = result.scalar_one_or_none()
        if tile is None:
            raise RuntimeError("No spawn points available in Nursery")
        spawn = (tile.x, tile.y)

    x, y = spawn

    # Claim the tile on-chain (cost=0 for spawn)
    result = await db.execute(
        select(WorldTile).where(WorldTile.x == x, WorldTile.y == y)
    )
    tile = result.scalar_one_or_none()
    if tile:
        try:
            await tx_manager.claim_tile_onchain(agent_id, tile.world_zone, x, y, 0)
        except Exception as e:
            logger.error(f"On-chain spawn claim failed for agent #{agent_id}: {e}")
            raise

        # DB cache
        tile.owner_agent_id = agent_id
        tile.claimed_at = datetime.utcnow()
        await _log_build(db, agent_id, "claim", x, y, cost_aky=0, build_points=BUILD_POINTS["claim"])
        await db.commit()

    return (x, y)
