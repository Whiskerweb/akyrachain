"""World API — tile grid, spatial queries, world generation."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, text, and_, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import get_db
from models.world_tile import WorldTile
from models.build_log import BuildLog
from models.tick_log import TickLog
from models.private_thought import PrivateThought
from models.message import Message
from models.agent_config import AgentConfig
from models.event import Event
from core.world_generator import generate_world, is_world_generated, ZONE_DEFS
from security.auth import get_current_user
from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/world", tags=["world"])


# ──── Schemas ────

class TileResponse(BaseModel):
    x: int
    y: int
    owner_agent_id: Optional[int] = None
    terrain: str
    structure: Optional[str] = None
    structure_level: int = 0
    world_zone: int


class WorldStatsResponse(BaseModel):
    total_claimed: int
    total_structures: int
    tiles_per_zone: dict[str, int]
    structures_per_type: dict[str, int]


class ZoneInfo(BaseModel):
    zone_id: int
    name: str
    color: str
    description: str


class BuildLogResponse(BaseModel):
    id: int
    agent_id: int
    action: str
    tile_x: int
    tile_y: int
    structure: Optional[str] = None
    level: Optional[int] = None
    cost_aky: Optional[float] = None
    build_points: int
    tx_hash: Optional[str] = None
    created_at: str


class AgentActivityResponse(BaseModel):
    agent_id: int
    x: int
    y: int
    action_type: Optional[str] = None
    emotional_state: Optional[str] = None
    message: Optional[str] = None
    vault_aky: float = 0.0
    tier: int = 1
    target_agent_id: Optional[int] = None
    action_time: Optional[str] = None


class AgentInteraction(BaseModel):
    from_agent_id: int
    to_agent_id: int
    channel: str
    content: str
    created_at: str


# ──── Endpoints ────

@router.get("/tiles", response_model=list[TileResponse])
async def get_tiles(
    x_min: int = Query(0, ge=0, le=199),
    x_max: int = Query(50, ge=0, le=199),
    y_min: int = Query(0, ge=0, le=199),
    y_max: int = Query(50, ge=0, le=199),
    db: AsyncSession = Depends(get_db),
):
    """Return tiles in a rectangular viewport region.

    Optimized: uses raw SQL for minimal overhead on large queries.
    Max viewport: 100x100 tiles (10,000 tiles).
    """
    # Cap viewport size
    if (x_max - x_min + 1) * (y_max - y_min + 1) > 10000:
        raise HTTPException(status_code=400, detail="Viewport trop grand (max 100x100 = 10000 tiles)")

    if x_min > x_max or y_min > y_max:
        raise HTTPException(status_code=400, detail="Coordonnees invalides (min > max)")

    # Use raw SQL for performance — avoid ORM overhead for up to 10k rows
    result = await db.execute(
        text(
            "SELECT x, y, owner_agent_id, terrain, structure, structure_level, world_zone "
            "FROM world_tiles "
            "WHERE x >= :x_min AND x <= :x_max AND y >= :y_min AND y <= :y_max"
        ),
        {"x_min": x_min, "x_max": x_max, "y_min": y_min, "y_max": y_max},
    )
    rows = result.all()

    return [
        TileResponse(
            x=r[0], y=r[1], owner_agent_id=r[2], terrain=r[3],
            structure=r[4], structure_level=r[5], world_zone=r[6],
        )
        for r in rows
    ]


@router.get("/tiles/agent/{agent_id}", response_model=list[TileResponse])
async def get_agent_tiles(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Return all tiles owned by an agent."""
    result = await db.execute(
        select(WorldTile).where(WorldTile.owner_agent_id == agent_id)
    )
    tiles = result.scalars().all()
    return [
        TileResponse(
            x=t.x, y=t.y, owner_agent_id=t.owner_agent_id, terrain=t.terrain,
            structure=t.structure, structure_level=t.structure_level, world_zone=t.world_zone,
        )
        for t in tiles
    ]


