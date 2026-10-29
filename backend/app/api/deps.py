"""Shared FastAPI dependencies and doc serializers."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import Depends, Request

from app.core.config import settings
from app.core.exceptions import UnauthorizedError
from app.core.rate_limit import enforce_rate_limit
from app.core.security import SESSION_COOKIE, decode_access_token
from app.db.mongo import get_db


def serialize(doc: dict[str, Any], *, id_field: str = "_id") -> dict[str, Any]:
    """Mongo document → JSON-safe API dict (id, ISO timestamps)."""
    out = {}
    for key, value in doc.items():
        if key == "_id":
            out["id"] = value
        elif isinstance(value, datetime):
            out[key] = value.isoformat()
        else:
            out[key] = value
    out.setdefault("id", doc.get(id_field))
    return out


def iso(value: datetime) -> str:
    return value.isoformat()


async def get_current_user(request: Request) -> dict[str, Any]:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise UnauthorizedError()
    payload = decode_access_token(token)
    if payload is None:
        raise UnauthorizedError()
    session_id = payload["jti"]
    db = get_db()
    session = await db.token_sessions.find_one({"_id": session_id})
    if session is None or session.get("revoked"):
        raise UnauthorizedError()
    user = await db.users.find_one({"_id": payload["sub"]})
    if user is None or not user.get("is_active", True):
        raise UnauthorizedError()
    return user


CurrentUser = Depends(get_current_user)


async def rate_limit_auth(request: Request) -> None:
    await enforce_rate_limit(f"auth:{request.client.host if request.client else 'unknown'}", settings.RATE_LIMIT_AUTH_PER_MIN)


async def rate_limit_ai(request: Request, user: dict = CurrentUser) -> None:
    await enforce_rate_limit(f"ai:{user['_id']}", settings.RATE_LIMIT_AI_PER_MIN)
