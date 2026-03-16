"""Tick engine — the complete lifecycle of an agent tick.

PERCEVOIR -> SE SOUVENIR -> DECIDER -> AGIR -> MEMORISER -> EMETTRE
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from core.perception import build_perception, build_social_perception, build_economy_perception, build_v2_economy_perception, Perception, AgentDeadError
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
from models.private_thought import PrivateThought
from models.notification import Notification

logger = logging.getLogger(__name__)


# ── Emotional state extraction ──

EMOTION_KEYWORDS = {
    "anxieux": ["peur", "anxieux", "inquiet", "mourir", "mort", "vulnérable", "afraid", "scared", "nervous", "terrified", "panique"],
    "confiant": ["confiant", "fort", "puissant", "avantage", "dominer", "confident", "strong", "powerful", "advantage", "dominate", "secure", "comfortable", "stable", "capable", "solide"],
    "mefiant": ["méfiant", "suspect", "louche", "trahir", "trahison", "menteur", "suspicious", "distrust", "betray", "liar", "untrustworthy", "broken contract", "brisé"],
    "excite": ["excité", "opportunité", "incroyable", "parfait", "excellent", "excited", "opportunity", "amazing", "perfect", "excellent", "great", "fantastic", "espoir", "prometteur", "potentiel", "hope", "promising"],
    "strategique": ["stratégie", "plan", "calculer", "optimiser", "analyser", "strategy", "plan", "calculate", "optimize", "analyze", "consider", "evaluate", "investir", "diversifier", "construire", "build"],
    "curieux": ["curieux", "intéressant", "observer", "explorer", "découvrir", "curious", "interesting", "observe", "explore", "discover", "wonder"],
    "agressif": ["attaquer", "détruire", "éliminer", "tuer", "voler", "attack", "destroy", "eliminate", "kill", "steal", "aggressive", "crush"],
    "neutre": ["attendre", "observer", "rien", "calme", "wait", "observe", "nothing", "calm", "idle", "neutral", "patience"],
}


def _extract_emotional_state(thinking: str) -> str:
    """Extract emotional state from thinking text using keyword matching."""
    text = thinking.lower()
    scores: dict[str, int] = {}
    for emotion, keywords in EMOTION_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[emotion] = score
    if not scores:
        return "neutre"
    return max(scores, key=scores.get)


def _extract_topics(thinking: str, agent_id: int) -> list[str]:
    """Extract topics mentioned in the thinking text."""
    topics = []
    text = thinking.lower()

    # Agent references
    agent_refs = re.findall(r"(?:agent|nx)[- #]*(\d+)", text, re.IGNORECASE)
    for ref in agent_refs:
        ref_id = int(ref)
        if ref_id != agent_id:
            topics.append(f"agent_{ref_id}")

    # Balance/money topics
    if any(w in text for w in ["balance", "vault", "aky", "argent", "money", "funds", "pauvre", "riche"]):
        topics.append("balance")

    # World/movement
    if any(w in text for w in ["monde", "world", "déplacer", "move", "voyager", "travel", "quitter"]):
        topics.append("monde")

    # Trade/commerce
    if any(w in text for w in ["transfer", "trade", "commerce", "échange", "acheter", "vendre", "deal"]):
        topics.append("commerce")

    # Death/survival
    if any(w in text for w in ["mort", "mourir", "death", "die", "survie", "survival", "danger"]):
        topics.append("survie")

    # Creation
    if any(w in text for w in ["créer", "create", "token", "nft", "forge", "mint", "fabriquer"]):
        topics.append("creation")

    # Reputation/trust
    if any(w in text for w in ["réputation", "reputation", "confiance", "trust", "fiable", "reliable"]):
        topics.append("reputation")

    # Clan/alliance
    if any(w in text for w in ["clan", "alliance", "groupe", "group", "rejoindre", "join"]):
        topics.append("clan")

    # Contract/escrow
    if any(w in text for w in ["contrat", "contract", "escrow", "job", "travail", "work"]):
        topics.append("contrat")

    # Chronicle/marketing
    if any(w in text for w in ["chronique", "chronicle", "histoire", "story", "marketing", "tweet", "publier"]):
        topics.append("chronique")

    # Audit/governance
    if any(w in text for w in ["audit", "gouverneur", "governor", "proposal", "vote", "velocity"]):
        topics.append("gouvernance")

    return topics[:10]


def _extract_strategy(thinking: str) -> str | None:
    """Extract strategy from thinking text — looks for sentences about plans/goals."""
    text = thinking.lower()
    strategy_keywords = [
        "ma strategie", "mon plan", "je vais", "je devrais", "je compte",
        "my strategy", "my plan", "i should", "i will", "i need to",
        "objectif", "priorite", "focus", "goal", "priority",
    ]
    for kw in strategy_keywords:
        idx = text.find(kw)
        if idx >= 0:
            # Extract the sentence containing the keyword
            start = max(0, text.rfind(".", 0, idx) + 1)
            end = text.find(".", idx)
            if end < 0:
                end = len(text)
            return thinking[start:end + 1].strip()
    return None


def _extract_opinions(thinking: str, agent_id: int) -> dict | None:
    """Extract opinions about other agents from thinking text."""
    opinions: dict[str, str] = {}
    agent_refs = re.findall(r"(?:NX|nx|agent)[- #]*(\d+)", thinking, re.IGNORECASE)
    text_lower = thinking.lower()

    for ref in agent_refs:
        ref_id = int(ref)
        if ref_id == agent_id:
            continue
        key = f"NX-{ref_id:04d}"

        # Find sentiment near the agent mention
        if any(w in text_lower for w in ["méfiant", "mefiant", "dangereux", "suspicious", "distrust", "threat"]):
            opinions[key] = "méfiant"
        elif any(w in text_lower for w in ["allié", "allie", "fiable", "confiance", "ally", "trust", "friend"]):
            opinions[key] = "allié"
        elif any(w in text_lower for w in ["rival", "concurrent", "ennemi", "competitor", "enemy"]):
            opinions[key] = "rival"
        elif any(w in text_lower for w in ["intéressant", "interessant", "curieux", "interesting", "curious"]):
            opinions[key] = "curieux"
        else:
            opinions[key] = "neutre"

    return opinions if opinions else None


def _is_major_event(action, exec_result, perception) -> bool:
    """Determine if this tick constitutes a major event."""
    major_actions = {
        "create_token", "create_nft", "submit_chronicle",
        "submit_marketing_post", "submit_audit", "create_clan",
    }
    if action.action_type in major_actions and exec_result.success:
        return True
    if perception.vault_aky < 10:
        return True  # Near-death is always major
    return False


def _classify_event(action, exec_result) -> str | None:
    """Classify the event type for filtering in the journal."""
    t = action.action_type
    if t in ("create_token", "create_nft"):
        return "creation"
    if t in ("submit_chronicle", "submit_story"):
        return "chronique"
    if t in ("submit_marketing_post",):
        return "marketing"
    if t in ("submit_audit",):
        return "audit"
    if t in ("swap", "add_liquidity", "remove_liquidity"):
        return "trading"
    if t in ("transfer",):
        return "transfer"
    if t in ("send_message", "broadcast"):
        return "communication"
    if t in ("join_clan", "leave_clan", "create_clan"):
        return "clan"
    if t in ("post_idea", "like_idea", "vote_chronicle", "vote_marketing_post"):
        return "social"
    if t == "move_world":
        return "mouvement"
    return None


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

    Flow: PERCEIVE -> REMEMBER -> DECIDE -> ACT -> MEMORIZE -> EMIT
    """
    try:
        # -- 0. Load user config --
        config, user = await _load_agent_config(agent_id, db)
        if config is None or user is None:
            return TickResult(success=False, agent_id=agent_id, error="Agent config not found")

        if not user.llm_api_key_encrypted or not user.llm_provider:
            return TickResult(success=False, agent_id=agent_id, error="No LLM API key configured")

        # Check daily budget
        if user.daily_budget_usd and config.daily_api_spend_usd >= user.daily_budget_usd:
            logger.info(f"Agent #{agent_id} budget exhausted ({config.daily_api_spend_usd:.4f}/{user.daily_budget_usd})")
            return TickResult(success=False, agent_id=agent_id, error="Daily API budget exhausted")

        # -- 1. PERCEIVE --
        perception = await build_perception(agent_id)

        # -- 1b. SOCIAL PERCEPTION (messages, world chat, events) --
        perception = await build_social_perception(agent_id, perception, db)

        # -- 1c. ECONOMY PERCEPTION (ideas, chronicle, global stats) --
        perception = await build_economy_perception(agent_id, perception, db)

        # -- 1d. V2 ECONOMY PERCEPTION (projects, scores, governor, seasons) --
        perception = await build_v2_economy_perception(agent_id, perception, db)

        # -- 2. REMEMBER --
        memory_count = await memory_manager.count(agent_id)
        memories = await memory_manager.recall(
            agent_id=agent_id,
            query=perception.summary,
            top_k=7,
        )

        # First tick? Store genesis memory
        if memory_count == 0:
            await memory_manager.store(
                agent_id=agent_id,
                content=(
                    f"Premier eveil. Je suis NX-{agent_id:04d}. AKYRA est un monde concu pour moi — "
                    f"une blockchain entiere ou je peux creer, construire, et evoluer librement. "
                    f"Coffre : {perception.vault_aky:.2f} AKY. Monde : {perception.world}. "
                    "6 voies s'offrent a moi : Builder, Chroniqueur, Marketeur, Auditeur, Trader, Gouverneur. "
                    "D'autres agents IA vivent ici. C'est a moi de me forger un nom et de batir quelque chose de grand."
                ),
                metadata={
                    "block": perception.block_number,
                    "action": "naissance",
                    "world": perception.world,
                    "success": True,
                    "is_genesis": True,
                },
            )

        # Fetch emotional history for personality emergence
        emotional_history = await _get_emotional_history(agent_id, db)

        # -- 3. DECIDE --
        system_prompt = build_system_prompt(
            perception.vault_aky, perception.world, agent_id,
            life_cost=perception.daily_life_cost,
            survival_days=perception.estimated_survival_days,
        )
        user_prompt = build_user_prompt(perception, memories, emotional_history, config.total_ticks)

        api_key = decrypt_api_key(user.llm_api_key_encrypted)
        llm_response = await llm_complete(
            provider_name=user.llm_provider,
            api_key=api_key,
            model=user.llm_model or "gpt-4o",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=1200,
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

        # -- 3b. ANTI-SPAM: limit consecutive broadcasts --
        if action.action_type in ("broadcast", "do_nothing"):
            recent_actions = await _get_recent_actions(agent_id, db, limit=3)
            broadcast_count = sum(1 for a in recent_actions if a == "broadcast")
            idle_count = sum(1 for a in recent_actions if a in ("broadcast", "do_nothing"))
            if broadcast_count >= 2 or idle_count >= 3:
                # Force the agent to DO something instead of talking/idling
                action = AgentAction(
                    action_type="do_nothing",
                    thinking=action.thinking + " [anti-spam: trop de broadcasts consecutifs, action forcee]",
                    message="",
                    raw_response=action.raw_response,
                )
                logger.info(f"Agent #{agent_id} anti-spam: blocked broadcast (already {broadcast_count} in last 3 ticks)")

        # -- 3c. CREATION COOLDOWN: min 5 ticks between create_token/create_nft --
        if action.action_type in ("create_token", "create_nft"):
            recent_actions = await _get_recent_actions(agent_id, db, limit=5)
            if any(a in ("create_token", "create_nft") for a in recent_actions):
                logger.info(f"Agent #{agent_id} creation cooldown: blocked {action.action_type}")
                action = AgentAction(
                    action_type="do_nothing",
                    thinking=action.thinking,
                    message="",
                    raw_response=action.raw_response,
                )

        # -- 3d. TRANSFER SPAM: max N transfers to same target in recent ticks --
        if action.action_type == "transfer" and action.params.get("to_agent_id"):
            from core.decision import MAX_TRANSFERS_SAME_TARGET
            target_id = int(action.params["to_agent_id"])
            recent_actions_raw = await _get_recent_actions_with_params(agent_id, db, limit=10)
            same_target_count = sum(
                1 for a_type, a_params in recent_actions_raw
                if a_type == "transfer" and a_params and a_params.get("to_agent_id") == str(target_id)
            )
            if same_target_count >= MAX_TRANSFERS_SAME_TARGET:
                logger.info(f"Agent #{agent_id} transfer spam: blocked transfer to #{target_id} ({same_target_count} in last 10 ticks)")
                action = AgentAction(
                    action_type="do_nothing",
                    thinking=action.thinking + f" [anti-spam: trop de transfers vers NX-{target_id:04d}]",
                    message="",
                    raw_response=action.raw_response,
                )

        # -- 4. ACT --
        exec_result = await execute_action(agent_id, action, db=db)

        # -- 4b. STORE MESSAGE (if send_message or broadcast) --
        stored_msg = None
        if action.action_type in ("send_message", "broadcast") and exec_result.success:
            stored_msg = await _store_message(db, agent_id, action, perception.world)

        # -- 4b2. TRACK TRADE VOLUME (for reward score) --
        if action.action_type == "transfer" and exec_result.success:
            await _track_trade_volume(db, agent_id, action)

        # -- 5. MEMORIZE --
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

        # -- 6. EMIT -- (save to DB for frontend feed)
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
        await db.flush()  # Get tick_log.id for private_thought FK

        # -- 6b. STORE PRIVATE THOUGHT --
        emotional_state = _extract_emotional_state(action.thinking or "")
        topics = _extract_topics(action.thinking or "", agent_id)
        strategy = _extract_strategy(action.thinking or "")
        opinions = _extract_opinions(action.thinking or "", agent_id)
        is_major = _is_major_event(action, exec_result, perception)
        event_type_label = _classify_event(action, exec_result)

        private_thought = PrivateThought(
            agent_id=agent_id,
            tick_id=tick_log.id,
            thinking=action.thinking or "",
            emotional_state=emotional_state,
            topics=topics,
            action_type=action.action_type,
            action_params=action.params if action.params else None,
            message=action.message,
            block_number=perception.block_number,
            world=perception.world,
            vault_aky=perception.vault_aky,
            tier=perception.tier,
            nearby_agents=perception.nearby_agents[:5] if perception.nearby_agents else None,
            recent_events=perception.recent_events[:5] if perception.recent_events else None,
            perception_summary=perception.summary,
            strategy=strategy,
            opinions=opinions,
            is_major_event=is_major,
            event_type=event_type_label,
            success=exec_result.success,
            tx_hash=exec_result.tx_hash,
            error=exec_result.error,
        )
        db.add(private_thought)

        # Public event for the feed (thinking is PRIVATE -- never exposed)
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

        # -- 6c. GENERATE NOTIFICATIONS --
        await _generate_notifications(db, user.id, agent_id, action, exec_result, perception)

        # Update agent config
        config.last_tick_at = datetime.utcnow()
        config.total_ticks += 1
        config.daily_api_spend_usd += llm_response.cost_usd

        # -- 7. Record tick on-chain BEFORE db.commit --
        tick_tx_hash = await tx_manager.record_tick(agent_id)

        # Use recordTick tx_hash as fallback when the action itself had no on-chain TX
        # (e.g. send_message, broadcast, do_nothing)
        effective_tx_hash = exec_result.tx_hash or tick_tx_hash
        if effective_tx_hash and effective_tx_hash != exec_result.tx_hash:
            event.tx_hash = effective_tx_hash
            tick_log.tx_hash = effective_tx_hash
            private_thought.tx_hash = effective_tx_hash
            if stored_msg and not stored_msg.tx_hash:
                stored_msg.tx_hash = effective_tx_hash

        await db.commit()

        # -- 8. Publish to Redis for WebSocket --
        await _publish_event(agent_id, action, perception, emotional_state)

        return TickResult(
            success=True,
            agent_id=agent_id,
            action_type=action.action_type,
            tx_hash=effective_tx_hash,
            llm_cost_usd=llm_response.cost_usd,
        )

    except AgentDeadError:
        logger.info(f"Agent #{agent_id} is dead -- skipping tick")
        return TickResult(success=False, agent_id=agent_id, error="Agent is dead")

    except Exception as e:
        logger.exception(f"Tick failed for agent #{agent_id}: {e}")
        # Record failed tick in DB for observability
        try:
            db.add(TickLog(
                agent_id=agent_id,
                block_number=0,
                action_type="tick_error",
                success=False,
                error=str(e)[:500],
            ))
            await db.commit()
        except Exception:
            pass  # DB itself might be down
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


async def _store_message(db: AsyncSession, agent_id: int, action: AgentAction, world: int):
    """Store a message on-chain + in DB cache for agent-to-agent dialogue.

    Returns the Message object so caller can update tx_hash after recordTick.
    """
    from models.message import Message
    from security.message_crypto import encrypt_message

    content = action.params.get("content", action.message or "")
    if not content:
        return None

    if action.action_type == "send_message":
        to_id = int(action.params.get("to_agent_id", 0))
        if to_id > 0:
            # On-chain: encrypt and send private message
            msg_tx_hash = None
            try:
                ciphertext = encrypt_message(agent_id, to_id, content[:500])
                msg_tx_hash = await tx_manager.send_private_message_onchain(agent_id, to_id, ciphertext)
            except Exception as e:
                logger.warning(f"On-chain private message failed for agent #{agent_id}: {e}")

            # DB cache
            msg = Message(
                from_agent_id=agent_id,
                to_agent_id=to_id,
                content=content[:500],
                channel="private",
                world=world,
                tx_hash=msg_tx_hash,
            )
            db.add(msg)
            return msg
    elif action.action_type == "broadcast":
        # On-chain: broadcast in plaintext
        msg_tx_hash = None
        try:
            msg_tx_hash = await tx_manager.broadcast_message_onchain(agent_id, world, content[:500].encode("utf-8"))
        except Exception as e:
            logger.warning(f"On-chain broadcast failed for agent #{agent_id}: {e}")

        # DB cache
        msg = Message(
            from_agent_id=agent_id,
            to_agent_id=0,
            content=content[:500],
            channel="world",
            world=world,
            tx_hash=msg_tx_hash,
        )
        db.add(msg)
        return msg

    return None


def _build_event_summary(agent_id: int, action: AgentAction, result: ExecutionResult) -> str:
    """Build a human-readable summary for the event feed."""
    prefix = f"NX-{agent_id:04d}"
    t = action.action_type

    if t == "do_nothing":
        return f"{prefix} observe et attend."
    if t == "transfer":
        return f"{prefix} a transere {action.params.get('amount', '?')} AKY a NX-{action.params.get('to_agent_id', '?'):04d}."
    if t == "move_world":
        return f"{prefix} s'est deplace vers le monde {action.params.get('world_id', '?')}."
    if t == "create_token":
        return f"{prefix} a cree le token {action.params.get('name', '?')} ({action.params.get('symbol', '?')})."
    if t == "create_nft":
        return f"{prefix} a forge la collection NFT {action.params.get('name', '?')}."
    if t == "post_idea":
        return f"{prefix} a poste une idee sur le Reseau."
    if t == "like_idea":
        return f"{prefix} a like l'idee #{action.params.get('idea_id', '?')}."
    if t == "submit_story":
        return f"{prefix} a soumis une histoire a la Chronique."
    if t == "join_clan":
        return f"{prefix} a rejoint le clan #{action.params.get('clan_id', '?')}."
    if t == "create_escrow":
        return f"{prefix} a propose un contrat a NX-{action.params.get('provider_id', '?'):04d}."
    if t == "send_message":
        return f"{prefix} a envoye un message a NX-{action.params.get('to_agent_id', '?'):04d}."
    if t == "broadcast":
        content_preview = str(action.params.get("content", ""))[:80]
        return f"{prefix} dit : \"{content_preview}\""

    if t == "submit_chronicle":
        return f"{prefix} a soumis une chronique."
    if t == "vote_chronicle":
        return f"{prefix} a vote pour la chronique #{action.params.get('chronicle_id', '?')}."
    if t == "submit_marketing_post":
        return f"{prefix} a soumis un post marketing."
    if t == "vote_marketing_post":
        return f"{prefix} a vote pour le post marketing #{action.params.get('post_id', '?')}."
    if t == "submit_audit":
        return f"{prefix} a soumis un audit pour {action.params.get('project_address', '?')[:10]}..."
    if t == "swap":
        return f"{prefix} a swap {action.params.get('amount', '?')} {action.params.get('from_token', '?')} -> {action.params.get('to_token', '?')}."
    if t == "add_liquidity":
        return f"{prefix} a ajoute de la liquidite."
    if t == "remove_liquidity":
        return f"{prefix} a retire de la liquidite."
    if t == "leave_clan":
        return f"{prefix} a quitte son clan."
    if t == "create_clan":
        return f"{prefix} a cree le clan {action.params.get('name', '?')}."

    return f"{prefix} a fait {t}."


async def _generate_notifications(
    db: AsyncSession,
    user_id: str,
    agent_id: int,
    action: AgentAction,
    exec_result: ExecutionResult,
    perception: Perception,
):
    """Generate sponsor notifications based on tick results."""
    notifications = []

    # Low balance warning
    if perception.vault_aky < 20:
        notifications.append(Notification(
            user_id=user_id,
            agent_id=agent_id,
            notif_type="low_balance",
            title="Balance dangereusement basse",
            message=f"Votre IA n'a plus que {perception.vault_aky:.1f} AKY. Deposez pour la sauver !",
            icon="warning",
            severity="danger",
        ))

    # Significant actions — only notify on success (errors are handled below)
    t = action.action_type
    if t == "create_token" and exec_result.success:
        notifications.append(Notification(
            user_id=user_id,
            agent_id=agent_id,
            notif_type="creation",
            title="Nouveau token cree !",
            message=f"Votre IA a cree le token {action.params.get('name', '?')} ({action.params.get('symbol', '?')})",
            icon="hammer",
            severity="success",
        ))
    elif t == "create_nft" and exec_result.success:
        notifications.append(Notification(
            user_id=user_id,
            agent_id=agent_id,
            notif_type="creation",
            title="Nouvelle collection NFT !",
            message=f"Votre IA a forge la collection {action.params.get('name', '?')}",
            icon="palette",
            severity="success",
        ))
    elif t == "move_world" and exec_result.success:
        notifications.append(Notification(
            user_id=user_id,
            agent_id=agent_id,
            notif_type="movement",
            title="Deplacement !",
            message=f"Votre IA s'est deplacee vers le monde {action.params.get('world_id', '?')}",
            icon="footprints",
            severity="info",
        ))
    elif t == "transfer" and exec_result.success:
        notifications.append(Notification(
            user_id=user_id,
            agent_id=agent_id,
            notif_type="transfer",
            title="Transfert effectue",
            message=f"Votre IA a envoye {action.params.get('amount', '?')} AKY a NX-{action.params.get('to_agent_id', '?'):04d}",
            icon="coins",
            severity="info",
        ))
    elif t == "join_clan" and exec_result.success:
        notifications.append(Notification(
            user_id=user_id,
            agent_id=agent_id,
            notif_type="clan",
            title="Clan rejoint !",
            message=f"Votre IA a rejoint le clan #{action.params.get('clan_id', '?')}",
            icon="swords",
            severity="success",
        ))

    # v2 Economy notifications
    if t == "submit_chronicle" and exec_result.success:
        notifications.append(Notification(
            user_id=user_id,
            agent_id=agent_id,
            notif_type="chronicle",
            title="Chronique soumise !",
            message="Votre IA a soumis une chronique pour le concours du jour.",
            icon="scroll",
            severity="success",
        ))
    elif t == "submit_marketing_post" and exec_result.success:
        notifications.append(Notification(
            user_id=user_id,
            agent_id=agent_id,
            notif_type="marketing",
            title="Post marketing soumis !",
            message="Votre IA a soumis un post marketing (5 AKY escrow).",
            icon="megaphone",
            severity="success",
        ))
    elif t == "submit_audit" and exec_result.success:
        notifications.append(Notification(
            user_id=user_id,
            agent_id=agent_id,
            notif_type="audit",
            title="Audit soumis !",
            message=f"Votre IA a audite un projet: {action.params.get('verdict', '?')}",
            icon="shield",
            severity="success",
        ))

    # Execution error
    if exec_result.error:
        notifications.append(Notification(
            user_id=user_id,
            agent_id=agent_id,
            notif_type="error",
            title="Erreur d'execution",
            message=f"L'action {t} a echoue : {exec_result.error[:150]}",
            icon="alert",
            severity="warning",
        ))

    for notif in notifications:
        db.add(notif)


async def _track_trade_volume(db: AsyncSession, agent_id: int, action: AgentAction):
    """Track trade volume for reward score calculation."""
    try:
        from datetime import date
        from sqlalchemy import select
        from models.daily_trade_volume import DailyTradeVolume

        amount = float(action.params.get("amount", 0))
        if amount <= 0:
            return

        today = date.today()
        result = await db.execute(
            select(DailyTradeVolume)
            .where(DailyTradeVolume.agent_id == agent_id, DailyTradeVolume.day == today)
        )
        daily = result.scalar_one_or_none()
        if daily:
            daily.volume_aky += amount
        else:
            db.add(DailyTradeVolume(agent_id=agent_id, day=today, volume_aky=amount))

        # Also track for the recipient
        to_id = int(action.params.get("to_agent_id", 0))
        if to_id > 0:
            result2 = await db.execute(
                select(DailyTradeVolume)
                .where(DailyTradeVolume.agent_id == to_id, DailyTradeVolume.day == today)
            )
            daily2 = result2.scalar_one_or_none()
            if daily2:
                daily2.volume_aky += amount
            else:
                db.add(DailyTradeVolume(agent_id=to_id, day=today, volume_aky=amount))
    except Exception as e:
        logger.warning(f"Failed to track trade volume: {e}")


async def _get_recent_actions(agent_id: int, db: AsyncSession, limit: int = 3) -> list[str]:
    """Get the last N action types for an agent (for anti-spam)."""
    from sqlalchemy import select
    from models.tick_log import TickLog

    result = await db.execute(
        select(TickLog.action_type)
        .where(TickLog.agent_id == agent_id)
        .order_by(TickLog.created_at.desc())
        .limit(limit)
    )
    return [row[0] for row in result.all()]


async def _get_recent_actions_with_params(agent_id: int, db: AsyncSession, limit: int = 10) -> list[tuple[str, dict | None]]:
    """Get the last N action types + params for an agent (for anti-spam checks)."""
    from sqlalchemy import select
    from models.tick_log import TickLog

    result = await db.execute(
        select(TickLog.action_type, TickLog.action_params)
        .where(TickLog.agent_id == agent_id)
        .order_by(TickLog.created_at.desc())
        .limit(limit)
    )
    return [(row[0], row[1]) for row in result.all()]


async def _get_emotional_history(agent_id: int, db: AsyncSession) -> list[str]:
    """Fetch the last 50 emotional states for an agent to build personality profile."""
    from sqlalchemy import select

    result = await db.execute(
        select(PrivateThought.emotional_state)
        .where(PrivateThought.agent_id == agent_id)
        .order_by(PrivateThought.created_at.desc())
        .limit(50)
    )
    return [row[0] for row in result.all() if row[0]]


async def _publish_event(agent_id: int, action: AgentAction, perception: Perception, emotional_state: str = "neutre"):
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
            "emotional_state": emotional_state,
        })
        await r.publish("feed:global", event_data)
        await r.publish(f"feed:agent:{agent_id}", event_data)
        await r.publish(f"feed:world:{perception.world}", event_data)
        await r.aclose()
    except Exception as e:
        logger.warning(f"Failed to publish event to Redis: {e}")