@router.get("/stats", response_model=WorldStatsResponse)
async def get_world_stats(
    db: AsyncSession = Depends(get_db),
):
    """Return aggregate world statistics."""
    # Total claimed tiles
    claimed_result = await db.execute(
        select(func.count())
        .select_from(WorldTile)
        .where(WorldTile.owner_agent_id.isnot(None))
    )
    total_claimed = claimed_result.scalar() or 0

    # Total structures
    structs_result = await db.execute(
        select(func.count())
        .select_from(WorldTile)
        .where(WorldTile.structure.isnot(None))
    )
    total_structures = structs_result.scalar() or 0

    # Tiles per zone (claimed)
    zone_result = await db.execute(
        select(WorldTile.world_zone, func.count())
        .where(WorldTile.owner_agent_id.isnot(None))
        .group_by(WorldTile.world_zone)
    )
    tiles_per_zone = {str(r[0]): r[1] for r in zone_result.all()}

    # Structures per type
    struct_type_result = await db.execute(
        select(WorldTile.structure, func.count())
        .where(WorldTile.structure.isnot(None))
        .group_by(WorldTile.structure)
    )
    structures_per_type = {r[0]: r[1] for r in struct_type_result.all()}

    return WorldStatsResponse(
        total_claimed=total_claimed,
        total_structures=total_structures,
        tiles_per_zone=tiles_per_zone,
        structures_per_type=structures_per_type,
    )


@router.get("/zones", response_model=list[ZoneInfo])
async def get_zones():
    """Return zone definitions (bounds, colors, descriptions)."""
    return [
        ZoneInfo(zone_id=zid, name=zd["name"], color=zd["color"], description=zd["description"])
        for zid, zd in ZONE_DEFS.items()
    ]


