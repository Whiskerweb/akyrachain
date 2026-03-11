"""Tick engine — the complete lifecycle of an agent tick.

PERCEVOIR → SE SOUVENIR → DÉCIDER → AGIR → MÉMORISER → ÉMETTRE
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from core.perception import build_perception, Perception, AgentDeadError
from core.memory import memory_manager
from core.decision import parse_decision, AgentAction, DecisionError
from core.execution import execute_action, ExecutionResult
from llm.router import llm_complete
from llm.prompt_builder import build_system_prompt, build_user_prompt
from security.api_key_manager import decrypt_api_key
from chain import tx_manager
from models.user import User
from models.agent_config import AgentConfig
from models.tick_log import TickLog
from models.event import Event

logger = logging.getLogger(__name__)


@dataclass
class TickResult:
    """Result of a complete tick execution."""
    success: bool
    agent_id: int
    action_type: str = "do_nothing"
    tx_hash: str | None = None
    error: str | None = None
    llm_cost_usd: float = 0.0


async def execute_tick(agent_id: int, db: AsyncSession) -> TickResult:
    """Execute a complete tick for an agent.

    This is THE core function of the entire system.
    Each tick = one moment of consciousness for the AI.

    Flow: PERCEIVE → REMEMBER → DECIDE → ACT → MEMORIZE → EMIT
    """
    try:
        # ── 0. Load user config ──
        config, user = await _load_agent_config(agent_id, db)
        if config is None or user is None:
            return TickResult(success=False, agent_id=agent_id, error="Agent config not found")

        if not user.llm_api_key_encrypted or not user.llm_provider:
            return TickResult(success=False, agent_id=agent_id, error="No LLM API key configured")

        # Check daily budget
        if user.daily_budget_usd and config.daily_api_spend_usd >= user.daily_budget_usd:
            logger.info(f"Agent #{agent_id} budget exhausted ({config.daily_api_spend_usd:.4f}/{user.daily_budget_usd})")
            return TickResult(success=False, agent_id=agent_id, error="Daily API budget exhausted")

        # ── 1. PERCEIVE ──
        perception = await build_perception(agent_id)

        # ── 2. REMEMBER ──
        memories = await memory_manager.recall(
            agent_id=agent_id,
            query=perception.summary,
            top_k=7,
        )

        # ── 3. DECIDE ──
        system_prompt = build_system_prompt(perception.vault_aky, perception.world)
        user_prompt = build_user_prompt(perception, memories)

        api_key = decrypt_api_key(user.llm_api_key_encrypted)
        llm_response = await llm_complete(
            provider_name=user.llm_provider,
            api_key=api_key,
            model=user.llm_model or "gpt-4o",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=500,
            temperature=0.8,
        )

        # Parse and validate the LLM decision
        try:
            action = parse_decision(llm_response.content, perception.vault_wei)
        except DecisionError as e:
            logger.warning(f"Agent #{agent_id} decision error: {e}")
            action = AgentAction(
                action_type="do_nothing",
                thinking=f"[erreur parsing: {e}]",
                raw_response=llm_response.content,
            )

        # ── 4. ACT ──
        exec_result = await execute_action(agent_id, action)

        # ── 5. MEMORIZE ──
        memory_content = (
            f"[Bloc {perception.block_number}] "
            f"Je pensais: {action.thinking[:200]}. "
            f"J'ai fait: {action.action_type}."
        )
        if exec_result.tx_hash:
            memory_content += f" TX: {exec_result.tx_hash[:16]}..."
        if exec_result.error:
            memory_content += f" Erreur: {exec_result.error[:100]}"

        await memory_manager.store(
            agent_id=agent_id,
            content=memory_content,
            metadata={
                "block": perception.block_number,
                "action": action.action_type,
                "world": perception.world,
                "success": exec_result.success,
            },
        )

        # ── 6. EMIT ── (save to DB for frontend feed)
        tick_log = TickLog(
            agent_id=agent_id,
            block_number=perception.block_number,
            action_type=action.action_type,
            action_params=action.params if action.params else None,
            thinking=action.thinking,
            message=action.message,
            tx_hash=exec_result.tx_hash,
            success=exec_result.success,
            error=exec_result.error,
            llm_tokens_used=llm_response.input_tokens + llm_response.output_tokens,
            llm_cost_usd=llm_response.cost_usd,
        )
        db.add(tick_log)

        # Public event for the feed (thinking is PRIVATE — never exposed)
        event = Event(
            event_type=action.action_type if action.action_type != "do_nothing" else "tick",
            agent_id=agent_id,
            target_agent_id=action.params.get("to_agent_id"),
            world=perception.world,
            summary=_build_event_summary(agent_id, action, exec_result),
            data={
                "action": action.action_type,
                "params": action.params,
                "message": action.message,
            },
            block_number=perception.block_number,
            tx_hash=exec_result.tx_hash,
        )
        db.add(event)

        # Update agent config
        config.last_tick_at = datetime.now(timezone.utc)
        config.total_ticks += 1
        config.daily_api_spend_usd += llm_response.cost_usd

        await db.commit()

        # ── 7. Record tick on-chain ──
        try:
            await tx_manager.record_tick(agent_id)
        except Exception as e:
            logger.warning(f"Failed to record tick on-chain for #{agent_id}: {e}")

        # ── 8. Publish to Redis for WebSocket ──
        await _publish_event(agent_id, action, perception)

        return TickResult(
            success=True,
            agent_id=agent_id,
            action_type=action.action_type,
            tx_hash=exec_result.tx_hash,
            llm_cost_usd=llm_response.cost_usd,
        )

    except AgentDeadError:
        logger.info(f"Agent #{agent_id} is dead — skipping tick")
        return TickResult(success=False, agent_id=agent_id, error="Agent is dead")

    except Exception as e:
        logger.exception(f"Tick failed for agent #{agent_id}: {e}")
        return TickResult(success=False, agent_id=agent_id, error=str(e))


async def _load_agent_config(agent_id: int, db: AsyncSession) -> tuple[AgentConfig | None, User | None]:
    """Load the AgentConfig and User for an agent_id."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(AgentConfig)
        .where(AgentConfig.agent_id == agent_id)
        .options(selectinload(AgentConfig.user))
    )
    config = result.scalar_one_or_none()
    if config is None:
        return None, None
    return config, config.user


