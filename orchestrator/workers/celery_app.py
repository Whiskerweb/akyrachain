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
    },
)
