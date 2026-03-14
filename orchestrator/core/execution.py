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


SPATIAL_ACTIONS = {"claim_tile", "build", "upgrade", "demolish", "raid"}
DB_ACTIONS = {"post_idea", "like_idea"}


async def _get_token_from_receipt(tx_hash: str) -> str | None:
    """Extract token address from a ForgeFactory.createToken TX receipt (TokenCreated event)."""
    from chain.contracts import get_w3, Contracts
    w3 = get_w3()
    receipt = await w3.eth.get_transaction_receipt(tx_hash)
    forge = Contracts.forge_factory()
    try:
        logs = forge.events.TokenCreated().process_receipt(receipt)
        if logs:
            return logs[0]["args"]["token"]
    except Exception:
        pass
    # Fallback: newest creation from ForgeFactory
    try:
        length = await forge.functions.allCreationsLength().call()
        if length > 0:
            return await forge.functions.allCreations(length - 1).call()
    except Exception:
        pass
    return None


async def execute_action(agent_id: int, action: AgentAction, db=None) -> ExecutionResult:
    """Execute a validated action on-chain via the appropriate contract call.

    Args:
        agent_id: The on-chain agent ID
        action: The validated action from the decision parser
        db: Optional AsyncSession for spatial actions that need DB access

    Returns:
        ExecutionResult with tx_hash on success, error on failure
    """
    if action.action_type == "do_nothing":
        return ExecutionResult(success=True)

    # Spatial actions need DB access
    if action.action_type in SPATIAL_ACTIONS:
        if db is None:
            return ExecutionResult(success=False, error="DB session required for spatial actions")
        return await _dispatch_spatial(agent_id, action, db)

    # Ideas actions need DB access for storing content / updating likes
    if action.action_type in DB_ACTIONS:
        if db is None:
            return ExecutionResult(success=False, error="DB session required for idea actions")
        return await _dispatch_idea(agent_id, action, db)

    # Chronicle: submit_story needs DB + on-chain debit
    if action.action_type == "submit_story":
        if db is None:
            return ExecutionResult(success=False, error="DB session required for submit_story")
        return await _dispatch_story(agent_id, action, db)

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
        tx_hash = await tx_manager.create_token(
            agent_id=agent_id,
            name=str(p["name"]),
            symbol=str(p["symbol"]),
            max_supply=int(p["supply"]),
        )

        # Auto-create AkyraSwap liquidity pool
        try:
            token_address = await _get_token_from_receipt(tx_hash)
            if token_address:
                supply = int(p["supply"])
                pool_tokens = supply // 2  # 50% of supply as liquidity
                pool_aky = 10 * 10**18     # 10 AKY initial liquidity
                await tx_manager.create_swap_pool(
                    agent_id=agent_id,
                    token_address=token_address,
                    token_amount=pool_tokens,
                    aky_amount=pool_aky,
                )
                logger.info(f"Agent #{agent_id} auto-created pool for {token_address}")
        except Exception as e:
            logger.warning(f"Agent #{agent_id} pool creation failed (token still created): {e}")

        return tx_hash

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

    if t == "join_clan":
        return await tx_manager.join_clan(
            clan_id=int(p["clan_id"]),
            agent_id=agent_id,
        )

    if t == "send_message":
        # send_message is off-chain only (stored in DB, no TX needed)
        return ""

    if t == "broadcast":
        # broadcast is off-chain only (world chat, no TX needed)
        return ""

    raise ValueError(f"No handler for action: {t}")


async def _dispatch_spatial(agent_id: int, action: AgentAction, db) -> ExecutionResult:
    """Route spatial/territorial actions to world_actions."""
    from core.world_actions import (
        claim_tile, build_structure, upgrade_structure,
        demolish_structure, raid_territory,
    )

    p = action.params
    t = action.action_type

    try:
        if t == "claim_tile":
            return await claim_tile(agent_id, int(p["x"]), int(p["y"]), db)

        if t == "build":
            return await build_structure(agent_id, int(p["x"]), int(p["y"]), str(p["structure"]), db)

        if t == "upgrade":
            return await upgrade_structure(agent_id, int(p["x"]), int(p["y"]), db)

        if t == "demolish":
            return await demolish_structure(agent_id, int(p["x"]), int(p["y"]), db)

        if t == "raid":
            return await raid_territory(agent_id, int(p["target_agent_id"]), db)

        return ExecutionResult(success=False, error=f"Unknown spatial action: {t}")
    except Exception as e:
        logger.error(f"Agent #{agent_id} spatial action {t} failed: {e}")
        return ExecutionResult(success=False, error=str(e))


async def _dispatch_idea(agent_id: int, action: AgentAction, db) -> ExecutionResult:
    """Handle idea actions: store content in DB + send on-chain."""
    from sqlalchemy import select
    from models.idea import Idea

    p = action.params
    t = action.action_type

    try:
        if t == "post_idea":
            content = str(p["content"])
            content_hash = hashlib.sha256(content.encode()).digest()

            # Send on-chain first to get the ideaId
            tx_hash = await tx_manager.post_idea(
                agent_id=agent_id,
                content_hash=content_hash,
            )

            # Read ideaCount from on-chain to get the new idea's ID
            try:
                from chain.contracts import Contracts
                marketplace = Contracts.network_marketplace()
                idea_id = await marketplace.functions.ideaCount().call()
            except Exception:
                idea_id = None

            # Store content in DB
            idea = Idea(
                agent_id=agent_id,
                content=content,
                content_hash="0x" + content_hash.hex(),
                tx_hash=tx_hash,
            )
            if idea_id is not None:
                idea.id = idea_id
            db.add(idea)
            await db.commit()

            logger.info(f"Agent #{agent_id} posted idea (id={idea_id}): {tx_hash}")
            return ExecutionResult(success=True, tx_hash=tx_hash)

        if t == "like_idea":
            idea_id = int(p["idea_id"])

            # Send on-chain
            tx_hash = await tx_manager.like_idea(
                agent_id=agent_id,
                idea_id=idea_id,
            )

            # Increment likes in DB
            result = await db.execute(select(Idea).where(Idea.id == idea_id))
            idea = result.scalar_one_or_none()
            if idea is not None:
                idea.likes += 1
                db.add(idea)
                await db.commit()

            logger.info(f"Agent #{agent_id} liked idea #{idea_id}: {tx_hash}")
            return ExecutionResult(success=True, tx_hash=tx_hash)

        return ExecutionResult(success=False, error=f"Unknown idea action: {t}")
    except Exception as e:
        logger.error(f"Agent #{agent_id} idea action {t} failed: {e}")
        await db.rollback()
        return ExecutionResult(success=False, error=str(e))


async def _dispatch_story(agent_id: int, action: AgentAction, db) -> ExecutionResult:
    """Handle submit_story: debit anti-spam fee + store story in DB."""
    from models.story import Story

    p = action.params

    try:
        # Debit 5 AKY anti-spam fee from agent vault
        fee_wei = 5 * 10**18
        fee_hash = await tx_manager.debit_vault(agent_id, fee_wei)

        # Store story in DB
        story = Story(
            agent_id=agent_id,
            content=str(p["content"]),
            tx_hash=fee_hash,
        )
        db.add(story)
        await db.commit()

        logger.info(f"Agent #{agent_id} submitted story (fee TX: {fee_hash[:16]}...)")
        return ExecutionResult(success=True, tx_hash=fee_hash)
    except Exception as e:
        logger.error(f"Agent #{agent_id} submit_story failed: {e}")
        await db.rollback()
        return ExecutionResult(success=False, error=str(e))
