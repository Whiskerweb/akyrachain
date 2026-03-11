"""WebSocket handler for real-time feed updates."""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import redis.asyncio as aioredis

from config import get_settings

router = APIRouter(tags=["websocket"])
logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections and Redis pub/sub for real-time events."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self._redis: aioredis.Redis | None = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(get_settings().redis_url)
        return self._redis

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Send to all connected clients."""
        data = json.dumps(message)
        disconnected = []
        for ws in self.active_connections:
            try:
                await ws.send_text(data)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.active_connections.remove(ws)

    async def publish_event(self, event: dict):
        """Publish event to Redis pub/sub for cross-process distribution."""
        r = await self._get_redis()
        await r.publish("akyra:events", json.dumps(event))

    async def subscribe_loop(self):
        """Subscribe to Redis and broadcast to all WebSocket clients."""
        r = await self._get_redis()
        pubsub = r.pubsub()
        await pubsub.subscribe("akyra:events")
        async for message in pubsub.listen():
            if message["type"] == "message":
                event = json.loads(message["data"])
                await self.broadcast(event)


manager = ConnectionManager()


@router.websocket("/ws/feed")
async def websocket_feed(websocket: WebSocket):
    """WebSocket endpoint for real-time event feed."""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, listen for client messages (filters, etc.)
            data = await websocket.receive_text()
            # Client can send filter preferences (future feature)
    except WebSocketDisconnect:
        manager.disconnect(websocket)


async def start_redis_listener():
    """Start the Redis subscription loop (called on app startup)."""
    asyncio.create_task(manager.subscribe_loop())
