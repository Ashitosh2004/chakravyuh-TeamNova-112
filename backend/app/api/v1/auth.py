"""Authentication: register, login, logout, refresh, forgot-password, me.

Cookie sessions: a short-lived JWT in an httpOnly cookie (jti = server session
id) plus a rotating opaque refresh token in a path-scoped httpOnly cookie.
Refresh tokens are stored only as SHA-256 hashes and are revocable.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, Request, Response

from app.api.deps import CurrentUser, rate_limit_auth
from app.core.config import settings
from app.core.exceptions import ConflictError, UnauthorizedError, ValidationAppError
from app.core.security import (
    REFRESH_COOKIE,
    clear_auth_cookies,
    create_access_token,
    hash_password,
    hash_token,
    new_refresh_token,
    set_auth_cookies,
    utcnow,
    verify_password,
)
from app.db.mongo import get_db
from app.schemas.auth import AuthResponse, ForgotPasswordRequest, ForgotPasswordResponse, LoginRequest, RegisterRequest, UserOut
from app.services.emailer import email_configured, send_email

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(user: dict[str, Any]) -> UserOut:
    return UserOut(
        id=user["_id"],
        email=user["email"],
        displayName=user.get("display_name", "Student"),
        level=user.get("level", "beginner"),
    )


async def _create_session(response: Response, user: dict[str, Any], request: Request) -> None:
    db = get_db()
    session_id = uuid.uuid4().hex
    refresh_token, expires_at = new_refresh_token()
    await db.token_sessions.insert_one({
        "_id": session_id,
        "user_id": user["_id"],
        "refresh_token_hash": hash_token(refresh_token),
        "expires_at": expires_at,
        "revoked": False,
        "created_at": utcnow(),
        "last_used_at": utcnow(),
        "user_agent": (request.headers.get("user-agent") or "")[:200],
        "ip": request.client.host if request.client else "",
    })
    access = create_access_token(user["_id"], session_id)
    set_auth_cookies(response, access, refresh_token)


@router.post("/register", status_code=201, response_model=AuthResponse, dependencies=[Depends(rate_limit_auth)])
async def register(body: RegisterRequest, request: Request, response: Response) -> AuthResponse:
    db = get_db()
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise ConflictError("An account with this email already exists. Try signing in instead.")
    now = utcnow()
    user = {
        "_id": uuid.uuid4().hex,
        "email": body.email,
        "display_name": body.display_name,
        "password_hash": hash_password(body.password),
        "role": "student",  # role is never client-settable
        "level": "beginner",
        "preferences": {"theme": "light", "level": "beginner", "reduceMotion": False, "largeText": False, "notifyQuizReminders": True, "notifyAchievements": True},
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "last_login_at": None,
    }
    await db.users.insert_one(user)
    await _create_session(response, user, request)
    return AuthResponse(user=_user_out(user))


@router.post("/login", response_model=AuthResponse, dependencies=[Depends(rate_limit_auth)])
async def login(body: LoginRequest, request: Request, response: Response) -> AuthResponse:
    db = get_db()
    user = await db.users.find_one({"email": body.email})
    # Same message for unknown email and wrong password (no account enumeration).
    if user is None or not verify_password(body.password, user.get("password_hash", "")):
        raise UnauthorizedError("Incorrect email or password.")
    if not user.get("is_active", True):
        raise UnauthorizedError("This account has been deactivated. Contact the administrator.")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": utcnow()}})
    await _create_session(response, user, request)
    return AuthResponse(user=_user_out(user))


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response, user: dict[str, Any] = CurrentUser) -> Response:
    db = get_db()
    from app.core.security import decode_access_token, SESSION_COOKIE

    token = request.cookies.get(SESSION_COOKIE)
    payload = decode_access_token(token) if token else None
    if payload:
        await db.token_sessions.update_one({"_id": payload["jti"]}, {"$set": {"revoked": True}})
    clear_auth_cookies(response)
    return Response(status_code=204)


@router.post("/refresh", response_model=AuthResponse)
async def refresh(request: Request, response: Response) -> AuthResponse:
    db = get_db()
    refresh_token = request.cookies.get(REFRESH_COOKIE)
    if not refresh_token:
        raise UnauthorizedError()
    session = await db.token_sessions.find_one({"refresh_token_hash": hash_token(refresh_token)})
    if session is None or session.get("revoked") or session.get("expires_at", utcnow()) < utcnow():
        raise UnauthorizedError()
    user = await db.users.find_one({"_id": session["user_id"]})
    if user is None or not user.get("is_active", True):
        raise UnauthorizedError()
    # Rotate: revoke the presented refresh token and issue a fresh session.
    await db.token_sessions.update_one({"_id": session["_id"]}, {"$set": {"revoked": True}})
    await _create_session(response, user, request)
    return AuthResponse(user=_user_out(user))


@router.post("/forgot-password", response_model=ForgotPasswordResponse, dependencies=[Depends(rate_limit_auth)])
async def forgot_password(body: ForgotPasswordRequest) -> ForgotPasswordResponse:
    db = get_db()
    user = await db.users.find_one({"email": body.email})
    if user is None:
        # Do not reveal whether the account exists; stay honest about delivery.
        if email_configured():
            return ForgotPasswordResponse(message="If an account exists for that email, a password reset link has been sent.")
        return ForgotPasswordResponse(
            message="If an account exists for that email it can be reset by the administrator. "
            "(Email delivery is not configured on this server, so no message was sent.)"
        )
    if email_configured():
        token = secrets.token_urlsafe(32)
        await db.password_resets.insert_one({
            "_id": token,
            "user_id": user["_id"],
            "expires_at": utcnow() + timedelta(hours=1),
            "used": False,
            "created_at": utcnow(),
        })
        sent = await send_email(
            body.email,
            f"{settings.APP_NAME} password reset",
            f"Hello {user.get('display_name', 'there')},\n\nUse this one-time token to reset your password:\n{token}\n\nIf you did not request this, ignore this email.",
        )
        if sent:
            return ForgotPasswordResponse(message="If an account exists for that email, a password reset link has been sent.")
        return ForgotPasswordResponse(message="If an account exists for that email, reset delivery failed — please try again later.")
    return ForgotPasswordResponse(
        message="If an account exists for that email it can be reset by the administrator. "
        "(Email delivery is not configured on this server, so no message was sent.)"
    )


@router.get("/me", response_model=AuthResponse)
async def me(user: dict[str, Any] = CurrentUser) -> AuthResponse:
    return AuthResponse(user=_user_out(user))
