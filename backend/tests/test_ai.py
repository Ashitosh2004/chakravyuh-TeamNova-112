"""AI assistant: honest unconfigured state, provider adapter (mocked), ownership.

Provider integration is tested with a mocked HTTP transport (clearly labelled
below) — no live provider credentials exist in this environment. Everything
else (conversations, messages, ownership) runs against real MongoDB.
"""

from __future__ import annotations

import httpx
import pytest

pytestmark = pytest.mark.usefixtures("seeded_app")


async def test_ai_unconfigured_reports_honestly(user):
    client, _ = user
    resp = await client.post("/api/v1/ai/chat", json={"message": "What is an op-amp?", "level": "beginner"})
    assert resp.status_code == 503
    body = resp.json()
    assert body["code"] == "ai_not_configured"
    assert "not configured" in body["message"]


async def test_system_info_reports_ai_state(client):
    info = (await client.get("/api/v1/system/info")).json()
    assert info["aiConfigured"] is False
    assert info["environment"] == "development"


async def test_conversation_ownership(user, second_user):
    client_a, _ = user
    client_b, _ = second_user
    created = await client_a.post("/api/v1/ai/conversations", json={"title": "Op-amps"})
    assert created.status_code == 201
    convo_id = created.json()["id"]

    ok = await client_a.get(f"/api/v1/ai/conversations/{convo_id}")
    assert ok.status_code == 200
    denied = await client_b.get(f"/api/v1/ai/conversations/{convo_id}")
    assert denied.status_code == 403
    deleted = await client_b.delete(f"/api/v1/ai/conversations/{convo_id}")
    assert deleted.status_code == 403


async def test_conversation_listing(user):
    client, _ = user
    await client.post("/api/v1/ai/conversations", json={"title": "One"})
    await client.post("/api/v1/ai/conversations", json={"title": "Two"})
    listing = (await client.get("/api/v1/ai/conversations")).json()
    assert [c["title"] for c in listing] == ["Two", "One"]  # most recent first


async def test_chat_message_length_validation(user):
    client, _ = user
    resp = await client.post("/api/v1/ai/chat", json={"message": "x" * 5000, "level": "beginner"})
    assert resp.status_code == 422


# ------------------------------------------------- mocked provider adapter
# These tests monkeypatch httpx with a MockTransport — NOT a live integration.


def _install_mock_provider(monkeypatch, handler, *, provider="openai", timeout=30):
    """Point the ai_service at a mocked HTTP transport with fake credentials."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "AI_PROVIDER", provider)
    monkeypatch.setattr(settings, "AI_API_KEY", "test-key")
    monkeypatch.setattr(settings, "AI_MODEL", "test-model")
    monkeypatch.setattr(settings, "AI_TIMEOUT_SECONDS", timeout)

    import app.services.ai_service as svc

    real_client = svc.httpx.AsyncClient

    def factory(*args, **kwargs):
        kwargs.pop("timeout", None)
        return real_client(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(svc.httpx, "AsyncClient", factory)


async def test_mocked_provider_success_persists_conversation(user, monkeypatch):
    """MOCKED provider: verifies request construction, response parsing and persistence."""

    def handler(request: httpx.Request) -> httpx.Response:
        import json as jsonlib

        payload = jsonlib.loads(request.content)
        assert payload["model"] == "test-model"
        assert request.headers["Authorization"] == "Bearer test-key"
        assert any(m["role"] == "user" and "op-amp" in m["content"] for m in payload["messages"])
        return httpx.Response(200, json={"choices": [{"message": {"content": "An **op-amp** is a high-gain DC amplifier."}}]})

    _install_mock_provider(monkeypatch, handler)
    client, _ = user
    resp = await client.post("/api/v1/ai/chat", json={"message": "What is an op-amp?", "level": "beginner"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["content"].startswith("An **op-amp**")
    assert body["conversationId"]

    messages = (await client.get(f"/api/v1/ai/conversations/{body['conversationId']}/messages")).json()
    roles = [m["role"] for m in messages]
    assert roles == ["user", "assistant"]
    assert messages[1]["content"] == body["content"]


async def test_mocked_provider_timeout_maps_to_503(user, monkeypatch):
    """MOCKED provider: a provider timeout becomes a structured 503, never a fabricated reply."""
    import httpx

    def handler(request):
        raise httpx.ConnectTimeout("simulated timeout")

    _install_mock_provider(monkeypatch, handler, timeout=1)
    client, _ = user
    resp = await client.post("/api/v1/ai/chat", json={"message": "hello", "level": "beginner"})
    assert resp.status_code == 503
    assert resp.json()["code"] == "ai_timeout"


async def test_mocked_provider_rate_limit_maps_to_429(user, monkeypatch):
    import httpx

    def handler(request):
        return httpx.Response(429, json={"error": "quota"})

    _install_mock_provider(monkeypatch, handler)
    client, _ = user
    resp = await client.post("/api/v1/ai/chat", json={"message": "hello", "level": "beginner"})
    assert resp.status_code == 429
    assert resp.json()["code"] == "rate_limited"


async def test_mocked_provider_auth_error_maps_to_503(user, monkeypatch):
    import httpx

    def handler(request):
        return httpx.Response(401, json={"error": "bad key"})

    _install_mock_provider(monkeypatch, handler)
    client, _ = user
    resp = await client.post("/api/v1/ai/chat", json={"message": "hello", "level": "beginner"})
    assert resp.status_code == 503
    assert resp.json()["code"] == "ai_provider_auth"
