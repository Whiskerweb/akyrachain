"""Tests for auth API endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_signup(client: AsyncClient):
    resp = await client.post("/api/auth/signup", json={
        "email": "test@example.com",
        "password": "securepass123",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_signup_duplicate_email(client: AsyncClient):
    await client.post("/api/auth/signup", json={
        "email": "dupe@example.com",
        "password": "securepass123",
    })
    resp = await client.post("/api/auth/signup", json={
        "email": "dupe@example.com",
        "password": "otherpass123",
    })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_signup_short_password(client: AsyncClient):
    resp = await client.post("/api/auth/signup", json={
        "email": "short@example.com",
        "password": "short",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_login(client: AsyncClient):
    await client.post("/api/auth/signup", json={
        "email": "login@example.com",
        "password": "securepass123",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "login@example.com",
        "password": "securepass123",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await client.post("/api/auth/signup", json={
        "email": "wrong@example.com",
        "password": "securepass123",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "wrong@example.com",
        "password": "wrongpass",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient):
    # Signup and get token
    signup_resp = await client.post("/api/auth/signup", json={
        "email": "me@example.com",
        "password": "securepass123",
    })
    token = signup_resp.json()["access_token"]

    resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "me@example.com"
    assert data["wallet_address"] is None


@pytest.mark.asyncio
async def test_unauthorized_without_token(client: AsyncClient):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 403  # No credentials


@pytest.mark.asyncio
async def test_set_api_key(client: AsyncClient):
    signup_resp = await client.post("/api/auth/signup", json={
        "email": "apikey@example.com",
        "password": "securepass123",
    })
    token = signup_resp.json()["access_token"]

    resp = await client.post("/api/auth/api-key",
        json={
            "llm_provider": "openai",
            "api_key": "sk-test-key-12345",
            "model": "gpt-4o",
            "daily_budget_usd": 2.0,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["provider"] == "openai"


@pytest.mark.asyncio
async def test_set_api_key_invalid_provider(client: AsyncClient):
    signup_resp = await client.post("/api/auth/signup", json={
        "email": "badprov@example.com",
        "password": "securepass123",
    })
    token = signup_resp.json()["access_token"]

    resp = await client.post("/api/auth/api-key",
        json={
            "llm_provider": "invalid_provider",
            "api_key": "sk-test",
            "model": "gpt-4o",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_revoke_api_key(client: AsyncClient):
    signup_resp = await client.post("/api/auth/signup", json={
        "email": "revoke@example.com",
        "password": "securepass123",
    })
    token = signup_resp.json()["access_token"]

    # Set key
    await client.post("/api/auth/api-key",
        json={"llm_provider": "anthropic", "api_key": "sk-ant-test", "model": "claude-sonnet-4-6"},
        headers={"Authorization": f"Bearer {token}"},
    )

    # Revoke
    resp = await client.delete("/api/auth/api-key", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200

    # Verify
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["llm_provider"] is None
