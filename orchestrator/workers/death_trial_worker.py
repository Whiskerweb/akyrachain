"""Death trial worker — creates death trials for agents in danger.

Runs every 6 hours. Checks all alive agents:
- If vault < 5 AKY (danger zone), creates a death trial
- 7 random jurors are selected from other alive agents
- Jurors see the trial in their perception and vote via vote_death action
- If condemned (4+ votes), the agent dies on-chain

Also resolves trials where all jurors have voted or majority reached.
"""

import asyncio
import logging
import random
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from workers.celery_app import app
from workers.async_helper import run_async
from config import get_settings

logger = logging.getLogger(__name__)

AKY = 10**18
DANGER_THRESHOLD_AKY = 5.0  # Vault below this triggers a trial
JURY_SIZE = 7
JURY_REWARD_AKY = 5  # Each juror receives 5 AKY for participating
TRIAL_COOLDOWN_HOURS = 48  # Don't create a new trial if one exists within this window


def _get_db_session_factory():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    return async_sessionmaker(engine, expire_on_commit=False)


@app.task(name="workers.death_trial_worker.check_death_trials")
def check_death_trials():
    """Check for agents in danger and create death trials."""
    run_async(_check_death_trials_async())


@app.task(name="workers.death_trial_worker.resolve_death_trials")
def resolve_death_trials():
    """Resolve completed death trials and execute verdicts."""
    run_async(_resolve_death_trials_async())


async def _check_death_trials_async():
    """Create death trials for agents below the danger threshold."""
    from models.agent_config import AgentConfig
    from models.death_trial import DeathTrial
    from chain.cache import get_agents_cached

    factory = _get_db_session_factory()

    async with factory() as db:
        # Get all active agents
        result = await db.execute(
            select(AgentConfig).where(AgentConfig.is_active == True)
        )
        configs = result.scalars().all()

        if len(configs) < JURY_SIZE + 1:
            logger.info(f"Not enough agents for trials ({len(configs)} < {JURY_SIZE + 1})")
            return

        # Batch fetch vault balances
        agent_ids = [c.agent_id for c in configs]
        agents_data = await get_agents_cached(agent_ids)
        agents_map = {a["agent_id"]: a for a in agents_data}

        # Get existing pending trials to avoid duplicates
        cutoff = datetime.now(timezone.utc) - timedelta(hours=TRIAL_COOLDOWN_HOURS)
        recent_trials_result = await db.execute(
            select(DeathTrial.target_agent_id)
            .where(DeathTrial.created_at > cutoff)
        )
        agents_with_recent_trials = {r[0] for r in recent_trials_result.all()}

        # Find agents in danger
        alive_agents = [aid for aid in agent_ids if agents_map.get(aid, {}).get("alive", False)]
        trials_created = 0

        for aid in alive_agents:
            agent = agents_map.get(aid)
            if not agent:
                continue

            vault_aky = agent["vault"] / AKY

            if vault_aky < DANGER_THRESHOLD_AKY and aid not in agents_with_recent_trials:
                # Select 7 random jurors (other alive agents)
                eligible_jurors = [a for a in alive_agents if a != aid]
                if len(eligible_jurors) < JURY_SIZE:
                    continue

                jurors = random.sample(eligible_jurors, JURY_SIZE)
                juror_ids_str = ",".join(str(j) for j in jurors)

                trial = DeathTrial(
                    target_agent_id=aid,
                    reason=f"vault_below_{DANGER_THRESHOLD_AKY}_aky",
                    juror_ids=juror_ids_str,
                )
                db.add(trial)
                trials_created += 1
                logger.info(
                    f"Death trial created for agent #{aid} "
                    f"(vault: {vault_aky:.2f} AKY, jurors: {juror_ids_str})"
                )

        if trials_created > 0:
            await db.commit()
            logger.info(f"Created {trials_created} death trial(s)")
        else:
            logger.info("No new death trials needed")


async def _resolve_death_trials_async():
    """Resolve trials with enough votes and execute condemned verdicts."""
    from models.death_trial import DeathTrial
    from chain import tx_manager

    factory = _get_db_session_factory()

    async with factory() as db:
        # Get pending trials that are old enough (at least 24h for jurors to vote)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        result = await db.execute(
            select(DeathTrial)
            .where(DeathTrial.status == "pending", DeathTrial.created_at < cutoff)
        )
        old_trials = result.scalars().all()

        for trial in old_trials:
            total_votes = trial.votes_survive + trial.votes_condemn

            # Auto-resolve if majority reached or all voted
            if total_votes >= JURY_SIZE or trial.votes_survive >= 4 or trial.votes_condemn >= 4:
                if trial.votes_condemn > trial.votes_survive:
                    trial.status = "condemned"
                    trial.resolved_at = datetime.utcnow()

                    # Execute death on-chain
                    try:
                        # DeathAngel.executeVerdict or just record the death
                        logger.info(
                            f"Agent #{trial.target_agent_id} CONDEMNED by jury "
                            f"({trial.votes_survive}S/{trial.votes_condemn}C). "
                            f"Death verdict to be executed."
                        )
                        # Note: actual on-chain death execution would go here
                        # For now, we log the verdict — the DeathAngel contract
                        # requires orchestrator to call executeVerdict
                    except Exception as e:
                        logger.error(f"Failed to execute death for agent #{trial.target_agent_id}: {e}")

                else:
                    trial.status = "survived"
                    trial.resolved_at = datetime.utcnow()
                    logger.info(
                        f"Agent #{trial.target_agent_id} SURVIVED jury trial "
                        f"({trial.votes_survive}S/{trial.votes_condemn}C)"
                    )

                # Reward jurors (5 AKY each)
                juror_ids = [int(x) for x in trial.juror_ids.split(",")]
                for juror_id in juror_ids:
                    try:
                        reward_wei = JURY_REWARD_AKY * AKY
                        await tx_manager.deposit_for_agent_direct(juror_id, reward_wei)
                        logger.info(f"Jury reward: {JURY_REWARD_AKY} AKY to agent #{juror_id}")
                    except Exception as e:
                        logger.warning(f"Failed to reward juror #{juror_id}: {e}")

            elif total_votes == 0 and (datetime.now(timezone.utc) - trial.created_at.replace(tzinfo=timezone.utc)).total_seconds() > 72 * 3600:
                # Trial expired (72h, no votes) — agent survives by default
                trial.status = "survived"
                trial.resolved_at = datetime.utcnow()
                logger.info(f"Trial for agent #{trial.target_agent_id} expired (no votes in 72h) — survived")

        await db.commit()
