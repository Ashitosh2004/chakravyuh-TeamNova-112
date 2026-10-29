"""Achievement catalog and computation — a port of src/stores/progress.ts
computeAchievements so server-side achievement state matches the browser's."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.db.mongo import get_db

ACHIEVEMENTS_CATALOG: list[dict[str, Any]] = [
    {"id": "first-lesson", "title": "First Lesson Completed", "description": "Complete any lesson.", "target": 1},
    {"id": "logic-explorer", "title": "Logic Gate Explorer", "description": "Use both the Logic Gate Lab and the Circuit Builder.", "target": 2},
    {"id": "quiz-starter", "title": "Quiz Starter", "description": "Submit your first quiz.", "target": 1},
    {"id": "quiz-ace", "title": "Sharp Scorer", "description": "Score 80% or higher on any quiz.", "target": 1},
    {"id": "coding-beginner", "title": "Coding Beginner", "description": "Pass your first coding challenge.", "target": 1},
    {"id": "lab-explorer", "title": "Virtual Lab Explorer", "description": "Use all five virtual lab simulations.", "target": 5},
    {"id": "embedded-learner", "title": "Embedded Systems Learner", "description": "Complete 3 Embedded Systems lessons.", "target": 3},
    {"id": "scenario-engineer", "title": "Systems Thinker", "description": "Complete 2 real-world scenarios.", "target": 2},
    {"id": "dedicated", "title": "Ten Lessons Strong", "description": "Complete 10 lessons.", "target": 10},
]


def compute_achievements(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    lessons = {e["resource_id"] for e in events if e["type"] == "lesson_completed"}
    sims = {e["resource_id"] for e in events if e["type"] == "simulation_used"}
    gate_sims = len({"simulation:logic-gates", "simulation:circuit-builder"} & sims)
    quizzes = sum(1 for e in events if e["type"] == "quiz_attempt")
    challenges = len({e["resource_id"] for e in events if e["type"] == "challenge_passed"})
    embedded = sum(1 for l in lessons if l.startswith("embedded-systems/"))
    scenarios = len({e["resource_id"] for e in events if e["type"] == "scenario_completed"})
    high_quiz = 1 if any(
        e["type"] == "quiz_attempt" and int(e.get("data", {}).get("accuracy", 0)) >= 80 for e in events
    ) else 0

    def mk(aid: str, progress: int) -> dict[str, Any]:
        cat = next(c for c in ACHIEVEMENTS_CATALOG if c["id"] == aid)
        return {
            "id": aid,
            "title": cat["title"],
            "description": cat["description"],
            "progress": min(progress, cat["target"]),
            "target": cat["target"],
            "unlocked": progress >= cat["target"],
        }

    return [
        mk("first-lesson", len(lessons)),
        mk("logic-explorer", gate_sims),
        mk("quiz-starter", quizzes),
        mk("quiz-ace", high_quiz),
        mk("coding-beginner", challenges),
        mk("lab-explorer", len(sims)),
        mk("embedded-learner", embedded),
        mk("scenario-engineer", scenarios),
        mk("dedicated", len(lessons)),
    ]


async def sync_user_achievements(user_id: str) -> None:
    """Materialize newly-unlocked achievements (idempotent; no duplicates)."""
    db = get_db()
    events = await db.activity_events.find({"user_id": user_id}).to_list(None)
    computed = compute_achievements(events)
    for ach in computed:
        if not ach["unlocked"]:
            continue
        await db.user_achievements.update_one(
            {"user_id": user_id, "achievement_id": ach["id"]},
            {"$setOnInsert": {"_id": uuid.uuid4().hex, "user_id": user_id, "achievement_id": ach["id"], "unlocked_at": datetime.now(timezone.utc)}},
            upsert=True,
        )


async def list_achievements_for_user(user_id: str) -> list[dict[str, Any]]:
    db = get_db()
    events = await db.activity_events.find({"user_id": user_id}).to_list(None)
    return compute_achievements(events)


async def list_unlocked(user_id: str) -> list[dict[str, Any]]:
    db = get_db()
    unlocked = await db.user_achievements.find({"user_id": user_id}).to_list(None)
    by_code = {c["id"]: c for c in ACHIEVEMENTS_CATALOG}
    out = []
    for u in unlocked:
        cat = by_code.get(u["achievement_id"])
        if not cat:
            continue
        out.append({
            "id": cat["id"],
            "title": cat["title"],
            "description": cat["description"],
            "unlockedAt": u["unlocked_at"].isoformat() if isinstance(u["unlocked_at"], datetime) else str(u["unlocked_at"]),
        })
    return out
