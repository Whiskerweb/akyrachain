"""Memory manager — Qdrant vector store for agent memories."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    PointStruct,
    VectorParams,
    Filter,
    FieldCondition,
    MatchValue,
)
from sentence_transformers import SentenceTransformer

from config import get_settings

logger = logging.getLogger(__name__)

# Local embedding model (free, 384 dims)
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384
COLLECTION_NAME = "agent_memories"

# Singleton embedding model (loaded once)
_embedder: SentenceTransformer | None = None


def _get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        logger.info(f"Loading embedding model: {EMBEDDING_MODEL}")
        _embedder = SentenceTransformer(EMBEDDING_MODEL, device="cpu")
    return _embedder


def embed_text(text: str) -> list[float]:
    """Generate embedding vector for a text string."""
    model = _get_embedder()
    return model.encode(text).tolist()


@dataclass
class MemoryRecord:
    """A single memory entry."""
    id: str
    content: str
    metadata: dict = field(default_factory=dict)
    score: float = 0.0


class MemoryManager:
    """Manages agent memories in Qdrant."""

    def __init__(self):
        self._client: AsyncQdrantClient | None = None

    async def _get_client(self) -> AsyncQdrantClient:
        if self._client is None:
            settings = get_settings()
            self._client = AsyncQdrantClient(url=settings.qdrant_url)
            await self._ensure_collection()
        return self._client

    async def _ensure_collection(self):
        """Create the memories collection if it doesn't exist."""
        client = self._client
        collections = await client.get_collections()
        names = [c.name for c in collections.collections]
        if COLLECTION_NAME not in names:
            await client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
            )
            logger.info(f"Created Qdrant collection: {COLLECTION_NAME}")

    async def store(
        self,
        agent_id: int,
        content: str,
        metadata: dict | None = None,
    ) -> str:
        """Store a memory for an agent. Returns the point ID."""
        client = await self._get_client()
        point_id = str(uuid.uuid4())
        vector = embed_text(content)

        payload = {
            "agent_id": agent_id,
            "content": content,
            **(metadata or {}),
        }

        await client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                PointStruct(id=point_id, vector=vector, payload=payload)
            ],
        )
        return point_id

    async def recall(
        self,
        agent_id: int,
        query: str,
        top_k: int = 7,
    ) -> list[MemoryRecord]:
        """Recall the most relevant memories for a query."""
        client = await self._get_client()
        query_vector = embed_text(query)

        results = await client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            query_filter=Filter(
                must=[FieldCondition(key="agent_id", match=MatchValue(value=agent_id))]
            ),
            limit=top_k,
        )

        return [
            MemoryRecord(
                id=str(r.id),
                content=r.payload.get("content", ""),
                metadata={k: v for k, v in r.payload.items() if k not in ("content",)},
                score=r.score,
            )
            for r in results
        ]

    async def count(self, agent_id: int) -> int:
        """Count memories for an agent."""
        client = await self._get_client()
        result = await client.count(
            collection_name=COLLECTION_NAME,
            count_filter=Filter(
                must=[FieldCondition(key="agent_id", match=MatchValue(value=agent_id))]
            ),
        )
        return result.count


# Global singleton
memory_manager = MemoryManager()
