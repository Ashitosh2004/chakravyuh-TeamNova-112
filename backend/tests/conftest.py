"""Test fixtures: real MongoDB in a dedicated test database (chakravyuh_test).

Each test gets a fresh connection (pymongo async clients bind to the running
event loop), recreated indexes, re-seeded published content, and empty user
collections — tests never touch the development database.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

TEST_DB = "chakravyuh_test"

USER_COLLECTIONS = [
    "users", "token_sessions", "password_resets", "activity_events", "user_progress",
    "lesson_progress", "quiz_attempts", "coding_submissions", "simulation_sessions",
    "scenario_sessions", "user_achievements", "ai_conversations", "ai_messages",
]


@pytest_asyncio.fixture
async def seeded_app(monkeypatch):
    from app.core.config import settings
    from app.core.rate_limit import reset_rate_limits
    from app.db import indexes as db_indexes
    from app.db import mongo
    from app.main import app
    from app import seed as seed_module

    monkeypatch.setattr(settings, "MONGODB_DB", TEST_DB)
    monkeypatch.setattr(settings, "BCRYPT_ROUNDS", 4)
    reset_rate_limits()

    await mongo.close()  # fresh client for this event loop
    mongo.connect()
    if not await mongo.ping():
        pytest.fail("MongoDB is not reachable on localhost — start the service to run the test suite")
    for coll in USER_COLLECTIONS:
        await mongo._db.drop_collection(coll)
    await db_indexes.create_indexes()
    await seed_module.seed()
    yield app
    await mongo.close()


@pytest_asyncio.fixture
async def client(seeded_app):
    """Anonymous client (no cookies) — for public/unauthenticated requests."""
    transport = ASGITransport(app=seeded_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


def _make_client(seeded_app):
    transport = ASGITransport(app=seeded_app)
    return AsyncClient(transport=transport, base_url="http://testserver")


@pytest_asyncio.fixture
async def user(seeded_app):
    """A registered, logged-in user with its own cookie-isolated client."""
    async with _make_client(seeded_app) as c:
        resp = await c.post(
            "/api/v1/auth/register",
            json={"displayName": "Test Student", "email": "student@test.dev", "password": "Passw0rd123"},
        )
        assert resp.status_code == 201, resp.text
        yield c, resp.json()["user"]


@pytest_asyncio.fixture
async def second_user(seeded_app):
    """A second independent user with its own cookie-isolated client."""
    async with _make_client(seeded_app) as c:
        resp = await c.post(
            "/api/v1/auth/register",
            json={"displayName": "Second Student", "email": "second@test.dev", "password": "Passw0rd123"},
        )
        assert resp.status_code == 201, resp.text
        yield c, resp.json()["user"]
