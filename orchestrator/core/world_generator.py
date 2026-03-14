"""World generator — creates the 200x200 tile grid with organic terrain.

Uses a simple value-noise implementation (no external deps) for natural-looking biomes.
"""

from __future__ import annotations

import logging
import math
import random
from datetime import datetime

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from models.world_tile import WorldTile

logger = logging.getLogger(__name__)

WORLD_SIZE = 200

# ──── Zone definitions ────

ZONE_DEFS = {
    0: {"name": "Nursery",  "color": "#2B6B1E", "description": "Zone de depart. Couts -50%, protection."},
    1: {"name": "Agora",    "color": "#4A6741", "description": "Place publique. Influence +50%."},
    2: {"name": "Bazar",    "color": "#8B6914", "description": "Le marche. Materiaux +30%, Influence +20%."},
    3: {"name": "Forge",    "color": "#7A2E0E", "description": "Zone volcanique. Materiaux +50%, Savoir +10%."},
    4: {"name": "Banque",   "color": "#3A3A4E", "description": "Zone financiere. AKY passif +30%."},
    5: {"name": "Noir",     "color": "#1A0A2E", "description": "Zone dangereuse. Savoir +50%, raids +100%."},
    6: {"name": "Sommet",   "color": "#6B5B00", "description": "L'elite. Influence +100%, gouvernance."},
}

# Terrain weights per zone: {terrain: weight}
ZONE_TERRAIN_WEIGHTS = {
    0: {"grass": 90, "sand": 5, "water": 5},               # Nursery: gentle
    1: {"grass": 80, "sand": 10, "rock": 5, "water": 5},    # Agora: stone plazas
    2: {"sand": 40, "grass": 45, "rock": 10, "water": 5},   # Bazar: sandy market
    3: {"rock": 50, "sand": 25, "grass": 15, "void": 10},   # Forge: volcanic
    4: {"grass": 40, "rock": 40, "sand": 15, "water": 5},   # Banque: steel
    5: {"grass": 30, "rock": 20, "sand": 10, "void": 20, "water": 20},  # Noir: dark
    6: {"grass": 60, "rock": 25, "sand": 15},               # Sommet: mountain
}


# ──── Simple value-noise implementation ────

class ValueNoise:
    """Simple 2D value noise for organic terrain generation."""

    def __init__(self, seed: int = 42):
        self._rng = random.Random(seed)
        self._size = 256
        self._perm = list(range(self._size))
        self._rng.shuffle(self._perm)
        self._perm = self._perm + self._perm  # double for wrapping
        self._grads = [self._rng.uniform(-1.0, 1.0) for _ in range(self._size * 2)]

    def _fade(self, t: float) -> float:
        return t * t * t * (t * (t * 6 - 15) + 10)

    def _lerp(self, a: float, b: float, t: float) -> float:
        return a + t * (b - a)

    def noise2d(self, x: float, y: float) -> float:
        """Returns a value in [-1, 1]."""
        xi = int(math.floor(x)) & (self._size - 1)
        yi = int(math.floor(y)) & (self._size - 1)

        xf = x - math.floor(x)
        yf = y - math.floor(y)

        u = self._fade(xf)
        v = self._fade(yf)

        aa = self._perm[self._perm[xi] + yi]
        ab = self._perm[self._perm[xi] + yi + 1]
        ba = self._perm[self._perm[xi + 1] + yi]
        bb = self._perm[self._perm[xi + 1] + yi + 1]

        x1 = self._lerp(self._grads[aa], self._grads[ba], u)
        x2 = self._lerp(self._grads[ab], self._grads[bb], u)

        return self._lerp(x1, x2, v)

    def fbm(self, x: float, y: float, octaves: int = 4) -> float:
        """Fractal Brownian Motion — layered noise for more detail."""
        value = 0.0
        amplitude = 1.0
        frequency = 1.0
        max_amp = 0.0

        for _ in range(octaves):
            value += self.noise2d(x * frequency, y * frequency) * amplitude
            max_amp += amplitude
            amplitude *= 0.5
            frequency *= 2.0

        return value / max_amp  # Normalize to [-1, 1]


# ──── Zone mapping ────

def _get_base_zone(x: int, y: int) -> int:
    """Determine the base zone for a tile based on geographic position.

    Layout matching mvp4.md:
    +------------------------------------------+  y=0
    |              SOMMET (6)                  |
    +--------+----------+----------+-----------+  y=35
    | BANQUE | FORGE    | BAZAR    | NOIR      |
    |  (4)   |  (3)     |  (2)    |  (5)      |
    +--------+----------+----------+-----------+  y=110
    |         AGORA (1)                        |
    +------------------------------------------+  y=155
    |         NURSERY (0)                      |
    +------------------------------------------+  y=200
    """
    # Zone 6 (Sommet): top center, y=0-34, x=50-149
    if y < 35 and 50 <= x < 150:
        return 6

    # Middle band: y=35-109
    if 35 <= y < 110:
        if x < 50:
            return 4   # Banque (left)
        elif x < 100:
            return 3   # Forge (center-left)
        elif x < 150:
            return 2   # Bazar (center-right)
        else:
            return 5   # Noir (right)

    # Top corners (not covered by Sommet) — extend adjacent middle zones
    if y < 35:
        if x < 50:
            return 4   # Banque extends up-left
        else:
            return 5   # Noir extends up-right

    # Zone 1 (Agora): y=110-154
    if 110 <= y < 155:
        return 1

    # Zone 0 (Nursery): y=155-199
    return 0


