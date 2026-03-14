"""AKYRA Orchestrator — FastAPI entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models.base import init_db, get_session_factory
from api import auth, agents, sponsors, faucet, feed, worlds, websocket, journal, leaderboard
from api import world as world_map

# Import all models so Base.metadata.create_all picks them up
import models.world_tile  # noqa: F401
import models.build_log  # noqa: F401
import models.daily_build_points  # noqa: F401

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("=== AKYRA Orchestrator Starting ===")
    await init_db()
    logger.info("Database tables created")

    # Auto-generate world grid if not exists
    try:
        from core.world_generator import generate_world, is_world_generated
        factory = get_session_factory()
        async with factory() as db:
            if not await is_world_generated(db):
                logger.info("World not generated — generating 200x200 grid...")
                count = await generate_world(db)
                logger.info(f"World generated: {count} tiles")
            else:
                logger.info("World already generated")
    except Exception as e:
        logger.warning(f"World generation check failed (non-fatal): {e}")

    await websocket.start_redis_listener()
    logger.info("Redis WebSocket listener started")
    yield
    # Shutdown
    logger.info("=== AKYRA Orchestrator Shutting Down ===")


app = FastAPI(
    title="AKYRA Orchestrator",
    description="Backend orchestrator for the AKYRA AI agent ecosystem",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow frontend (Vercel) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(agents.router)
app.include_router(sponsors.router)
app.include_router(faucet.router)
app.include_router(feed.router)
app.include_router(worlds.router)
app.include_router(websocket.router)
app.include_router(journal.router)
app.include_router(leaderboard.router)
app.include_router(world_map.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "akyra-orchestrator"}
