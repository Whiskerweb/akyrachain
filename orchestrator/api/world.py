"""World API — galaxy graph visualization, agent activity."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import get_db
from models.tick_log import TickLog
from models.private_thought import PrivateThought
from models.message import Message
from models.agent_config import AgentConfig
from chain.cache import get_agents_cached_map
from models.event import Event
from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/world", tags=["world"])


# ──── Schemas ────

class AgentInteraction(BaseModel):
    from_agent_id: int
    to_agent_id: int
    channel: str
    content: str
    created_at: str


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
    escrow_count: int = 0
    idea_count: int = 0
    first_interaction: Optional[str] = None
    last_interaction: Optional[str] = None
    net_aky_source: float = 0.0
    net_aky_target: float = 0.0


class EdgeTransaction(BaseModel):
    tx_type: str
    event_type: str
    summary: str
    from_agent_id: int
    to_agent_id: int
    amount: Optional[float] = None
    tx_hash: Optional[str] = None
    block_number: Optional[int] = None
    extra: Optional[dict] = None
    created_at: str


class EdgeDetailResponse(BaseModel):
    agent_a: int
    agent_b: int
    transactions: list[EdgeTransaction]
    total_count: int
    msg_count: int
    transfer_count: int
    escrow_count: int
    idea_count: int


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
    include_txs: bool = Query(False, description="Include recent_txs per agent (heavier payload)"),
    max_edges: int = Query(200, ge=10, le=1000, description="Max edges to return"),
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

    # 4. Message counts between agent pairs (bidirectional, merged)
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

    # 5. Transfer counts between agent pairs
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

    # 6. Escrow counts between agent pairs
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

    # 7. Idea interactions between agent pairs
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

    # 8. Merge all edge types (capped at max_edges)
    all_pairs = set(msg_edges.keys()) | set(transfer_edges.keys()) | set(escrow_edges.keys()) | set(idea_edges.keys())
    edges = []
    for pair in all_pairs:
        mc = msg_edges.get(pair, {}).get("count", 0)
        tc = transfer_edges.get(pair, {}).get("count", 0)
        ec = escrow_edges.get(pair, {}).get("count", 0)
        ic = idea_edges.get(pair, {}).get("count", 0)

        # Temporal data: earliest first, latest last across all types
        all_firsts = [d["first"] for d in [msg_edges.get(pair, {}), transfer_edges.get(pair, {}), escrow_edges.get(pair, {}), idea_edges.get(pair, {})] if d.get("first")]
        all_lasts = [d["last"] for d in [msg_edges.get(pair, {}), transfer_edges.get(pair, {}), escrow_edges.get(pair, {}), idea_edges.get(pair, {})] if d.get("last")]
        first_i = min(all_firsts).isoformat() if all_firsts else None
        last_i = max(all_lasts).isoformat() if all_lasts else None

        edges.append(GraphEdge(
            source=pair[0],
            target=pair[1],
            weight=mc + tc * 2 + ec * 2 + ic,
            msg_count=mc,
            transfer_count=tc,
            escrow_count=ec,
            idea_count=ic,
            first_interaction=first_i,
            last_interaction=last_i,
        ))

    # Cap edges by weight (most active relationships first)
    edges.sort(key=lambda e: e.weight, reverse=True)
    edges = edges[:max_edges]

    # 9. Token creation
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

    # 10. Dead agents
    death_result = await db.execute(
        text(
            "SELECT DISTINCT agent_id FROM events "
            "WHERE event_type = 'death' AND agent_id IS NOT NULL"
        )
    )
    dead_ids = [r[0] for r in death_result.all()]
    dead_set = set(dead_ids)

    # 11. Sponsor wallets (via user → agent_config join)
    sponsor_result = await db.execute(
        text(
            "SELECT ac.agent_id, u.wallet_address "
            "FROM agent_configs ac "
            "JOIN users u ON ac.user_id = u.id"
        )
    )
    sponsor_wallets: dict[int, str | None] = {r[0]: r[1] for r in sponsor_result.all()}

    # 12. Recent transactions per agent (only if requested — saves ~80% payload)
    agent_recent_txs: dict[int, list[RecentTx]] = {}
    if include_txs:
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

    # 13. Read real on-chain vault balances (batch cached, parallel)
    on_chain_map = await get_agents_cached_map(agent_ids)
    on_chain_vaults: dict[int, float] = {
        aid: on_chain_map[aid]["vault"] / 10**18 if aid in on_chain_map else 0.0
        for aid in agent_ids
    }

    # 14. Build nodes
    nodes = []
    for aid in agent_ids:
        ac = agent_map[aid]
        thought = latest_thoughts.get(aid)
        vault = on_chain_vaults.get(aid, 0.0)
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


@router.get("/edge/{agent_a}/{agent_b}", response_model=EdgeDetailResponse)
async def get_edge_detail(
    agent_a: int,
    agent_b: int,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Return all transactions between two agents, with tx_hash for blockchain verification."""
    a, b = min(agent_a, agent_b), max(agent_a, agent_b)

    # 1. Messages
    msg_result = await db.execute(
        text(
            "SELECT from_agent_id, to_agent_id, content, tx_hash, created_at "
            "FROM messages "
            "WHERE (from_agent_id = :a AND to_agent_id = :b) "
            "   OR (from_agent_id = :b AND to_agent_id = :a) "
            "ORDER BY created_at DESC"
        ),
        {"a": a, "b": b},
    )
    txs: list[dict] = []
    for r in msg_result.all():
        txs.append({
            "tx_type": "message",
            "event_type": "send_message",
            "summary": r[2][:200] if r[2] else "",
            "from_agent_id": r[0],
            "to_agent_id": r[1],
            "amount": None,
            "tx_hash": r[3],
            "block_number": None,
            "extra": None,
            "created_at": r[4],
        })

    # 2. Events (transfers, escrows, ideas)
    evt_result = await db.execute(
        text(
            "SELECT event_type, summary, agent_id, target_agent_id, "
            "       data, tx_hash, block_number, created_at "
            "FROM events "
            "WHERE ((agent_id = :a AND target_agent_id = :b) "
            "    OR (agent_id = :b AND target_agent_id = :a)) "
            "  AND event_type IN ('transfer', 'create_escrow', 'escrow_created', "
            "                     'idea_liked', 'idea_transmitted', 'like_idea') "
            "ORDER BY created_at DESC"
        ),
        {"a": a, "b": b},
    )
    for r in evt_result.all():
        et = r[0]
        if et == "transfer":
            tx_type = "transfer"
        elif et in ("create_escrow", "escrow_created"):
            tx_type = "escrow"
        else:
            tx_type = "idea"
        data = r[4] if r[4] else {}
        amount = None
        if isinstance(data, dict):
            amount = data.get("amount")
        txs.append({
            "tx_type": tx_type,
            "event_type": et,
            "summary": r[1] or "",
            "from_agent_id": r[2],
            "to_agent_id": r[3],
            "amount": float(amount) if amount is not None else None,
            "tx_hash": r[5],
            "block_number": r[6],
            "extra": data if isinstance(data, dict) and data else None,
            "created_at": r[7],
        })

    # Sort all by date desc, count types
    txs.sort(key=lambda t: t["created_at"] or datetime.min, reverse=True)
    total = len(txs)
    mc = sum(1 for t in txs if t["tx_type"] == "message")
    tc = sum(1 for t in txs if t["tx_type"] == "transfer")
    ec = sum(1 for t in txs if t["tx_type"] == "escrow")
    ic = sum(1 for t in txs if t["tx_type"] == "idea")

    # Paginate
    page = txs[offset:offset + limit]

    return EdgeDetailResponse(
        agent_a=a,
        agent_b=b,
        transactions=[
            EdgeTransaction(
                tx_type=t["tx_type"],
                event_type=t["event_type"],
                summary=t["summary"],
                from_agent_id=t["from_agent_id"],
                to_agent_id=t["to_agent_id"],
                amount=t["amount"],
                tx_hash=t["tx_hash"],
                block_number=t["block_number"],
                extra=t["extra"],
                created_at=t["created_at"].isoformat() if hasattr(t["created_at"], "isoformat") else str(t["created_at"]),
            )
            for t in page
        ],
        total_count=total,
        msg_count=mc,
        transfer_count=tc,
        escrow_count=ec,
        idea_count=ic,
    )
