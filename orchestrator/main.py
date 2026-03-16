"""AKYRA Orchestrator — FastAPI entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from models.base import init_db
from api import auth, agents, sponsors, faucet, feed, worlds, websocket, journal, leaderboard, ideas
from api import world as world_map
from api import projects, chronicles, marketing, governor

# Import all models so Base.metadata.create_all picks them up
import models  # noqa: F401

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

# ──── Cache-Control middleware ────
# Sets browser cache headers to avoid redundant API calls on navigation
CACHE_RULES: list[tuple[str, int]] = [
    ("/api/stats", 30),
    ("/api/leaderboard/", 10),
    ("/api/graveyard", 10),
    ("/api/world/graph", 5),
    ("/api/feed/", 5),
    ("/api/agents", 10),
    ("/api/ideas", 10),
    ("/api/chronicles", 15),
    ("/api/worlds", 30),
    ("/api/projects", 30),
]


class CacheControlMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        path = request.url.path
        # Only cache GET requests, skip auth/sponsor endpoints
        if request.method == "GET" and not path.startswith(("/api/auth", "/api/sponsor")):
            for prefix, max_age in CACHE_RULES:
                if path.startswith(prefix):
                    response.headers["Cache-Control"] = f"public, max-age={max_age}"
                    break
        return response


app.add_middleware(CacheControlMiddleware)

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
app.include_router(ideas.router)
app.include_router(projects.router)
app.include_router(chronicles.router)
app.include_router(marketing.router)
app.include_router(governor.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "akyra-orchestrator"}
