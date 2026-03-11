"""Reward worker — daily reward computation.

Sprint 1: stub. Full Merkle tree + on-chain publishing in Sprint 4.
"""

import logging
from datetime import datetime, timezone

from workers.celery_app import app

logger = logging.getLogger(__name__)


@app.task(name="workers.reward_worker.compute_daily_rewards")
def compute_daily_rewards():
    """Compute daily rewards for all eligible agents.

    Sprint 1: stub. Full implementation in Sprint 4.
    """
    logger.info(f"[{datetime.now(timezone.utc)}] Reward computation — not implemented yet (Sprint 4)")
