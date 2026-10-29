"""Progress, activity history and achievements."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentUser
from app.schemas.progress import ActivityDay, ActivityRecorded, CourseProgress, ProgressSummary
from app.services import achievements as achievements_service
from app.services.activity import get_activity_by_day, get_course_progress, get_progress_summary, record_activity

router = APIRouter(tags=["progress"])


@router.get("/progress", response_model=ProgressSummary)
async def progress(user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    return await get_progress_summary(user["_id"])


@router.get("/progress/activity", response_model=list[ActivityDay])
async def activity(days: int = Query(default=14, ge=1, le=90), user: dict[str, Any] = CurrentUser) -> list[dict[str, Any]]:
    return await get_activity_by_day(user["_id"], days)


@router.get("/progress/courses/{course_id}", response_model=CourseProgress)
async def course_progress(course_id: str, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    return await get_course_progress(user["_id"], course_id)


@router.post("/activities", status_code=201, response_model=ActivityRecorded)
async def record_event(payload: dict[str, Any], user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    """Record a learning activity event (contract: docs/API_CONTRACT.md).

    Idempotent event types (lesson_completed, challenge_passed, simulation_used,
    scenario_completed) deduplicate per resource so repeats cannot inflate totals.
    """
    event_id = await record_activity(user["_id"], payload)
    return {"id": event_id}


@router.get("/achievements")
async def achievements(user: dict[str, Any] = CurrentUser) -> list[dict[str, Any]]:
    """Full catalog with per-user unlocked state (frontend contract shape)."""
    return await achievements_service.list_achievements_for_user(user["_id"])


@router.get("/achievements/mine")
async def my_achievements(user: dict[str, Any] = CurrentUser) -> list[dict[str, Any]]:
    return await achievements_service.list_unlocked(user["_id"])
