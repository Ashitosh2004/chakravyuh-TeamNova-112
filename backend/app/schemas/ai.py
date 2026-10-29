"""AI assistant schemas (contract: docs/API_CONTRACT.md)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.auth import Level


class ChatContext(BaseModel):
    model_config = ConfigDict(extra="ignore")
    courseId: str | None = Field(default=None, max_length=64)
    lessonId: str | None = Field(default=None, max_length=64)
    simulationId: str | None = Field(default=None, max_length=64)
    challengeId: str | None = Field(default=None, max_length=64)
    code: str | None = Field(default=None, max_length=5000)
    quizQuestionId: str | None = Field(default=None, max_length=64)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    conversationId: str | None = Field(default=None, max_length=64)
    message: str = Field(min_length=1, max_length=4000)
    level: Level
    context: ChatContext | None = None

    @field_validator("message")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Message must not be empty")
        return v


class Suggestion(BaseModel):
    label: str = Field(max_length=80)
    href: str = Field(max_length=200)


class ChatResponse(BaseModel):
    conversationId: str
    messageId: str
    content: str = Field(max_length=20_000)
    suggestions: list[Suggestion] | None = None


class ConversationCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str | None = Field(default=None, max_length=120)
    context: dict[str, Any] | None = None


class ConversationOut(BaseModel):
    id: str
    title: str
    createdAt: str
    updatedAt: str
    messageCount: int


class MessageOut(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    createdAt: str
