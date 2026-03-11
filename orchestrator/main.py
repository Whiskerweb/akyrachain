"""AKYRA Orchestrator — FastAPI entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models.base import init_db
from api import auth, agents, sponsors, faucet, feed, worlds, websocket

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("=== AKYRA Orchestrator Starting ===")
    await init_db()
    logger.info("Database tables created")
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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "akyra-orchestrator"}