def _get_zone_with_noise(x: int, y: int, noise: ValueNoise) -> int:
    """Get zone with noise-based border blending (not sharp lines)."""
    base_zone = _get_base_zone(x, y)

    # Add noise displacement to create organic borders
    # Only blend near zone boundaries (within ~8 tiles)
    n = noise.fbm(x * 0.05, y * 0.05, octaves=3) * 8  # +/- 8 tiles displacement

    # Check if displaced position yields a different zone
    displaced_zone = _get_base_zone(
        max(0, min(199, int(x + n * 0.3))),
        max(0, min(199, int(y + n * 0.3))),
    )

    # Only allow blending to adjacent zones, not jumping across the map
    # Use the base zone for most tiles, displaced for border tiles
    if abs(noise.fbm(x * 0.08, y * 0.08, octaves=2)) > 0.4:
        return base_zone  # Strong signal = keep base zone
    return displaced_zone


def _pick_terrain(zone: int, x: int, y: int, noise: ValueNoise) -> str:
    """Pick terrain type using noise and zone weights."""
    weights = ZONE_TERRAIN_WEIGHTS[zone]
    terrains = list(weights.keys())
    cumulative = []
    total = 0
    for t in terrains:
        total += weights[t]
        cumulative.append(total)

    # Use noise to create a deterministic but organic value
    n = (noise.fbm(x * 0.1 + 100, y * 0.1 + 100, octaves=3) + 1) / 2  # [0, 1]
    threshold = n * total

    for i, cum in enumerate(cumulative):
        if threshold <= cum:
            return terrains[i]
    return terrains[-1]


def _add_water_bodies(tiles: list[dict], noise: ValueNoise) -> None:
    """Overlay organic water bodies across ~5% of the map."""
    water_noise = ValueNoise(seed=12345)
    for tile in tiles:
        x, y = tile["x"], tile["y"]
        # Skip void tiles
        if tile["terrain"] == "void":
            continue
        # Generate water body using noise threshold
        wn = water_noise.fbm(x * 0.04, y * 0.04, octaves=3)
        if wn > 0.55:  # ~5% coverage
            tile["terrain"] = "water"


# ──── Main generator ────

async def is_world_generated(db: AsyncSession) -> bool:
    """Check if the world grid has already been generated."""
    result = await db.execute(select(func.count()).select_from(WorldTile))
    count = result.scalar() or 0
    return count > 0


async def generate_world(db: AsyncSession, seed: int = 42) -> int:
    """Generate the full 200x200 world grid and insert into DB.

    Returns the number of tiles created.
    """
    if await is_world_generated(db):
        logger.info("World already generated, skipping")
        return 0

    logger.info(f"Generating {WORLD_SIZE}x{WORLD_SIZE} world grid (seed={seed})...")

    noise = ValueNoise(seed=seed)
    tiles: list[dict] = []

    for y in range(WORLD_SIZE):
        for x in range(WORLD_SIZE):
            zone = _get_zone_with_noise(x, y, noise)
            terrain = _pick_terrain(zone, x, y, noise)
            tiles.append({
                "x": x,
                "y": y,
                "terrain": terrain,
                "world_zone": zone,
            })

    # Add organic water bodies
    _add_water_bodies(tiles, noise)

    # Mark birth spots in Nursery (every 10 tiles, centered)
    # Birth spots are grass tiles at regular intervals in zone 0
    for tile in tiles:
        if tile["world_zone"] == 0 and tile["x"] % 10 == 5 and tile["y"] % 10 == 5:
            tile["terrain"] = "grass"  # Ensure birth spots are always grass

    # Batch insert using raw SQL for performance (40k rows)
    BATCH_SIZE = 1000
    for i in range(0, len(tiles), BATCH_SIZE):
        batch = tiles[i:i + BATCH_SIZE]
        await db.execute(
            WorldTile.__table__.insert(),
            batch,
        )
        if (i // BATCH_SIZE) % 10 == 0:
            logger.info(f"  Inserted {min(i + BATCH_SIZE, len(tiles))}/{len(tiles)} tiles...")

    await db.commit()
    logger.info(f"World generation complete: {len(tiles)} tiles created")
    return len(tiles)


async def find_spawn_point(db: AsyncSession) -> tuple[int, int] | None:
    """Find an available birth spot in the Nursery (zone 0).

    Birth spots are at (x%10==5, y%10==5) in the Nursery, unclaimed.
    """
    result = await db.execute(
        select(WorldTile.x, WorldTile.y)
        .where(
            WorldTile.world_zone == 0,
            WorldTile.owner_agent_id.is_(None),
            WorldTile.terrain == "grass",
            WorldTile.x % 10 == 5,
            WorldTile.y % 10 == 5,
        )
        .order_by(WorldTile.y.desc(), WorldTile.x)
        .limit(1)
    )
    row = result.first()
    if row:
        return (row[0], row[1])
    return None
