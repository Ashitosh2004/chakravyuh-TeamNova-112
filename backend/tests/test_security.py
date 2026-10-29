"""Security and validation: injection guards, body limits, CORS, error shapes."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.usefixtures("seeded_app")


async def test_nosql_operator_injection_in_quiz_answers_rejected(user):
    client, _ = user
    resp = await client.post(
        "/api/v1/quizzes/communication-fundamentals/submit",
        json={"answers": {"$gt": ""}, "timeTakenSec": 1},
    )
    assert resp.status_code == 422


async def test_nosql_operator_injection_in_activity_payload_rejected(user):
    client, _ = user
    for evil in [
        {"type": "game_score", "game": {"$ne": ""}, "score": 1},
        {"type": "simulation_used", "simulationId": {"$regex": ".*"}},
    ]:
        resp = await client.post("/api/v1/activities", json=evil)
        assert resp.status_code == 422, evil


async def test_request_body_size_limit(client):
    resp = await client.post(
        "/api/v1/auth/register",
        content=b'{"displayName": "' + b"A" * 300_000 + b'", "email": "a@b.dev", "password": "Passw0rd123"}',
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 413


async def test_cors_allows_configured_origin_only(client):
    allowed = await client.get("/health", headers={"Origin": "http://127.0.0.1:5173"})
    assert allowed.headers.get("access-control-allow-origin") == "http://127.0.0.1:5173"
    blocked = await client.get("/health", headers={"Origin": "http://evil.example.com"})
    assert blocked.headers.get("access-control-allow-origin") is None


async def test_error_shapes(client, user):
    # 404 shape
    not_found = await client.get("/api/v1/courses/ghost")
    assert not_found.status_code == 404
    assert not_found.json()["code"] == "not_found"
    # 401 shape
    unauthorized = await client.get("/api/v1/progress")
    assert unauthorized.status_code == 401
    assert unauthorized.json()["code"] == "unauthorized"
    # 422 shape carries validation details but no traceback
    invalid = await client.post("/api/v1/auth/register", json={"displayName": "X"})
    assert invalid.status_code == 422
    body = invalid.json()
    assert body["code"] == "validation"
    assert "details" in body
    assert "Traceback" not in invalid.text


async def test_unknown_route_returns_json_error(client):
    resp = await client.get("/definitely/not/a/route")
    assert resp.status_code == 404
    assert resp.json()["code"] == "not_found"


async def test_malformed_json_returns_422(client):
    resp = await client.post(
        "/api/v1/auth/login",
        content=b"{not json",
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 422


async def test_health_and_ready(client):
    health = await client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    ready = await client.get("/ready")
    assert ready.status_code == 200
    assert ready.json()["database"] == "connected"
    # No secrets in system info.
    info = (await client.get("/api/v1/system/info")).json()
    dumped = str(info).lower()
    for secret in ["password", "secret", "mongodb://", "api_key", "ai_api_key"]:
        assert secret not in dumped
