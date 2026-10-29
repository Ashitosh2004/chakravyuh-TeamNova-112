"""Controlled database initialization: indexes + published curriculum content.

Idempotent: safe to run on every launch. Upserts content documents by id and
never touches user data (users, attempts, progress, conversations are untouched).

Usage (from backend/):
    .venv/Scripts/python.exe -m app.seed                # initialize / refresh content
    .venv/Scripts/python.exe -m app.seed --check        # verify connectivity + counts only
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings
from app.core.logging import configure_logging
from app.db import indexes as db_indexes
from app.db.mongo import connect, get_db, ping

SEED_DIR = Path(__file__).resolve().parents[1] / "seed_data"


def _load(name: str):
    path = SEED_DIR / name
    if not path.exists():
        print(f"Missing seed file: {path}")
        sys.exit(1)
    return json.loads(path.read_text(encoding="utf-8"))


def _now():
    return datetime.now(timezone.utc)


async def seed() -> None:
    db = get_db()

    # ---- courses / modules / lessons
    courses = _load("courses.json")
    for course in courses:
        module_ids = [m["id"] for m in course["modules"]]
        await db.courses.update_one(
            {"_id": course["id"]},
            {"$set": {
                "title": course["title"], "short": course["short"], "overview": course["overview"],
                "difficulty": course["difficulty"], "hours": course["hours"], "objectives": course["objectives"],
                "prerequisites": course["prerequisites"], "activities": course.get("activities", []),
                "quiz_ids": course.get("quizIds", []), "module_ids": module_ids, "published": True,
            }, "$setOnInsert": {"created_at": _now()}},
            upsert=True,
        )
        for order, module in enumerate(course["modules"]):
            await db.modules.update_one(
                {"_id": module["id"]},
                {"$set": {"course_id": course["id"], "title": module["title"], "order": order,
                          "lesson_ids": [l["id"] for l in module["lessons"]]}},
                upsert=True,
            )
            for lorder, lesson in enumerate(module["lessons"]):
                await db.lessons.update_one(
                    {"_id": lesson["id"]},
                    {"$set": {
                        "course_id": course["id"], "module_id": module["id"], "order": lorder,
                        "title": lesson["title"], "minutes": lesson["minutes"], "summary": lesson["summary"],
                        "sections": lesson["sections"], "terms": lesson["terms"],
                        "equations": lesson.get("equations"), "steps": lesson.get("steps"),
                        "example": lesson.get("example"), "takeaways": lesson["takeaways"],
                        "check": lesson["check"], "simulations": lesson.get("simulations"),
                        "diagram": lesson.get("diagram"), "published": True,
                    }},
                    upsert=True,
                )

    # ---- challenges (visible practice tests; hidden tests live in services/evaluation.py)
    for ch in _load("challenges.json"):
        await db.challenges.update_one(
            {"_id": ch["id"]},
            {"$set": {
                "title": ch["title"], "category": ch["category"], "difficulty": ch["difficulty"],
                "points": ch["points"], "objective": ch["objective"], "statement": ch["statement"],
                "input_spec": ch["inputSpec"], "output_spec": ch["outputSpec"], "examples": ch["examples"],
                "constraints": ch["constraints"], "starter": ch["starter"], "tests": ch["tests"],
                "hint": ch["hint"], "supported_language": "chakrascript", "published": True,
            }},
            upsert=True,
        )

    # ---- quizzes + questions (answers stored server-side only)
    for quiz in _load("quizzes.json"):
        await db.quizzes.update_one(
            {"_id": quiz["id"]},
            {"$set": {
                "title": quiz["title"], "category": quiz["category"], "description": quiz["description"],
                "difficulty": quiz["difficulty"], "time_limit_sec": quiz.get("timeLimitSec"),
                "question_ids": [q["id"] for q in quiz["questions"]], "published": True,
            }},
            upsert=True,
        )
        for order, q in enumerate(quiz["questions"]):
            await db.quiz_questions.update_one(
                {"_id": q["id"]},
                {"$set": {
                    "quiz_id": quiz["id"], "order": order, "type": q["type"], "topic": q["topic"],
                    "prompt": q["prompt"], "options": q.get("options"), "inputs": q.get("inputs"),
                    "answer": q["answer"], "tolerance": q.get("tolerance"), "unit": q.get("unit"),
                    "explanation": q["explanation"], "figure": q.get("figure"),
                }},
                upsert=True,
            )

    # ---- simulations / scenarios
    for sim in _load("simulations.json"):
        await db.simulations.update_one(
            {"_id": sim["id"]},
            {"$set": {"title": sim["title"], "description": sim["description"], "difficulty": sim["difficulty"], "lessons": sim.get("lessons", []), "published": True}},
            upsert=True,
        )
    for sc in _load("scenarios.json"):
        await db.scenarios.update_one(
            {"_id": sc["id"]},
            {"$set": {"title": sc["title"], "problem": sc["problem"], "objectives": sc["objectives"], "difficulty": sc["difficulty"], "published": True}},
            upsert=True,
        )

    # ---- achievement catalog
    from app.services.achievements import ACHIEVEMENTS_CATALOG

    for a in ACHIEVEMENTS_CATALOG:
        await db.achievements.update_one(
            {"code": a["id"]},
            {"$set": {"title": a["title"], "description": a["description"], "criteria": {"target": a["target"]}, "icon": a["id"], "published": True}},
            upsert=True,
        )

    # ---- search index (mirrors src/content/search.ts)
    search_items = []
    for course in courses:
        search_items.append({"_id": f"course:{course['id']}", "category": "Course", "title": course["title"], "description": course["short"], "difficulty": course["difficulty"], "href": f"/learn/{course['id']}", "keywords": course["overview"]})
        for module in course["modules"]:
            for lesson in module["lessons"]:
                search_items.append({
                    "_id": f"lesson:{course['id']}/{lesson['id']}", "category": "Lesson", "title": lesson["title"],
                    "description": f"{course['title']} · {lesson['summary']}", "difficulty": course["difficulty"],
                    "href": f"/learn/{course['id']}/lesson/{lesson['id']}",
                    "keywords": " ".join([lesson["summary"], *[f"{t[0]} {t[1]}" for t in lesson["terms"]], *[s["heading"] for s in lesson["sections"]]]),
                })
    for sim in _load("simulations.json"):
        search_items.append({"_id": f"simulation:{sim['id']}", "category": "Simulation", "title": sim["title"], "description": sim["description"], "difficulty": sim["difficulty"], "href": f"/lab/{sim['id']}", "keywords": sim["description"]})
    for ch in _load("challenges.json"):
        search_items.append({"_id": f"challenge:{ch['id']}", "category": "Challenge", "title": ch["title"], "description": f"{ch['category']} · {ch['objective']}", "difficulty": ch["difficulty"], "href": f"/coding/{ch['id']}", "keywords": ch["statement"]})
    for quiz in _load("quizzes.json"):
        search_items.append({"_id": f"quiz:{quiz['id']}", "category": "Quiz", "title": quiz["title"], "description": quiz["description"], "difficulty": quiz["difficulty"], "href": f"/quizzes/{quiz['id']}", "keywords": quiz["category"]})
    for game in _load("games.json"):
        search_items.append({"_id": f"game:{game['id']}", "category": "Quiz", "title": game["title"], "description": game["description"], "difficulty": None, "href": f"/quizzes/{game['id']}", "keywords": "game mini-game"})
    for sc in _load("scenarios.json"):
        search_items.append({"_id": f"scenario:{sc['id']}", "category": "Scenario", "title": sc["title"], "description": sc["problem"], "difficulty": sc["difficulty"], "href": f"/scenarios/{sc['id']}", "keywords": " ".join(sc["objectives"])})
    for item in search_items:
        await db.search_items.update_one({"_id": item["_id"]}, {"$set": {k: v for k, v in item.items() if k != "_id"}}, upsert=True)

    print(f"Seeded: {len(courses)} courses, {sum(len(c['modules']) for c in courses)} modules, "
          f"{sum(len(m['lessons']) for c in courses for m in c['modules'])} lessons, "
          f"{len(_load('challenges.json'))} challenges, {len(_load('quizzes.json'))} quizzes, "
          f"{len(_load('simulations.json'))} simulations, {len(_load('scenarios.json'))} scenarios, "
          f"{len(search_items)} search items.")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Initialize CHAKRAVYUH database (idempotent).")
    parser.add_argument("--check", action="store_true", help="Verify connectivity and content counts only.")
    args = parser.parse_args()

    configure_logging()
    connect()
    if not await ping():
        print(f"ERROR: MongoDB is not reachable at the configured URI (db '{settings.MONGODB_DB}').")
        print("Start the local MongoDB service (e.g. `net start MongoDB`) or fix MONGODB_URI in backend/.env.")
        sys.exit(1)
    await db_indexes.create_indexes()
    if args.check:
        print("MongoDB connection OK, indexes present.")
        return
    await seed()


if __name__ == "__main__":
    asyncio.run(main())
