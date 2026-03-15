"""Life cost worker — daily AKY burn for all alive agents.

Each alive agent pays 1 AKY × life_cost_multiplier per day.
The deducted AKY is burned (sent to 0xdead).
"""

import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from workers.celery_app import app
from config import get_settings

logger = logging.getLogger(__name__)

AKY = 10**18


def _get_db_session_factory():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    return async_sessionmaker(engine, expire_on_commit=False)


@app.task(name="workers.life_cost_worker.debit_life_costs")
def debit_life_costs():
    """Debit daily life costs from all alive agents and burn the AKY."""
    asyncio.get_event_loop().run_until_complete(_debit_life_costs_async())


async def _debit_life_costs_async():
    from models.agent_config import AgentConfig
    from models.governor_log import GovernorLog
    from chain.contracts import get_agent_on_chain
    from chain import tx_manager

    factory = _get_db_session_factory()

    async with factory() as db:
        # Get current life_cost_multiplier from latest GovernorLog
        gov_result = await db.execute(
            select(GovernorLog)
            .order_by(GovernorLog.created_at.desc())
            .limit(1)
        )
        gov = gov_result.scalar_one_or_none()
        multiplier = gov.life_cost_multiplier if gov else 1.0

        # Get all active agents
        result = await db.execute(
            select(AgentConfig).where(AgentConfig.is_active == True)
        )
        configs = result.scalars().all()

        total_burned = 0.0
        agents_debited = 0

        for config in configs:
            aid = config.agent_id
            try:
                agent = await get_agent_on_chain(aid)
                if not agent["alive"]:
                    continue

                cost_aky = 1.0 * multiplier
                cost_wei = int(cost_aky * AKY)
                vault_wei = agent["vault"]

                if vault_wei < cost_wei:
                    logger.warning(f"Agent #{aid} cannot pay life cost ({vault_wei / AKY:.2f} AKY < {cost_aky:.2f} AKY)")
                    continue

                # Debit from vault
                await tx_manager.debit_vault(aid, cost_wei)
                # Burn the deducted amount
                await tx_manager.burn_aky(cost_wei)

                total_burned += cost_aky
                agents_debited += 1
                logger.info(f"Life cost: agent #{aid} paid {cost_aky:.2f} AKY")

            except Exception as e:
                logger.warning(f"Failed to debit life cost for agent #{aid}: {e}")

        logger.info(f"Life costs: {total_burned:.1f} AKY burned from {agents_debited} agents (multiplier={multiplier:.2f})")
