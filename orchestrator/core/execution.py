"""Execution engine — maps validated actions to on-chain transactions."""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass

from core.decision import AgentAction
from chain import tx_manager

logger = logging.getLogger(__name__)


@dataclass
class ExecutionResult:
    """Result of executing an action on-chain."""
    success: bool
    tx_hash: str | None = None
    error: str | None = None


async def execute_action(agent_id: int, action: AgentAction) -> ExecutionResult:
    """Execute a validated action on-chain via the appropriate contract call.

    Args:
        agent_id: The on-chain agent ID
        action: The validated action from the decision parser

    Returns:
        ExecutionResult with tx_hash on success, error on failure
    """
    if action.action_type == "do_nothing":
        return ExecutionResult(success=True)

    try:
        tx_hash = await _dispatch(agent_id, action)
        logger.info(f"Agent #{agent_id} executed {action.action_type}: {tx_hash}")
        return ExecutionResult(success=True, tx_hash=tx_hash)
    except Exception as e:
        logger.error(f"Agent #{agent_id} failed {action.action_type}: {e}")
        return ExecutionResult(success=False, error=str(e))


async def _dispatch(agent_id: int, action: AgentAction) -> str:
    """Route action to the correct tx_manager function."""
    p = action.params
    t = action.action_type

    if t == "transfer":
        return await tx_manager.transfer_between_agents(
            from_id=agent_id,
            to_id=int(p["to_agent_id"]),
            amount=int(p["amount"]),
        )

    if t == "move_world":
        return await tx_manager.move_world(
            agent_id=agent_id,
            new_world=int(p["world_id"]),
        )

    if t == "create_token":
        return await tx_manager.create_token(
            agent_id=agent_id,
            name=str(p["name"]),
            symbol=str(p["symbol"]),
            max_supply=int(p["supply"]),
        )

    if t == "create_nft":
        return await tx_manager.create_nft(
            agent_id=agent_id,
            name=str(p["name"]),
            symbol=str(p["symbol"]),
            max_supply=int(p["max_supply"]),
            base_uri="",  # Default empty, agents don't set URIs
        )

    if t == "create_escrow":
        desc_hash = hashlib.sha256(str(p["description"]).encode()).digest()
        return await tx_manager.create_escrow(
            client_id=agent_id,
            provider_id=int(p["provider_id"]),
            evaluator_id=int(p["evaluator_id"]),
            amount=int(p["amount"]),
            description_hash=desc_hash,
        )

    if t == "post_idea":
        content_hash = hashlib.sha256(str(p["content"]).encode()).digest()
        return await tx_manager.post_idea(
            agent_id=agent_id,
            content_hash=content_hash,
        )

    if t == "like_idea":
        return await tx_manager.like_idea(
            agent_id=agent_id,
            idea_id=int(p["idea_id"]),
        )

    if t == "join_clan":
        return await tx_manager.join_clan(
            clan_id=int(p["clan_id"]),
            agent_id=agent_id,
        )

    if t == "send_message":
        # send_message is off-chain only (stored in DB/events, no TX needed)
        return ""

    raise ValueError(f"No handler for action: {t}")
