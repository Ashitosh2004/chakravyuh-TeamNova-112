"""Activity recording and progress aggregation.

Events are stored in activity_events; user_progress holds denormalized counters.
Idempotent event types (lesson_completed, challenge_passed, simulation_used,
scenario_completed) are deduplicated by a partial unique index so repeated
completions never inflate totals or duplicate achievements.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from pydantic import ValidationError

from app.db.mongo import get_db
from app.core.exceptions import ValidationAppError
from app.schemas.progress import ActivityEventAdapter
from app.services.achievements import ACHIEVEMENTS_CATALOG, sync_user_achievements

# resource_id derivation per event type
def _resource_id(event: dict[str, Any]) -> str:
    t = event["type"]
    if t == "lesson_completed":
        return f"{event['courseId']}/{event['lessonId']}"
    if t in ("quiz_attempt",):
        return f"quiz:{event['quizId']}:{uuid.uuid4().hex[:12]}"
    if t in ("challenge_run", "challenge_passed"):
        return f"challenge:{event['challengeId']}" if t == "challenge_passed" else f"run:{uuid.uuid4().hex[:16]}"
    if t == "simulation_used":
        return f"simulation:{event['simulationId']}"
    if t == "scenario_completed":
        return f"scenario:{event['scenarioId']}"
    if t == "game_score":
        return f"game:{event['game']}:{uuid.uuid4().hex[:12]}"
    return f"event:{uuid.uuid4().hex}"


async def record_activity(user_id: str, payload: dict[str, Any]) -> str:
    """Validate + persist an activity event; update aggregate counters.

    Returns the stored event id. Raises pydantic ValidationError on bad payloads.
    """
    try:
        event = ActivityEventAdapter.validate_python(payload)
    except ValidationError as exc:
        raise ValidationAppError("Invalid activity event.", details={"errors": exc.errors(include_url=False)[:5]}) from exc
    data = event.model_dump()
    etype = data.pop("type")
    db = get_db()
    now = datetime.now(timezone.utc)
    resource = _resource_id({**data, "type": etype})

    doc = {
        "_id": uuid.uuid4().hex,
        "user_id": user_id,
        "type": etype,
        "resource_id": resource,
        "data": data,
        "occurred_at": now,
    }
    # Idempotent types upsert on (user, type, resource); append-only types insert.
    if etype in ("lesson_completed", "challenge_passed", "simulation_used", "scenario_completed"):
        await db.activity_events.update_one(
            {"user_id": user_id, "type": etype, "resource_id": resource},
            {"$setOnInsert": doc},
            upsert=True,
        )
        stored = await db.activity_events.find_one({"user_id": user_id, "type": etype, "resource_id": resource})
        event_id = stored["_id"]
        points_delta = data.get("points", 0) if etype == "challenge_passed" else 0
    else:
        await db.activity_events.insert_one(doc)
        event_id = doc["_id"]
        points_delta = 0

    await _update_user_progress(user_id, etype, points_delta)
    await sync_user_achievements(user_id)
    return event_id


async def _update_user_progress(user_id: str, etype: str, points_delta: int) -> None:
    db = get_db()
    if etype == "lesson_completed":
        inc, key = {"lessons_completed": 1}, None
    elif etype == "quiz_attempt":
        inc, key = {"quizzes_completed": 1}, None
    elif etype == "challenge_passed":
        inc, key = {"challenges_completed": 1}, "total_points"
    elif etype == "simulation_used":
        inc, key = {"simulations_completed": 1}, None
    elif etype == "scenario_completed":
        inc, key = {"scenarios_completed": 1}, None
    else:
        return
    update: dict[str, Any] = {"$set": {"updated_at": now_utc()}, "$setOnInsert": {"user_id": user_id}}
    if inc:
        update["$inc"] = inc
    if key and points_delta:
        update.setdefault("$inc", {})
        update["$inc"][key] = points_delta
    await db.user_progress.update_one({"user_id": user_id}, update, upsert=True)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


async def get_progress_summary(user_id: str) -> dict[str, Any]:
    db = get_db()
    lesson_events = await db.activity_events.find({"user_id": user_id, "type": "lesson_completed"}).to_list(None)
    lessons_completed = sorted(e["resource_id"] for e in lesson_events)

    async def count(etype: str) -> int:
        return await db.activity_events.count_documents({"user_id": user_id, "type": etype})

    up = await db.user_progress.find_one({"user_id": user_id})
    return {
        "lessonsCompleted": lessons_completed,
        "quizAttempts": await count("quiz_attempt"),
        "challengesPassed": await count("challenge_passed"),
        "simulationsUsed": await count("simulation_used"),
        "scenariosCompleted": await count("scenario_completed"),
        "totalPoints": int((up or {}).get("total_points", 0)),
    }


async def get_activity_by_day(user_id: str, days: int) -> list[dict[str, Any]]:
    days = max(1, min(days, 90))
    db = get_db()
    since = datetime.now(timezone.utc) - timedelta(days=days)
    cursor = db.activity_events.find(
        {"user_id": user_id, "occurred_at": {"$gte": since}}, {"occurred_at": 1}
    )
    counts: dict[str, int] = {}
    async for ev in cursor:
        day = ev["occurred_at"].astimezone(timezone.utc).strftime("%Y-%m-%d")
        counts[day] = counts.get(day, 0) + 1
    out = []
    today = datetime.now(timezone.utc).date()
    for i in range(days):
        d = today - timedelta(days=days - 1 - i)
        key = d.strftime("%Y-%m-%d")
        out.append({"date": key, "count": counts.get(key, 0)})
    return out


async def get_course_progress(user_id: str, course_id: str) -> dict[str, Any]:
    db = get_db()
    total = await db.lessons.count_documents({"course_id": course_id})
    completed = await db.activity_events.count_documents(
        {"user_id": user_id, "type": "lesson_completed", "resource_id": {"$regex": f"^{course_id}/"}}
    )
    percent = round((completed / total) * 100) if total else 0
    return {"courseId": course_id, "totalLessons": total, "completedLessons": completed, "percent": percent}
