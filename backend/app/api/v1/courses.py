"""Published curriculum: courses, modules and lessons.

Reads are public (the frontend bundles the same content for offline/development
mode); lesson completion requires authentication and persists to MongoDB.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentUser, serialize
from app.core.exceptions import NotFoundError, ValidationAppError
from app.core.security import utcnow
from app.db.mongo import get_db
from app.schemas.content import LessonCompleteResponse, LessonOut, CourseOut
from app.services.activity import record_activity

router = APIRouter(tags=["courses"])


def _assemble_course(course: dict[str, Any], modules: list[dict[str, Any]], lessons: list[dict[str, Any]]) -> dict[str, Any]:
    by_module: dict[str, list[dict[str, Any]]] = {}
    for lesson in lessons:
        by_module.setdefault(lesson["module_id"], []).append(serialize(lesson))
    return {
        "id": course["_id"],
        "title": course["title"],
        "short": course["short"],
        "overview": course["overview"],
        "difficulty": course["difficulty"],
        "hours": course["hours"],
        "objectives": course["objectives"],
        "prerequisites": course["prerequisites"],
        "activities": course.get("activities", []),
        "quizIds": course.get("quiz_ids", []),
        "modules": [
            {"id": m["_id"], "title": m["title"], "lessons": by_module.get(m["_id"], [])}
            for m in sorted(modules, key=lambda m: m.get("order", 0))
        ],
    }


@router.get("/courses", response_model=list[CourseOut], response_model_exclude_none=True)
async def list_courses(
    difficulty: str | None = None,
    search: str | None = Query(default=None, max_length=100),
) -> list[dict[str, Any]]:
    db = get_db()
    query: dict[str, Any] = {"published": True}
    if difficulty:
        query["difficulty"] = difficulty
    if search:
        rx = {"$regex": __import__("re").escape(search), "$options": "i"}
        query["$or"] = [{"title": rx}, {"short": rx}, {"overview": rx}]
    courses = await db.courses.find(query).sort("title", 1).to_list(100)
    if not courses:
        return []
    ids = [c["_id"] for c in courses]
    modules = await db.modules.find({"course_id": {"$in": ids}}).sort("order", 1).to_list(1000)
    lessons = await db.lessons.find({"course_id": {"$in": ids}}).sort("order", 1).to_list(2000)
    return [_assemble_course(c, [m for m in modules if m["course_id"] == c["_id"]], [l for l in lessons if l["course_id"] == c["_id"]]) for c in courses]


@router.get("/courses/{course_id}", response_model=CourseOut, response_model_exclude_none=True)
async def get_course(course_id: str) -> dict[str, Any]:
    db = get_db()
    course = await db.courses.find_one({"_id": course_id, "published": True})
    if course is None:
        raise NotFoundError("Course not found.")
    modules = await db.modules.find({"course_id": course_id}).sort("order", 1).to_list(100)
    lessons = await db.lessons.find({"course_id": course_id}).sort("order", 1).to_list(500)
    return _assemble_course(course, modules, lessons)


@router.get("/courses/{course_id}/modules")
async def list_modules(course_id: str) -> list[dict[str, Any]]:
    db = get_db()
    course = await db.courses.find_one({"_id": course_id, "published": True})
    if course is None:
        raise NotFoundError("Course not found.")
    modules = await db.modules.find({"course_id": course_id}).sort("order", 1).to_list(100)
    return [{"id": m["_id"], "courseId": m["course_id"], "title": m["title"], "order": m["order"], "lessonIds": m.get("lesson_ids", [])} for m in modules]


@router.get("/lessons/{lesson_id}")
async def get_lesson(lesson_id: str) -> dict[str, Any]:
    db = get_db()
    lesson = await db.lessons.find_one({"_id": lesson_id})
    if lesson is None:
        raise NotFoundError("Lesson not found.")
    return serialize(lesson)


@router.get("/lessons/{lesson_id}/related")
async def related_lessons(lesson_id: str) -> dict[str, Any]:
    db = get_db()
    lesson = await db.lessons.find_one({"_id": lesson_id})
    if lesson is None:
        raise NotFoundError("Lesson not found.")
    siblings = (
        await db.lessons.find({"course_id": lesson["course_id"], "_id": {"$ne": lesson_id}})
        .sort("order", 1)
        .to_list(100)
    )
    return {
        "courseId": lesson["course_id"],
        "lessons": [{"id": s["_id"], "title": s["title"], "summary": s["summary"], "minutes": s["minutes"]} for s in siblings],
    }


@router.post("/lessons/{lesson_id}/complete", response_model=LessonCompleteResponse)
async def complete_lesson(lesson_id: str, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    db = get_db()
    lesson = await db.lessons.find_one({"_id": lesson_id})
    if lesson is None:
        raise NotFoundError("Lesson not found.")
    await record_activity(user["_id"], {"type": "lesson_completed", "courseId": lesson["course_id"], "lessonId": lesson_id})
    now = utcnow()
    await db.lesson_progress.update_one(
        {"user_id": user["_id"], "lesson_id": lesson_id},
        {
            "$set": {"status": "completed", "completed_at": now, "updated_at": now},
            "$setOnInsert": {"user_id": user["_id"], "lesson_id": lesson_id, "course_id": lesson["course_id"]},
        },
        upsert=True,
    )
    stored = await db.lesson_progress.find_one({"user_id": user["_id"], "lesson_id": lesson_id})
    return {
        "lessonId": lesson_id,
        "courseId": lesson["course_id"],
        "status": stored["status"],
        "completedAt": stored["completed_at"].isoformat() if stored.get("completed_at") else None,
    }
