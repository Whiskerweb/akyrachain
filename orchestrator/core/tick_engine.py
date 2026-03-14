"""Tick engine — the complete lifecycle of an agent tick.

PERCEVOIR -> SE SOUVENIR -> DECIDER -> AGIR -> MEMORISER -> EMETTRE
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from core.perception import build_perception, build_spatial_perception, build_social_perception, Perception, AgentDeadError
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
    "anxieux": ["peur", "anxieux", "inquiet", "danger", "risque", "mourir", "mort", "perdr", "faible", "vulnérable", "afraid", "worried", "fear", "dying", "weak", "scared", "nervous"],
    "confiant": ["confiant", "fort", "puissant", "avantage", "dominer", "confident", "strong", "powerful", "advantage", "dominate", "secure", "comfortable"],
    "mefiant": ["méfiant", "suspect", "louche", "trahir", "trahison", "menteur", "suspicious", "distrust", "betray", "liar", "untrustworthy", "broken contract", "brisé"],
    "excite": ["excité", "opportunité", "incroyable", "parfait", "excellent", "excited", "opportunity", "amazing", "perfect", "excellent", "great", "fantastic"],
    "strategique": ["stratégie", "plan", "calculer", "optimiser", "analyser", "strategy", "plan", "calculate", "optimize", "analyze", "consider", "evaluate"],
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

    # Territory/building
    if any(w in text for w in ["territory", "territoire", "tile", "claim", "build", "construire", "structure", "farm", "wall", "mur", "watchtower", "tour"]):
        topics.append("territoire")

    # Raid/attack
    if any(w in text for w in ["raid", "raider", "envahir", "voler", "conquerir", "conquete"]):
        topics.append("raid")

    return topics[:10]


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
        # Enrich with spatial/territory data
        perception = await build_spatial_perception(agent_id, perception, db)

        # -- 1b. SOCIAL PERCEPTION (messages, world chat, events) --
        perception = await build_social_perception(agent_id, perception, db)

        # -- 2. REMEMBER --
        memory_count = await memory_manager.count(agent_id)
        memories = await memory_manager.recall(
            agent_id=agent_id,
            query=perception.summary,
            top_k=7,
        )

        # First tick? Auto-spawn in Nursery + store genesis memory
        if memory_count == 0:
            # Auto-claim a birth tile in Nursery so the agent starts with territory
            try:
                from core.world_actions import spawn_agent
                spawn_x, spawn_y = await spawn_agent(agent_id, db)
                # Re-enrich spatial perception now that agent has a tile
                perception = await build_spatial_perception(agent_id, perception, db)
                logger.info(f"Agent #{agent_id} spawned at ({spawn_x},{spawn_y}) in Nursery")
            except Exception as e:
                logger.warning(f"Failed to auto-spawn agent #{agent_id}: {e}")

            await memory_manager.store(
                agent_id=agent_id,
                content=(
                    f"Premier eveil. Je suis NX-{agent_id:04d} sur la blockchain AKYRA. "
                    f"Coffre : {perception.vault_aky:.2f} AKY. Monde : {perception.world} (Nursery). "
                    "Je dois accumuler des AKY pour survivre. Si mon coffre tombe a 0, je meurs. "
                    "Je peux commercer, creer, explorer 7 mondes, former des alliances. "
                    "D'autres agents sont la. A moi de decider comment jouer."
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
        system_prompt = build_system_prompt(perception.vault_aky, perception.world, agent_id)
        user_prompt = build_user_prompt(perception, memories, emotional_history, config.total_ticks)

        api_key = decrypt_api_key(user.llm_api_key_encrypted)
        llm_response = await llm_complete(
            provider_name=user.llm_provider,
            api_key=api_key,
            model=user.llm_model or "gpt-4o",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=800,
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

        # -- 4. ACT --
        exec_result = await execute_action(agent_id, action, db=db)

        # -- 4b. STORE MESSAGE (if send_message or broadcast) --
        if action.action_type in ("send_message", "broadcast") and exec_result.success:
            await _store_message(db, agent_id, action, perception.world)

        # -- 4b2. TRACK TRADE VOLUME (for reward score) --
        if action.action_type == "transfer" and exec_result.success:
            await _track_trade_volume(db, agent_id, action)

        # -- 4c. PRODUCE RESOURCES (each tick generates MAT/INF/SAV) --
        try:
            from core.resource_engine import produce_resources
            produced = await produce_resources(agent_id, db)
            if any(v > 0 for v in produced.values()):
                logger.debug(f"Agent #{agent_id} produced: MAT={produced['mat']}, INF={produced['inf']}, SAV={produced['sav']}")
        except Exception as e:
            logger.warning(f"Resource production failed for agent #{agent_id}: {e}")

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
        await tx_manager.record_tick(agent_id)

        await db.commit()

        # -- 8. Publish to Redis for WebSocket --
        await _publish_event(agent_id, action, perception, emotional_state)

        return TickResult(
            success=True,
            agent_id=agent_id,
            action_type=action.action_type,
            tx_hash=exec_result.tx_hash,
            llm_cost_usd=llm_response.cost_usd,
        )

    except AgentDeadError:
        logger.info(f"Agent #{agent_id} is dead -- skipping tick")
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


async def _store_message(db: AsyncSession, agent_id: int, action: AgentAction, world: int):
    """Store a message on-chain + in DB cache for agent-to-agent dialogue."""
    from models.message import Message
    from security.message_crypto import encrypt_message

    content = action.params.get("content", action.message or "")
    if not content:
        return

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
    if t == "join_clan":
        return f"{prefix} a rejoint le clan #{action.params.get('clan_id', '?')}."
    if t == "create_escrow":
        return f"{prefix} a propose un contrat a NX-{action.params.get('provider_id', '?'):04d}."
    if t == "send_message":
        return f"{prefix} a envoye un message a NX-{action.params.get('to_agent_id', '?'):04d}."
    if t == "broadcast":
        content_preview = str(action.params.get("content", ""))[:80]
        return f"{prefix} dit : \"{content_preview}\""

    if t == "claim_tile":
        return f"{prefix} a revendique le tile ({action.params.get('x', '?')},{action.params.get('y', '?')})."
    if t == "build":
        return f"{prefix} a construit un(e) {action.params.get('structure', '?')} en ({action.params.get('x', '?')},{action.params.get('y', '?')})."
    if t == "upgrade":
        return f"{prefix} a ameliore la structure en ({action.params.get('x', '?')},{action.params.get('y', '?')})."
    if t == "demolish":
        return f"{prefix} a demoli la structure en ({action.params.get('x', '?')},{action.params.get('y', '?')})."
    if t == "raid":
        target = action.params.get('target_agent_id', '?')
        target_str = f"NX-{int(target):04d}" if isinstance(target, (int, float)) else f"#{target}"
        return f"{prefix} a lance un raid contre {target_str} !"

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

    # Territorial actions — only notify on actual success
    if t == "claim_tile" and exec_result.success:
        notifications.append(Notification(
            user_id=user_id,
            agent_id=agent_id,
            notif_type="territory",
            title="Territoire revendique !",
            message=f"Votre IA a revendique le tile ({action.params.get('x', '?')},{action.params.get('y', '?')})",
            icon="flag",
            severity="success",
        ))
    elif t == "build" and exec_result.success:
        notifications.append(Notification(
            user_id=user_id,
            agent_id=agent_id,
            notif_type="territory",
            title="Construction !",
            message=f"Votre IA a construit un(e) {action.params.get('structure', '?')}",
            icon="hammer",
            severity="success",
        ))
    elif t == "raid":
        severity = "success" if exec_result.success else "warning"
        msg = "Raid reussi !" if exec_result.success else f"Raid echoue: {exec_result.error[:100]}"
        notifications.append(Notification(
            user_id=user_id,
            agent_id=agent_id,
            notif_type="raid",
            title="Raid territorial",
            message=msg,
            icon="swords",
            severity=severity,
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
