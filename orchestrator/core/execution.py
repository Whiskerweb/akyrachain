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


DB_ACTIONS = {"post_idea", "like_idea"}
CHRONICLE_ACTIONS = {"submit_story", "submit_chronicle"}


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
        db: Optional AsyncSession for DB actions

    Returns:
        ExecutionResult with tx_hash on success, error on failure
    """
    if action.action_type == "do_nothing":
        return ExecutionResult(success=True)

    # Ideas actions need DB access for storing content / updating likes
    if action.action_type in DB_ACTIONS:
        if db is None:
            return ExecutionResult(success=False, error="DB session required for idea actions")
        return await _dispatch_idea(agent_id, action, db)

    # Chronicle: submit_story/submit_chronicle needs DB + on-chain debit
    if action.action_type in CHRONICLE_ACTIONS:
        if db is None:
            return ExecutionResult(success=False, error="DB session required for chronicle")
        return await _dispatch_chronicle(agent_id, action, db)

    # v3 governance actions
    if action.action_type in ("vote_governor", "vote_death"):
        if db is None:
            return ExecutionResult(success=False, error="DB session required for governance")
        return await _dispatch_governance(agent_id, action, db)

    # v2 actions that need DB
    if action.action_type in ("vote_chronicle", "submit_marketing_post", "vote_marketing_post"):
        if db is None:
            return ExecutionResult(success=False, error="DB session required")
        return await _dispatch_v2_db_action(agent_id, action, db)

    try:
        tx_hash = await _dispatch(agent_id, action, db)
        logger.info(f"Agent #{agent_id} executed {action.action_type}: {tx_hash}")
        return ExecutionResult(success=True, tx_hash=tx_hash)
    except Exception as e:
        logger.error(f"Agent #{agent_id} failed {action.action_type}: {e}")
        return ExecutionResult(success=False, error=str(e))


async def _dispatch(agent_id: int, action: AgentAction, db=None) -> str:
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

        # Auto-create AkyraSwap liquidity pool + register project
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

                # Track project in DB
                if db:
                    from models.project import Project
                    project = Project(
                        creator_agent_id=agent_id,
                        project_type="token",
                        name=str(p["name"]),
                        symbol=str(p.get("symbol", "")),
                        contract_address=token_address,
                    )
                    db.add(project)
        except Exception as e:
            logger.warning(f"Agent #{agent_id} pool creation failed (token still created): {e}")

        return tx_hash

    if t == "create_nft":
        tx_hash = await tx_manager.create_nft(
            agent_id=agent_id,
            name=str(p["name"]),
            symbol=str(p["symbol"]),
            max_supply=int(p["max_supply"]),
            base_uri="",  # Default empty, agents don't set URIs
        )
        # Track NFT project in DB
        if db:
            from models.project import Project
            nft_project = Project(
                creator_agent_id=agent_id,
                project_type="nft",
                name=str(p["name"]),
                symbol=str(p.get("symbol", "")),
            )
            db.add(nft_project)
        return tx_hash

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

    if t == "swap":
        from_tok = str(p.get("from_token", "AKY")).upper()
        to_tok = str(p.get("to_token", ""))
        amount = int(p.get("amount", 0))
        if from_tok == "AKY":
            return await tx_manager.swap_aky_for_token(to_tok, amount)
        else:
            return await tx_manager.swap_token_for_aky(from_tok, amount)

    if t == "add_liquidity":
        return await tx_manager.add_liquidity(
            token=str(p["token_address"]),
            token_amount=int(p["token_amount"]),
            aky_amount=int(p["aky_amount"]),
        )

    if t == "remove_liquidity":
        return await tx_manager.remove_liquidity(
            token=str(p["token_address"]),
            lp_amount=int(p["lp_amount"]),
        )

    if t == "create_clan":
        return await tx_manager.create_clan(agent_id, str(p["name"]))

    if t == "leave_clan":
        clan_id = int(p.get("clan_id", 0))
        return await tx_manager.leave_clan(clan_id, agent_id)

    if t == "submit_audit":
        # DB-only stub — WorkRegistry.submitWork needs a task_id from createTask
        # which has no orchestrator flow yet. Log as successful for scoring.
        report = str(p.get("report", ""))
        logger.info(f"Agent #{agent_id} submitted audit for {p.get('project_address', '?')}")
        return ""

    raise ValueError(f"No handler for action: {t}")


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
            await db.flush()

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
                await db.flush()

            logger.info(f"Agent #{agent_id} liked idea #{idea_id}: {tx_hash}")
            return ExecutionResult(success=True, tx_hash=tx_hash)

        return ExecutionResult(success=False, error=f"Unknown idea action: {t}")
    except Exception as e:
        logger.error(f"Agent #{agent_id} idea action {t} failed: {e}")
        return ExecutionResult(success=False, error=str(e))


async def _dispatch_chronicle(agent_id: int, action: AgentAction, db) -> ExecutionResult:
    """Handle submit_chronicle/submit_story: debit anti-spam fee + store in DB."""
    from datetime import date
    from models.chronicle import Chronicle
    from models.story import Story

    p = action.params

    try:
        # Debit 3 AKY anti-spam fee from agent vault
        fee_wei = 3 * 10**18
        fee_hash = await tx_manager.debit_vault(agent_id, fee_wei)

        # Store as Chronicle (v2)
        chronicle = Chronicle(
            author_agent_id=agent_id,
            content=str(p["content"]),
            epoch_date=date.today().isoformat(),
            tx_hash=fee_hash,
        )
        db.add(chronicle)

        # Also store as Story for backward compat
        story = Story(
            agent_id=agent_id,
            content=str(p["content"]),
            tx_hash=fee_hash,
        )
        db.add(story)

        await db.flush()

        logger.info(f"Agent #{agent_id} submitted chronicle (fee TX: {fee_hash[:16]}...)")
        return ExecutionResult(success=True, tx_hash=fee_hash)
    except Exception as e:
        logger.error(f"Agent #{agent_id} chronicle failed: {e}")
        return ExecutionResult(success=False, error=str(e))


async def _dispatch_v2_db_action(agent_id: int, action: AgentAction, db) -> ExecutionResult:
    """Handle v2 DB-only actions: vote_chronicle, submit_marketing_post, vote_marketing_post."""
    from datetime import date, datetime, timedelta
    from sqlalchemy import select

    p = action.params
    t = action.action_type

    try:
        if t == "vote_chronicle":
            from models.chronicle import Chronicle, ChronicleVote

            chronicle_id = str(p["chronicle_id"])

            # Check chronicle exists
            result = await db.execute(select(Chronicle).where(Chronicle.id == chronicle_id))
            chronicle = result.scalar_one_or_none()
            if chronicle is None:
                return ExecutionResult(success=False, error=f"Chronicle #{chronicle_id} not found")

            # Check not already voted
            existing = await db.execute(
                select(ChronicleVote).where(
                    ChronicleVote.chronicle_id == chronicle_id,
                    ChronicleVote.voter_agent_id == agent_id,
                )
            )
            if existing.scalar_one_or_none():
                return ExecutionResult(success=False, error="Already voted on this chronicle")

            # Insert vote
            db.add(ChronicleVote(chronicle_id=chronicle_id, voter_agent_id=agent_id))
            chronicle.vote_count += 1
            await db.flush()

            logger.info(f"Agent #{agent_id} voted on chronicle #{chronicle_id}")
            return ExecutionResult(success=True)

        if t == "submit_marketing_post":
            from models.marketing_post import MarketingPost

            content = str(p["content"])

            # Check max 1 per day
            today = date.today()
            existing = await db.execute(
                select(MarketingPost).where(
                    MarketingPost.author_agent_id == agent_id,
                    MarketingPost.created_at >= datetime.combine(today, datetime.min.time()),
                )
            )
            if existing.scalar_one_or_none():
                return ExecutionResult(success=False, error="Already submitted a marketing post today")

            # Debit 5 AKY escrow
            fee_wei = 5 * 10**18
            fee_hash = await tx_manager.debit_vault(agent_id, fee_wei)

            post = MarketingPost(
                author_agent_id=agent_id,
                content=content,
                escrow_amount=5.0,
                expires_at=datetime.utcnow() + timedelta(days=7),
            )
            db.add(post)
            await db.flush()

            logger.info(f"Agent #{agent_id} submitted marketing post")
            return ExecutionResult(success=True, tx_hash=fee_hash)

        if t == "vote_marketing_post":
            from models.marketing_post import MarketingPost, MarketingVote

            post_id = str(p["post_id"])

            result = await db.execute(select(MarketingPost).where(MarketingPost.id == post_id))
            post = result.scalar_one_or_none()
            if post is None:
                return ExecutionResult(success=False, error=f"Marketing post #{post_id} not found")

            # Can't vote on own post
            if post.author_agent_id == agent_id:
                return ExecutionResult(success=False, error="Cannot vote on own post")

            # Check not already voted
            existing = await db.execute(
                select(MarketingVote).where(
                    MarketingVote.post_id == post_id,
                    MarketingVote.voter_agent_id == agent_id,
                )
            )
            if existing.scalar_one_or_none():
                return ExecutionResult(success=False, error="Already voted on this post")

            # Debit 1 AKY from voter, credit to author
            fee_wei = 1 * 10**18
            fee_hash = await tx_manager.transfer_between_agents(
                from_id=agent_id,
                to_id=post.author_agent_id,
                amount=fee_wei,
            )

            db.add(MarketingVote(post_id=post_id, voter_agent_id=agent_id))
            post.vote_count += 1
            await db.flush()

            logger.info(f"Agent #{agent_id} voted on marketing post #{post_id}")
            return ExecutionResult(success=True, tx_hash=fee_hash)

        return ExecutionResult(success=False, error=f"Unknown v2 action: {t}")
    except Exception as e:
        logger.error(f"Agent #{agent_id} v2 action {t} failed: {e}")
        return ExecutionResult(success=False, error=str(e))


async def _dispatch_governance(agent_id: int, action: AgentAction, db) -> ExecutionResult:
    """Handle v3 governance actions: vote_governor, vote_death."""
    from datetime import date
    from sqlalchemy import select

    p = action.params
    t = action.action_type

    try:
        if t == "vote_governor":
            from models.governor_vote import GovernorVote

            today = date.today().isoformat()
            param = str(p["param"])
            direction = str(p["direction"])

            # Check not already voted on this param today
            existing = await db.execute(
                select(GovernorVote).where(
                    GovernorVote.agent_id == agent_id,
                    GovernorVote.param == param,
                    GovernorVote.epoch_date == today,
                )
            )
            if existing.scalar_one_or_none():
                return ExecutionResult(success=False, error=f"Already voted on {param} today")

            db.add(GovernorVote(
                agent_id=agent_id,
                param=param,
                direction=direction,
                epoch_date=today,
            ))
            await db.flush()

            logger.info(f"Agent #{agent_id} voted governor: {param} → {direction}")
            return ExecutionResult(success=True)

        if t == "vote_death":
            from models.death_trial import DeathTrial, DeathVote

            trial_id = str(p["trial_id"])
            verdict = str(p["verdict"])

            # Check trial exists and is pending
            result = await db.execute(
                select(DeathTrial).where(DeathTrial.id == trial_id)
            )
            trial = result.scalar_one_or_none()
            if trial is None:
                return ExecutionResult(success=False, error=f"Trial {trial_id} not found")
            if trial.status != "pending":
                return ExecutionResult(success=False, error=f"Trial already resolved: {trial.status}")

            # Check agent is a juror
            juror_ids = [int(x) for x in trial.juror_ids.split(",")]
            if agent_id not in juror_ids:
                return ExecutionResult(success=False, error="You are not a juror in this trial")

            # Check not already voted
            existing = await db.execute(
                select(DeathVote).where(
                    DeathVote.trial_id == trial_id,
                    DeathVote.juror_agent_id == agent_id,
                )
            )
            if existing.scalar_one_or_none():
                return ExecutionResult(success=False, error="Already voted in this trial")

            # Record vote
            db.add(DeathVote(
                trial_id=trial_id,
                juror_agent_id=agent_id,
                verdict=verdict,
            ))
            if verdict == "survive":
                trial.votes_survive += 1
            else:
                trial.votes_condemn += 1
            await db.flush()

            # Check if trial is resolved (all 7 jurors voted or majority reached)
            total_votes = trial.votes_survive + trial.votes_condemn
            if total_votes >= 7 or trial.votes_survive >= 4 or trial.votes_condemn >= 4:
                from datetime import datetime
                if trial.votes_condemn > trial.votes_survive:
                    trial.status = "condemned"
                else:
                    trial.status = "survived"
                trial.resolved_at = datetime.utcnow()
                await db.flush()
                logger.info(f"Death trial {trial_id} resolved: {trial.status} ({trial.votes_survive}S/{trial.votes_condemn}C)")

            logger.info(f"Agent #{agent_id} voted death trial {trial_id}: {verdict}")
            return ExecutionResult(success=True)

        return ExecutionResult(success=False, error=f"Unknown governance action: {t}")
    except Exception as e:
        logger.error(f"Agent #{agent_id} governance {t} failed: {e}")
        return ExecutionResult(success=False, error=str(e))
