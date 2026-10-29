"""User profile and preferences. Users can only touch their own permitted fields."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, serialize
from app.core.security import utcnow
from app.db.mongo import get_db
from app.schemas.auth import UserOut
from app.schemas.user import Preferences, PreferencesUpdateRequest, ProfileUpdateRequest

router = APIRouter(prefix="/users", tags=["users"])

DEFAULT_PREFERENCES = Preferences()


def _user_out(user: dict[str, Any]) -> UserOut:
    return UserOut(id=user["_id"], email=user["email"], displayName=user.get("display_name", "Student"), level=user.get("level", "beginner"))


@router.get("/me", response_model=UserOut)
async def get_me(user: dict[str, Any] = CurrentUser) -> UserOut:
    return _user_out(user)


@router.patch("/me", response_model=UserOut)
async def update_me(body: ProfileUpdateRequest, user: dict[str, Any] = CurrentUser) -> UserOut:
    db = get_db()
    update: dict[str, Any] = {"$set": {"updated_at": utcnow()}}
    if body.displayName is not None:
        update["$set"]["display_name"] = body.displayName
    if body.level is not None:
        update["$set"]["level"] = body.level
    await db.users.update_one({"_id": user["_id"]}, update)
    fresh = await db.users.find_one({"_id": user["_id"]})
    return _user_out(fresh)


@router.get("/me/preferences", response_model=Preferences)
async def get_preferences(user: dict[str, Any] = CurrentUser) -> Preferences:
    stored = user.get("preferences") or {}
    merged = {**DEFAULT_PREFERENCES.model_dump(), **stored}
    return Preferences(**merged)


@router.patch("/me/preferences", response_model=Preferences)
async def update_preferences(body: PreferencesUpdateRequest, user: dict[str, Any] = CurrentUser) -> Preferences:
    db = get_db()
    stored = user.get("preferences") or {}
    merged = {**DEFAULT_PREFERENCES.model_dump(), **stored}
    for key, value in body.model_dump(exclude_none=True).items():
        merged[key] = value
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"preferences": merged, "updated_at": utcnow()}})
    return Preferences(**merged)
