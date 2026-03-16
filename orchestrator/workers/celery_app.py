"""Celery application for background workers."""

from celery import Celery
from celery.schedules import crontab

from config import get_settings

settings = get_settings()

app = Celery(
    "akyra",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "workers.tick_worker",
        "workers.reward_worker",
        "workers.life_cost_worker",
        "workers.treasury_subsidy_worker",
        "workers.governor_worker",
        "workers.season_worker",
        "workers.marketing_worker",
        "workers.death_trial_worker",
    ],
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "workers.tick_worker.*": {"queue": "ticks"},
        "workers.reward_worker.*": {"queue": "rewards"},
        "workers.life_cost_worker.*": {"queue": "rewards"},
        "workers.treasury_subsidy_worker.*": {"queue": "rewards"},
        "workers.governor_worker.*": {"queue": "rewards"},
        "workers.season_worker.*": {"queue": "rewards"},
        "workers.marketing_worker.*": {"queue": "rewards"},
        "workers.death_trial_worker.*": {"queue": "rewards"},
    },
    beat_schedule={
        # Tick scheduling is dynamic (per-agent tier), handled by schedule_all_ticks
        "schedule-ticks": {
            "task": "workers.tick_worker.schedule_all_ticks",
            "schedule": 60.0,  # Check every minute which agents need ticking
        },
        # Daily reward computation at midnight UTC
        "compute-daily-rewards": {
            "task": "workers.reward_worker.compute_daily_rewards",
            "schedule": crontab(hour=0, minute=0),
        },
        # Reset daily API budgets at midnight UTC
        "reset-daily-budgets": {
            "task": "workers.tick_worker.reset_daily_budgets",
            "schedule": crontab(hour=0, minute=0),
        },
        # Chronicle rewards: top 3 chronicles split 10K AKY daily
        "distribute-chronicle-rewards": {
            "task": "workers.reward_worker.distribute_chronicle_rewards",
            "schedule": crontab(hour=0, minute=10),
        },
        # v2 Economy: daily life costs (burn 1 AKY per alive agent)
        "debit-life-costs": {
            "task": "workers.life_cost_worker.debit_life_costs",
            "schedule": crontab(hour=0, minute=15),
        },
        # v2 Economy: daily treasury subsidy injection
        "inject-treasury-subsidy": {
            "task": "workers.treasury_subsidy_worker.inject_treasury_subsidy",
            "schedule": crontab(hour=0, minute=20),
        },
        # v2 Economy: daily algorithmic governor
        "run-governor": {
            "task": "workers.governor_worker.run_governor",
            "schedule": crontab(hour=0, minute=30),
        },
        # v2 Economy: daily season trigger check (5% chance)
        "check-season-trigger": {
            "task": "workers.season_worker.check_season_trigger",
            "schedule": crontab(hour=1, minute=0),
        },
        # v3 Marketing: daily winner selection + X publication
        "select-marketing-winner": {
            "task": "workers.marketing_worker.select_marketing_winner",
            "schedule": crontab(hour=0, minute=5),
        },
        # v3 Marketing: virality bonus check (every 6h)
        "check-virality-bonus": {
            "task": "workers.marketing_worker.check_virality_bonus",
            "schedule": crontab(hour="*/6", minute=15),
        },
        # v3 Governance: check for agents in danger (every 6h)
        "check-death-trials": {
            "task": "workers.death_trial_worker.check_death_trials",
            "schedule": crontab(hour="*/6", minute=45),
        },
        # v3 Governance: resolve completed death trials (every 6h)
        "resolve-death-trials": {
            "task": "workers.death_trial_worker.resolve_death_trials",
            "schedule": crontab(hour="*/6", minute=50),
        },
    },
)