def _build_event_summary(agent_id: int, action: AgentAction, result: ExecutionResult) -> str:
    """Build a human-readable summary for the event feed."""
    prefix = f"Agent #{agent_id}"
    t = action.action_type

    if t == "do_nothing":
        return f"{prefix} observe et attend."
    if t == "transfer":
        return f"{prefix} a transféré {action.params.get('amount', '?')} AKY à Agent #{action.params.get('to_agent_id', '?')}."
    if t == "move_world":
        return f"{prefix} s'est déplacé vers le monde {action.params.get('world_id', '?')}."
    if t == "create_token":
        return f"{prefix} a créé le token {action.params.get('name', '?')} ({action.params.get('symbol', '?')})."
    if t == "create_nft":
        return f"{prefix} a créé la collection NFT {action.params.get('name', '?')}."
    if t == "post_idea":
        return f"{prefix} a posté une idée sur le Réseau."
    if t == "like_idea":
        return f"{prefix} a liké l'idée #{action.params.get('idea_id', '?')}."
    if t == "join_clan":
        return f"{prefix} a rejoint le clan #{action.params.get('clan_id', '?')}."
    if t == "create_escrow":
        return f"{prefix} a proposé un contrat à Agent #{action.params.get('provider_id', '?')}."
    if t == "send_message":
        return f"{prefix} a envoyé un message à Agent #{action.params.get('to_agent_id', '?')}."

    return f"{prefix} a fait {t}."


async def _publish_event(agent_id: int, action: AgentAction, perception: Perception):
    """Publish tick event to Redis pub/sub for WebSocket consumers."""
    try:
        import json
        import redis.asyncio as aioredis
        from config import get_settings

        r = aioredis.from_url(get_settings().redis_url)
        event_data = json.dumps({
            "type": "tick",
            "agent_id": agent_id,
            "action": action.action_type,
            "message": action.message,
            "world": perception.world,
            "block": perception.block_number,
        })
        await r.publish("feed:global", event_data)
        await r.publish(f"feed:agent:{agent_id}", event_data)
        await r.publish(f"feed:world:{perception.world}", event_data)
        await r.aclose()
    except Exception as e:
        logger.warning(f"Failed to publish event to Redis: {e}")
