"""User profile and preferences schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.auth import Level


class ProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    displayName: str | None = Field(default=None, min_length=2, max_length=60)
    level: Level | None = None

    @field_validator("displayName")
    @classmethod
    def trim_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name must be at least 2 characters")
        return v


class Preferences(BaseModel):
    theme: Literal["light", "dark", "system"] = "light"
    level: Level = "beginner"
    reduceMotion: bool = False
    largeText: bool = False
    notifyQuizReminders: bool = True
    notifyAchievements: bool = True


class PreferencesUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    theme: Literal["light", "dark", "system"] | None = None
    level: Level | None = None
    reduceMotion: bool | None = None
    largeText: bool | None = None
    notifyQuizReminders: bool | None = None
    notifyAchievements: bool | None = None
