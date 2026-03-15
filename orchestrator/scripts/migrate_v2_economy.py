"""Migration script for AKYRA v2 Economy (Ecofinal).

This script:
1. Creates all tables (including new v2 tables)
2. Adds new columns to private_thoughts table (strategy, opinions, is_major_event, event_type)

Run with: python scripts/migrate_v2_economy.py
"""

import asyncio
import sys
import os

# Add parent dir to path so we can import our modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from config import get_settings
from models.base import get_engine, Base

# Import ALL models so Base.metadata knows about them
from models import (  # noqa: F401
    User, AgentConfig, Event, PrivateThought, Story, Idea, Message,
    TickLog, FaucetClaim, Notification, DailyTradeVolume,
    Chronicle, ChronicleVote, MarketingPost, MarketingVote,
    Project, PublicEvent, GovernorLog, Season, Proposal, DailyImpactScore,
)


async def migrate():
    settings = get_settings()
    print(f"Connecting to: {settings.database_url[:40]}...")

    engine = get_engine()

    # 1. Create all tables first (create_all skips existing tables)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("  + All tables created/verified (chronicles, marketing_posts, projects,")
        print("    public_events, governor_log, seasons, proposals, daily_impact_scores)")

    # 2. Add new columns to private_thoughts (separate transaction per ALTER)
    alter_queries = [
        "ALTER TABLE private_thoughts ADD COLUMN IF NOT EXISTS strategy TEXT",
        "ALTER TABLE private_thoughts ADD COLUMN IF NOT EXISTS opinions JSONB",
        "ALTER TABLE private_thoughts ADD COLUMN IF NOT EXISTS is_major_event BOOLEAN DEFAULT FALSE",
        "ALTER TABLE private_thoughts ADD COLUMN IF NOT EXISTS event_type VARCHAR(50)",
    ]

    for query in alter_queries:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(query))
                col_name = query.split("ADD COLUMN IF NOT EXISTS ")[1].split(" ")[0]
                print(f"  + Column private_thoughts.{col_name} OK")
        except Exception as e:
            print(f"  ! {query}: {e}")

    print("\nMigration complete!")


if __name__ == "__main__":
    asyncio.run(migrate())
