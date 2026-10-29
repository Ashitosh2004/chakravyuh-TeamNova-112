"""Auth request/response schemas. Validation mirrors the frontend's zod schemas (src/schemas/auth.ts)."""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")

Level = Literal["beginner", "intermediate", "advanced"]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="ignore")


class RegisterRequest(_Strict):
    display_name: str = Field(min_length=2, max_length=60, alias="displayName")
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("display_name")
    @classmethod
    def trim_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name must be at least 2 characters")
        return v

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address")
        return v

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Include an uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Include a lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Include a number")
        return v


class LoginRequest(_Strict):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address")
        return v


class ForgotPasswordRequest(_Strict):
    email: str = Field(min_length=3, max_length=255)

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address")
        return v


class UserOut(BaseModel):
    """Public user shape consumed by the frontend (src/services/api.ts)."""

    id: str
    email: str
    displayName: str
    level: Level


class AuthResponse(BaseModel):
    user: UserOut


class ForgotPasswordResponse(BaseModel):
    message: str
