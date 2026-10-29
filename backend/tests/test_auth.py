"""Authentication: registration, hashing, login, sessions, refresh, rate limits."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.usefixtures("seeded_app")

CREDS = {"displayName": "Alice Student", "email": "alice@test.dev", "password": "Passw0rd123"}


async def test_register_creates_user_and_session(user):
    client, u = user
    assert u["email"] == "student@test.dev"
    assert u["displayName"] == "Test Student"
    assert u["level"] == "beginner"
    assert "password" not in u and "password_hash" not in u
    me = await client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["user"]["id"] == u["id"]


async def test_password_is_hashed_in_database(user, seeded_app):
    from app.db.mongo import get_db

    db = get_db()
    doc = await db.users.find_one({"email": "student@test.dev"})
    assert doc is not None
    assert doc["password_hash"] != "Passw0rd123"
    assert doc["password_hash"].startswith("$2")  # bcrypt
    from app.core.security import verify_password

    assert verify_password("Passw0rd123", doc["password_hash"])
    assert not verify_password("wrong", doc["password_hash"])


async def test_duplicate_email_rejected(client, user):
    resp = await client.post("/api/v1/auth/register", json={"displayName": "Test Student", "email": "student@test.dev", "password": "Passw0rd123"})
    assert resp.status_code == 409
    body = resp.json()
    assert body["code"] == "conflict"


async def test_register_validation(client):
    for bad in [
        {**CREDS, "email": "not-an-email"},
        {**CREDS, "password": "short1A"},          # too short
        {**CREDS, "password": "alllowercase1"},    # no uppercase
        {**CREDS, "password": "ALLUPPERCASE1"},    # no lowercase
        {**CREDS, "password": "NoNumbersHere"},    # no digit
        {**CREDS, "displayName": "A"},             # too short
    ]:
        resp = await client.post("/api/v1/auth/register", json=bad)
        assert resp.status_code == 422, bad


async def test_login_valid_and_invalid(client, user):
    ok = await client.post("/api/v1/auth/login", json={"email": "student@test.dev", "password": "Passw0rd123"})
    assert ok.status_code == 200
    assert ok.json()["user"]["email"] == "student@test.dev"

    bad = await client.post("/api/v1/auth/login", json={"email": "student@test.dev", "password": "Wrong1Pass"})
    assert bad.status_code == 401
    # No account enumeration: unknown email gives the same message.
    unknown = await client.post("/api/v1/auth/login", json={"email": "ghost@test.dev", "password": "Whatever1"})
    assert unknown.status_code == 401
    assert unknown.json()["message"] == bad.json()["message"]


async def test_me_requires_session(client):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


async def test_logout_revokes_session(user):
    client, u = user
    assert (await client.get("/api/v1/auth/me")).status_code == 200
    out = await client.post("/api/v1/auth/logout")
    assert out.status_code == 204
    assert (await client.get("/api/v1/auth/me")).status_code == 401


async def test_refresh_rotates_and_restores_session(user):
    client, u = user
    # Drop the access cookie but keep the refresh cookie: refresh should mint a new session.
    refresh_value = client.cookies.get("chakravyuh_refresh")
    client.cookies.clear()
    client.cookies.set("chakravyuh_refresh", refresh_value, domain="", path="/api/v1/auth")
    assert (await client.get("/api/v1/auth/me")).status_code == 401
    refreshed = await client.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 200
    assert refreshed.json()["user"]["id"] == u["id"]
    assert (await client.get("/api/v1/auth/me")).status_code == 200


async def test_refresh_rejected_after_logout(user):
    client, _ = user
    refresh_value = client.cookies.get("chakravyuh_refresh")
    await client.post("/api/v1/auth/logout")
    client.cookies.set("chakravyuh_refresh", refresh_value, domain="", path="/api/v1/auth")
    resp = await client.post("/api/v1/auth/refresh")
    assert resp.status_code == 401


async def test_login_rate_limited(client, user, monkeypatch):
    from app.core.config import settings
    from app.core.rate_limit import reset_rate_limits

    monkeypatch.setattr(settings, "RATE_LIMIT_AUTH_PER_MIN", 3)
    reset_rate_limits()
    for _ in range(3):
        await client.post("/api/v1/auth/login", json={"email": "student@test.dev", "password": "nope1A"})
    resp = await client.post("/api/v1/auth/login", json={"email": "student@test.dev", "password": "Passw0rd123"})
    assert resp.status_code == 429


async def test_forgot_password_honest_without_smtp(client, user):
    resp = await client.post("/api/v1/auth/forgot-password", json={"email": "student@test.dev"})
    assert resp.status_code == 200
    # Must not claim an email was sent when SMTP is unconfigured.
    assert "not configured" in resp.json()["message"] or "no message was sent" in resp.json()["message"]
