"""Test fixtures for AKYRA orchestrator tests."""

import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Use test settings before importing anything
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///test.db"
os.environ["REDIS_URL"] = "redis://localhost:6379/1"
os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only"
os.environ["API_KEY_ENCRYPTION_KEY"] = "a" * 64
os.environ["CHAIN_RPC_URL"] = "http://localhost:8545"
os.environ["FAUCET_ENABLED"] = "true"

from models.base import Base, get_db
from main import app


@pytest_asyncio.fixture
async def db_session():
    """Create a fresh test database for each test."""
    engine = create_async_engine("sqlite+aiosqlite:///test.db", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
    # Cleanup test db file
    if os.path.exists("test.db"):
        os.remove("test.db")


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    """HTTP test client with injected DB session."""

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
