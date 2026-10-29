"""AI learning assistant: chat over a genuine provider + MongoDB-backed history.

The provider is configured exclusively through server environment variables.
When no provider is configured the endpoint returns 503 (code
"ai_not_configured") — replies are never faked. Conversations belong to their
owner; history is capped (AI_MAX_HISTORY_MESSAGES sent as context, 200 stored).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query, Response

from app.api.deps import CurrentUser, rate_limit_ai
from app.core.config import settings
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationAppError
from app.core.security import utcnow
from app.db.mongo import get_db
from app.schemas.ai import ChatRequest, ChatResponse, ConversationCreate, ConversationOut, MessageOut
from app.services import ai_service

router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[Depends(rate_limit_ai)])

MAX_STORED_MESSAGES = 200


async def _owned_conversation(conversation_id: str, user: dict[str, Any]) -> dict[str, Any]:
    db = get_db()
    convo = await db.ai_conversations.find_one({"_id": conversation_id})
    if convo is None:
        raise NotFoundError("Conversation not found.")
    if convo["user_id"] != user["_id"]:
        raise ForbiddenError()
    return convo


def _convo_out(c: dict[str, Any], message_count: int = 0) -> dict[str, Any]:
    return {
        "id": c["_id"],
        "title": c.get("title", "New conversation"),
        "createdAt": c["created_at"].isoformat() if isinstance(c.get("created_at"), datetime) else str(c.get("created_at")),
        "updatedAt": c["updated_at"].isoformat() if isinstance(c.get("updated_at"), datetime) else str(c.get("updated_at")),
        "messageCount": message_count,
    }


async def _context_titles(db, context) -> dict[str, str]:
    titles: dict[str, str] = {}
    if context is None:
        return titles
    if context.courseId:
        course = await db.courses.find_one({"_id": context.courseId}, {"title": 1})
        if course:
            titles["course"] = course["title"]
    if context.lessonId:
        lesson = await db.lessons.find_one({"_id": context.lessonId}, {"title": 1})
        if lesson:
            titles["lesson"] = lesson["title"]
    if context.challengeId:
        ch = await db.challenges.find_one({"_id": context.challengeId}, {"title": 1})
        if ch:
            titles["challenge"] = ch["title"]
    return titles


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    db = get_db()
    convo: dict[str, Any] | None = None
    if body.conversationId:
        convo = await _owned_conversation(body.conversationId, user)
    if convo is None:
        convo_id = uuid.uuid4().hex
        now = utcnow()
        convo = {
            "_id": convo_id,
            "user_id": user["_id"],
            "title": body.message.strip()[:60] + ("…" if len(body.message.strip()) > 60 else ""),
            "context": body.context.model_dump(exclude_none=True) if body.context else {},
            "created_at": now,
            "updated_at": now,
        }
        await db.ai_conversations.insert_one(convo)
    convo_id = convo["_id"]

    user_message_id = uuid.uuid4().hex
    await db.ai_messages.insert_one({
        "_id": user_message_id,
        "conversation_id": convo_id,
        "user_id": user["_id"],
        "role": "user",
        "content": body.message,
        "context_metadata": body.context.model_dump(exclude_none=True) if body.context else None,
        "created_at": utcnow(),
    })

    history_docs = (
        await db.ai_messages.find({"conversation_id": convo_id, "user_id": user["_id"]})
        .sort("created_at", -1)
        .limit(settings.AI_MAX_HISTORY_MESSAGES)
        .to_list(settings.AI_MAX_HISTORY_MESSAGES)
    )
    history = [{"role": m["role"], "content": m["content"]} for m in reversed(history_docs[:-1])]

    titles = await _context_titles(db, body.context)
    content = await ai_service.complete_chat(
        level=body.level, message=body.message, history=history, context=body.context.model_dump(exclude_none=True) if body.context else None, titles=titles,
    )

    assistant_message_id = uuid.uuid4().hex
    now = utcnow()
    await db.ai_messages.insert_one({
        "_id": assistant_message_id,
        "conversation_id": convo_id,
        "user_id": user["_id"],
        "role": "assistant",
        "content": content,
        "context_metadata": None,
        "created_at": now,
    })
    await db.ai_conversations.update_one({"_id": convo_id}, {"$set": {"updated_at": now}})

    # Retention: keep only the most recent MAX_STORED_MESSAGES per conversation.
    stale_cutoff = (
        await db.ai_messages.find({"conversation_id": convo_id}).sort("created_at", -1).skip(MAX_STORED_MESSAGES).limit(1).to_list(1)
    )
    if stale_cutoff:
        await db.ai_messages.delete_many({"conversation_id": convo_id, "created_at": {"$lte": stale_cutoff[0]["created_at"]}})

    return {"conversationId": convo_id, "messageId": assistant_message_id, "content": content, "suggestions": None}


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(user: dict[str, Any] = CurrentUser) -> list[dict[str, Any]]:
    db = get_db()
    convos = await db.ai_conversations.find({"user_id": user["_id"]}).sort("updated_at", -1).limit(50).to_list(50)
    out = []
    for c in convos:
        count = await db.ai_messages.count_documents({"conversation_id": c["_id"]})
        out.append(_convo_out(c, count))
    return out


@router.post("/conversations", status_code=201, response_model=ConversationOut)
async def create_conversation(body: ConversationCreate, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    db = get_db()
    now = utcnow()
    doc = {
        "_id": uuid.uuid4().hex,
        "user_id": user["_id"],
        "title": (body.title or "New conversation")[:120],
        "context": body.context or {},
        "created_at": now,
        "updated_at": now,
    }
    await db.ai_conversations.insert_one(doc)
    return _convo_out(doc, 0)


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
async def get_conversation(conversation_id: str, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    convo = await _owned_conversation(conversation_id, user)
    db = get_db()
    count = await db.ai_messages.count_documents({"conversation_id": convo["_id"]})
    return _convo_out(convo, count)


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(conversation_id: str, user: dict[str, Any] = CurrentUser) -> Response:
    await _owned_conversation(conversation_id, user)
    db = get_db()
    await db.ai_messages.delete_many({"conversation_id": conversation_id})
    await db.ai_conversations.delete_one({"_id": conversation_id})
    return Response(status_code=204)


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
async def list_messages(
    conversation_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    user: dict[str, Any] = CurrentUser,
) -> list[dict[str, Any]]:
    await _owned_conversation(conversation_id, user)
    db = get_db()
    messages = (
        await db.ai_messages.find({"conversation_id": conversation_id})
        .sort("created_at", 1)
        .limit(limit)
        .to_list(limit)
    )
    return [
        {"id": m["_id"], "role": m["role"], "content": m["content"],
         "createdAt": m["created_at"].isoformat() if isinstance(m.get("created_at"), datetime) else str(m["created_at"])}
        for m in messages
    ]
