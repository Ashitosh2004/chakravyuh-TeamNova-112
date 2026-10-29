"""Password hashing (bcrypt), JWT session tokens and auth cookie handling.

Strategy: the session cookie carries a short-lived signed JWT whose `jti` is the
server-side session id; the refresh cookie carries an opaque random token stored
only as a SHA-256 hash in MongoDB. Both are httpOnly; the browser never sees or
stores credentials. Sessions are revocable by deleting/revoking the session doc.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings

SESSION_COOKIE = "chakravyuh_session"
REFRESH_COOKIE = "chakravyuh_refresh"
ALGORITHM = "HS256"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))
    except ValueError:
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(user_id: str, session_id: str) -> str:
    now = utcnow()
    payload = {
        "sub": user_id,
        "jti": session_id,
        "typ": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.SESSION_TTL_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
    if payload.get("typ") != "access" or not payload.get("sub") or not payload.get("jti"):
        return None
    return payload


def new_refresh_token() -> tuple[str, datetime]:
    """Opaque refresh token + its absolute expiry."""
    now = utcnow()
    return secrets.token_urlsafe(48), now + timedelta(days=settings.REFRESH_TTL_DAYS)


def set_auth_cookies(response, access_token: str, refresh_token: str) -> None:
    secure = settings.cookie_secure
    response.set_cookie(
        SESSION_COOKIE, access_token,
        max_age=settings.SESSION_TTL_MINUTES * 60, httponly=True, secure=secure,
        samesite="lax", path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE, refresh_token,
        max_age=settings.REFRESH_TTL_DAYS * 86400, httponly=True, secure=secure,
        samesite="lax", path="/api/v1/auth",
    )


def clear_auth_cookies(response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/api/v1/auth")