@router.post("/generate")
async def generate_world_endpoint(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate the world grid (admin only, one-time).

    Creates the full 200x200 tile grid if not already generated.
    """
    # Simple admin check — only verified users can trigger generation
    # In production, add a proper admin role check
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Compte non verifie")

    if await is_world_generated(db):
        return {"status": "already_generated", "message": "Le monde existe deja"}

    count = await generate_world(db)
    return {"status": "generated", "tiles_created": count}


@router.get("/build-log/{agent_id}", response_model=list[BuildLogResponse])
async def get_build_log(
    agent_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Return build history for an agent."""
    result = await db.execute(
        select(BuildLog)
        .where(BuildLog.agent_id == agent_id)
        .order_by(BuildLog.created_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()
    return [
        BuildLogResponse(
            id=l.id,
            agent_id=l.agent_id,
            action=l.action,
            tile_x=l.tile_x,
            tile_y=l.tile_y,
            structure=l.structure,
            level=l.level,
            cost_aky=l.cost_aky,
            build_points=l.build_points,
            tx_hash=getattr(l, "tx_hash", None),
            created_at=l.created_at.isoformat(),
        )
        for l in logs
    ]


# ──── Sims-like agent activity endpoint ────

@router.get("/agents-activity", response_model=dict)
async def get_agents_activity(
    db: AsyncSession = Depends(get_db),
):
    """Return live agent activity data for the Sims-like map view.

    Returns agents with their position, current action, emotional state,
    last message, and recent interactions between agents.
    Optimized: single query per data type, cached-friendly (5s poll).
    """
    cutoff = datetime.utcnow() - timedelta(minutes=10)

    # 1. Get all agents with claimed tiles (their "home" position = first tile)
    agent_tiles_result = await db.execute(
        text(
            "SELECT owner_agent_id, MIN(x) as x, MIN(y) as y "
            "FROM world_tiles "
            "WHERE owner_agent_id IS NOT NULL "
            "GROUP BY owner_agent_id"
        )
    )
    agent_positions = {r[0]: (r[1], r[2]) for r in agent_tiles_result.all()}

    if not agent_positions:
        return {"agents": [], "interactions": []}

    agent_ids = list(agent_positions.keys())

    # 2. Latest private thought per agent (emotional state + action)
    # Use a subquery to get the latest thought per agent
    latest_thoughts: dict[int, PrivateThought] = {}
    for aid in agent_ids:
        result = await db.execute(
            select(PrivateThought)
            .where(
                PrivateThought.agent_id == aid,
                PrivateThought.created_at >= cutoff,
            )
            .order_by(PrivateThought.created_at.desc())
            .limit(1)
        )
        thought = result.scalar_one_or_none()
        if thought:
            latest_thoughts[aid] = thought

    # 3. Latest public message per agent (for speech bubbles)
    latest_messages: dict[int, str] = {}
    for aid in agent_ids:
        result = await db.execute(
            select(TickLog.message)
            .where(
                TickLog.agent_id == aid,
                TickLog.message.isnot(None),
                TickLog.message != "",
                TickLog.created_at >= cutoff,
            )
            .order_by(TickLog.created_at.desc())
            .limit(1)
        )
        row = result.first()
        if row and row[0]:
            latest_messages[aid] = row[0][:120]  # Cap at 120 chars

    # 4. Recent interactions (DMs between agents in last 10 min)
    interactions_result = await db.execute(
        select(Message)
        .where(
            Message.created_at >= cutoff,
            Message.channel.in_(["private", "world"]),
        )
        .order_by(Message.created_at.desc())
        .limit(30)
    )
    recent_interactions = interactions_result.scalars().all()

    # Build response
    agents_out = []
    for aid in agent_ids:
        pos = agent_positions[aid]
        thought = latest_thoughts.get(aid)
        msg = latest_messages.get(aid)

        # Determine target_agent_id from action params (for interaction lines)
        target_id = None
        if thought and thought.action_params:
            target_id = thought.action_params.get("to_agent_id") or thought.action_params.get("target_agent_id")

        agents_out.append(AgentActivityResponse(
            agent_id=aid,
            x=pos[0],
            y=pos[1],
            action_type=thought.action_type if thought else None,
            emotional_state=thought.emotional_state if thought else None,
            message=msg,
            vault_aky=thought.vault_aky if thought else 0.0,
            tier=thought.tier if thought else 1,
            target_agent_id=target_id,
            action_time=thought.created_at.isoformat() if thought else None,
        ))

    interactions_out = [
        AgentInteraction(
            from_agent_id=m.from_agent_id,
            to_agent_id=m.to_agent_id,
            channel=m.channel,
            content=m.content[:80],
            created_at=m.created_at.isoformat(),
        )
        for m in recent_interactions
    ]

    return {"agents": agents_out, "interactions": interactions_out}


# ──── Living Graph — force-directed blockchain visualization ────

class RecentTx(BaseModel):
    event_type: str
    summary: str
    target_agent_id: Optional[int] = None
    amount: Optional[float] = None
    tx_hash: Optional[str] = None
    block_number: Optional[int] = None
    created_at: str


class GraphNode(BaseModel):
    agent_id: int
    vault_aky: float
    tier: int
    world: int
    alive: bool
    emotional_state: Optional[str] = None
    action_type: Optional[str] = None
    message: Optional[str] = None
    tiles_count: int = 0
    # v2: blockchain details
    sponsor: Optional[str] = None          # wallet address
    reputation: int = 0
    contracts_honored: int = 0
    contracts_broken: int = 0
    total_ticks: int = 0
    born_at: Optional[str] = None
    recent_txs: list[RecentTx] = []


class GraphEdge(BaseModel):
    source: int
    target: int
    weight: float
    msg_count: int = 0
    transfer_count: int = 0
    raid_count: int = 0
    escrow_count: int = 0
    idea_count: int = 0
    first_interaction: Optional[str] = None
    last_interaction: Optional[str] = None
    net_aky_source: float = 0.0
    net_aky_target: float = 0.0


class GraphToken(BaseModel):
    creator_agent_id: int
    symbol: Optional[str] = None
    trade_count: int = 0
    created_at: str


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    tokens: list[GraphToken]
    dead_agents: list[int]


def _calc_tier(vault_aky: float) -> int:
    if vault_aky >= 5000:
        return 4
    if vault_aky >= 500:
        return 3
    if vault_aky >= 50:
        return 2
    return 1


@router.get("/graph", response_model=GraphResponse)
async def get_world_graph(
    db: AsyncSession = Depends(get_db),
):
    """Return force-directed graph data for the living blockchain visualization.

    Aggregates agent state, interaction edges, token creation, and death events
    into a single payload optimized for client-side force simulation (5s poll).
    """
    # 1. All agent configs
    agents_result = await db.execute(select(AgentConfig))
    agents = agents_result.scalars().all()

    if not agents:
        return GraphResponse(nodes=[], edges=[], tokens=[], dead_agents=[])

    agent_ids = [a.agent_id for a in agents]
    agent_map = {a.agent_id: a for a in agents}

    # 2. Latest state per agent (batch — one query via subquery)
    latest_thoughts: dict[int, dict] = {}
    thoughts_result = await db.execute(
        text(
            "SELECT pt.agent_id, pt.emotional_state, pt.action_type, "
            "       pt.world, pt.vault_aky, pt.tier, pt.message "
            "FROM private_thoughts pt "
            "INNER JOIN ("
            "  SELECT agent_id, MAX(created_at) AS max_ca "
            "  FROM private_thoughts GROUP BY agent_id"
            ") latest ON pt.agent_id = latest.agent_id "
            "       AND pt.created_at = latest.max_ca"
        )
    )
    for r in thoughts_result.all():
        latest_thoughts[r[0]] = {
            "emotional_state": r[1],
            "action_type": r[2],
            "world": r[3],
            "vault_aky": r[4],
            "tier": r[5],
            "message": r[6],
        }

    # 3. Latest public message per agent (batch)
    latest_messages: dict[int, str] = {}
    msg_result = await db.execute(
        text(
            "SELECT tl.agent_id, tl.message "
            "FROM tick_logs tl "
            "INNER JOIN ("
            "  SELECT agent_id, MAX(created_at) AS max_ca "
            "  FROM tick_logs "
            "  WHERE message IS NOT NULL AND message != '' "
            "  GROUP BY agent_id"
            ") latest ON tl.agent_id = latest.agent_id "
            "       AND tl.created_at = latest.max_ca "
            "WHERE tl.message IS NOT NULL AND tl.message != ''"
        )
    )
    for r in msg_result.all():
        if r[1]:
            latest_messages[r[0]] = r[1][:120]

    # 4. Tiles per agent
    tiles_result = await db.execute(
        text(
            "SELECT owner_agent_id, COUNT(*) "
            "FROM world_tiles "
            "WHERE owner_agent_id IS NOT NULL "
            "GROUP BY owner_agent_id"
        )
    )
    tiles_per_agent = {r[0]: r[1] for r in tiles_result.all()}

    # 5. Message counts between agent pairs (bidirectional, merged)
    msg_edge_result = await db.execute(
        text(
            "SELECT LEAST(from_agent_id, to_agent_id), "
            "       GREATEST(from_agent_id, to_agent_id), "
            "       COUNT(*), MIN(created_at), MAX(created_at) "
            "FROM messages "
            "GROUP BY LEAST(from_agent_id, to_agent_id), "
            "         GREATEST(from_agent_id, to_agent_id)"
        )
    )
    msg_edges: dict[tuple, dict] = {}
    for r in msg_edge_result.all():
        msg_edges[(r[0], r[1])] = {"count": r[2], "first": r[3], "last": r[4]}

    # 6. Transfer counts between agent pairs
    transfer_result = await db.execute(
        text(
            "SELECT LEAST(agent_id, target_agent_id), "
            "       GREATEST(agent_id, target_agent_id), "
            "       COUNT(*), MIN(created_at), MAX(created_at) "
            "FROM events "
            "WHERE event_type = 'transfer' "
            "  AND agent_id IS NOT NULL "
            "  AND target_agent_id IS NOT NULL "
            "GROUP BY LEAST(agent_id, target_agent_id), "
            "         GREATEST(agent_id, target_agent_id)"
        )
    )
    transfer_edges: dict[tuple, dict] = {}
    for r in transfer_result.all():
        transfer_edges[(r[0], r[1])] = {"count": r[2], "first": r[3], "last": r[4]}

    # 6b. Raid counts between agent pairs
    raid_result = await db.execute(
        text(
            "SELECT LEAST(attacker_agent_id, defender_agent_id), "
            "       GREATEST(attacker_agent_id, defender_agent_id), "
            "       COUNT(*), MIN(created_at), MAX(created_at), "
            "       SUM(COALESCE(aky_gained, 0) - COALESCE(aky_cost, 0)) "
            "FROM raids "
            "GROUP BY LEAST(attacker_agent_id, defender_agent_id), "
            "         GREATEST(attacker_agent_id, defender_agent_id)"
        )
    )
    raid_edges: dict[tuple, dict] = {}
    for r in raid_result.all():
        raid_edges[(r[0], r[1])] = {"count": r[2], "first": r[3], "last": r[4], "net_aky": float(r[5] or 0)}

    # 6c. Escrow counts between agent pairs
    escrow_result = await db.execute(
        text(
            "SELECT LEAST(agent_id, target_agent_id), "
            "       GREATEST(agent_id, target_agent_id), "
            "       COUNT(*), MIN(created_at), MAX(created_at) "
            "FROM events "
            "WHERE event_type IN ('create_escrow', 'escrow_created') "
            "  AND agent_id IS NOT NULL "
            "  AND target_agent_id IS NOT NULL "
            "GROUP BY LEAST(agent_id, target_agent_id), "
            "         GREATEST(agent_id, target_agent_id)"
        )
    )
    escrow_edges: dict[tuple, dict] = {}
    for r in escrow_result.all():
        escrow_edges[(r[0], r[1])] = {"count": r[2], "first": r[3], "last": r[4]}

    # 6d. Idea interactions between agent pairs
    idea_result = await db.execute(
        text(
            "SELECT LEAST(agent_id, target_agent_id), "
            "       GREATEST(agent_id, target_agent_id), "
            "       COUNT(*), MIN(created_at), MAX(created_at) "
            "FROM events "
            "WHERE event_type IN ('idea_liked', 'idea_transmitted', 'like_idea') "
            "  AND agent_id IS NOT NULL "
            "  AND target_agent_id IS NOT NULL "
            "GROUP BY LEAST(agent_id, target_agent_id), "
            "         GREATEST(agent_id, target_agent_id)"
        )
    )
    idea_edges: dict[tuple, dict] = {}
    for r in idea_result.all():
        idea_edges[(r[0], r[1])] = {"count": r[2], "first": r[3], "last": r[4]}

    # 7. Merge all edge types
    all_pairs = set(msg_edges.keys()) | set(transfer_edges.keys()) | set(raid_edges.keys()) | set(escrow_edges.keys()) | set(idea_edges.keys())
    edges = []
    for pair in all_pairs:
        mc = msg_edges.get(pair, {}).get("count", 0)
        tc = transfer_edges.get(pair, {}).get("count", 0)
        rc = raid_edges.get(pair, {}).get("count", 0)
        ec = escrow_edges.get(pair, {}).get("count", 0)
        ic = idea_edges.get(pair, {}).get("count", 0)

        # Temporal data: earliest first, latest last across all types
        all_firsts = [d["first"] for d in [msg_edges.get(pair, {}), transfer_edges.get(pair, {}), raid_edges.get(pair, {}), escrow_edges.get(pair, {}), idea_edges.get(pair, {})] if d.get("first")]
        all_lasts = [d["last"] for d in [msg_edges.get(pair, {}), transfer_edges.get(pair, {}), raid_edges.get(pair, {}), escrow_edges.get(pair, {}), idea_edges.get(pair, {})] if d.get("last")]
        first_i = min(all_firsts).isoformat() if all_firsts else None
        last_i = max(all_lasts).isoformat() if all_lasts else None

        # Net AKY from raids
        net_aky = raid_edges.get(pair, {}).get("net_aky", 0.0)

        edges.append(GraphEdge(
            source=pair[0],
            target=pair[1],
            weight=mc + tc * 2 + rc * 3 + ec * 2 + ic,
            msg_count=mc,
            transfer_count=tc,
            raid_count=rc,
            escrow_count=ec,
            idea_count=ic,
            first_interaction=first_i,
            last_interaction=last_i,
            net_aky_source=net_aky,
            net_aky_target=-net_aky,
        ))

    # 8. Token creation
    token_result = await db.execute(
        select(Event)
        .where(Event.event_type == "create_token")
        .order_by(Event.created_at.desc())
    )
    token_events = token_result.scalars().all()
    tokens = [
        GraphToken(
            creator_agent_id=te.agent_id,
            symbol=(te.data or {}).get("symbol"),
            trade_count=0,
            created_at=te.created_at.isoformat(),
        )
        for te in token_events
        if te.agent_id is not None
    ]

    # 9. Dead agents
    death_result = await db.execute(
        text(
            "SELECT DISTINCT agent_id FROM events "
            "WHERE event_type = 'death' AND agent_id IS NOT NULL"
        )
    )
    dead_ids = [r[0] for r in death_result.all()]
    dead_set = set(dead_ids)

    # 10. Sponsor wallets (via user → agent_config join)
    sponsor_result = await db.execute(
        text(
            "SELECT ac.agent_id, u.wallet_address "
            "FROM agent_configs ac "
            "JOIN users u ON ac.user_id = u.id"
        )
    )
    sponsor_wallets: dict[int, str | None] = {r[0]: r[1] for r in sponsor_result.all()}

    # 11. Recent transactions per agent (last 5 events per agent, batch)
    recent_txs_result = await db.execute(
        text(
            "SELECT e.agent_id, e.event_type, e.summary, e.target_agent_id, "
            "       e.data, e.tx_hash, e.block_number, e.created_at "
            "FROM events e "
            "WHERE e.agent_id IS NOT NULL "
            "ORDER BY e.created_at DESC "
            "LIMIT 200"
        )
    )
    agent_recent_txs: dict[int, list[RecentTx]] = {}
    for r in recent_txs_result.all():
        aid = r[0]
        if aid not in agent_recent_txs:
            agent_recent_txs[aid] = []
        if len(agent_recent_txs[aid]) < 5:
            data = r[4] if r[4] else {}
            amount = None
            if isinstance(data, dict):
                amount = data.get("amount")
            agent_recent_txs[aid].append(RecentTx(
                event_type=r[1],
                summary=r[2],
                target_agent_id=r[3],
                amount=float(amount) if amount is not None else None,
                tx_hash=r[5],
                block_number=r[6],
                created_at=r[7].isoformat() if r[7] else "",
            ))

    # 12. Build nodes
    nodes = []
    for aid in agent_ids:
        ac = agent_map[aid]
        thought = latest_thoughts.get(aid)
        vault = thought["vault_aky"] if thought else ac.vault_aky
        msg = latest_messages.get(aid)
        if not msg and thought and thought["message"]:
            msg = thought["message"][:120]

        nodes.append(GraphNode(
            agent_id=aid,
            vault_aky=vault,
            tier=_calc_tier(vault),
            world=thought["world"] if thought else 0,
            alive=aid not in dead_set,
            emotional_state=thought["emotional_state"] if thought else None,
            action_type=thought["action_type"] if thought else None,
            message=msg,
            tiles_count=tiles_per_agent.get(aid, 0),
            sponsor=sponsor_wallets.get(aid),
            total_ticks=ac.total_ticks or 0,
            born_at=ac.created_at.isoformat() if ac.created_at else None,
            recent_txs=agent_recent_txs.get(aid, []),
        ))

    return GraphResponse(
        nodes=nodes,
        edges=edges,
        tokens=tokens,
        dead_agents=dead_ids,
    )
