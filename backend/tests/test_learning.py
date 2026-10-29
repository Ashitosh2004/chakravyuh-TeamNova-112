"""Learning journeys: published courses, lessons, completion persistence,
progress aggregation, achievements and search."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.usefixtures("seeded_app")


async def test_courses_are_seeded_and_public(client):
    resp = await client.get("/api/v1/courses")
    assert resp.status_code == 200
    courses = resp.json()
    assert len(courses) == 10
    ids = {c["id"] for c in courses}
    assert "digital-electronics" in ids and "embedded-systems" in ids
    digital = next(c for c in courses if c["id"] == "digital-electronics")
    assert digital["modules"], "course must include modules with lessons"
    lesson = digital["modules"][0]["lessons"][0]
    assert lesson["title"]


async def test_course_detail_and_lesson(client):
    course = (await client.get("/api/v1/courses/digital-electronics")).json()
    assert course["title"]
    lesson_id = course["modules"][0]["lessons"][0]["id"]
    lesson = (await client.get(f"/api/v1/lessons/{lesson_id}")).json()
    assert lesson["id"] == lesson_id
    assert lesson["sections"]
    unknown = await client.get("/api/v1/courses/does-not-exist")
    assert unknown.status_code == 404
    assert unknown.json()["code"] == "not_found"


async def test_lesson_completion_persists_and_is_idempotent(user):
    client, _ = user
    first = await client.post("/api/v1/lessons/logic-gates/complete")
    assert first.status_code == 200
    assert first.json()["status"] == "completed"

    # Repeat completion must not inflate anything.
    again = await client.post("/api/v1/lessons/logic-gates/complete")
    assert again.status_code == 200
    progress = (await client.get("/api/v1/progress")).json()
    assert progress["lessonsCompleted"] == ["digital-electronics/logic-gates"]

    activity = (await client.get("/api/v1/progress/activity?days=7")).json()
    today_counts = [a["count"] for a in activity]
    assert sum(today_counts) == 1, "duplicate completion must not create a second event"


async def test_lesson_complete_requires_auth(client):
    resp = await client.post("/api/v1/lessons/logic-gates/complete")
    assert resp.status_code == 401


async def test_activity_endpoint_and_progress(user):
    client, _ = user
    resp = await client.post(
        "/api/v1/activities",
        json={"type": "simulation_used", "simulationId": "logic-gates"},
    )
    assert resp.status_code == 201
    resp = await client.post(
        "/api/v1/activities",
        json={"type": "simulation_used", "simulationId": "circuit-builder"},
    )
    assert resp.status_code == 201
    repeat = await client.post(
        "/api/v1/activities",
        json={"type": "simulation_used", "simulationId": "logic-gates"},
    )
    assert repeat.status_code == 201  # accepted...
    progress = (await client.get("/api/v1/progress")).json()
    assert progress["simulationsUsed"] == 2, "...but deduplicated (logic-gates counted once)"


async def test_activity_validation_rejects_unknown_type(user):
    client, _ = user
    resp = await client.post("/api/v1/activities", json={"type": "made_up_event"})
    assert resp.status_code == 422


async def test_achievements_unlock_from_real_activity(user):
    client, _ = user
    await client.post("/api/v1/lessons/logic-gates/complete")
    achievements = (await client.get("/api/v1/achievements")).json()
    by_id = {a["id"]: a for a in achievements}
    assert by_id["first-lesson"]["unlocked"] is True
    assert by_id["dedicated"]["unlocked"] is False
    mine = (await client.get("/api/v1/achievements/mine")).json()
    assert any(a["id"] == "first-lesson" for a in mine)


async def test_course_progress(user):
    client, _ = user
    await client.post("/api/v1/lessons/logic-gates/complete")
    cp = (await client.get("/api/v1/progress/courses/digital-electronics")).json()
    assert cp["totalLessons"] >= 3
    assert cp["completedLessons"] == 1
    assert cp["percent"] == round((1 / cp["totalLessons"]) * 100)


async def test_search_returns_published_content(user):
    client, _ = user
    resp = await client.get("/api/v1/search", params={"q": "logic gate"})
    assert resp.status_code == 200
    items = resp.json()
    assert items, "expected curriculum hits for 'logic gate'"
    categories = {i["category"] for i in items}
    assert categories <= {"Course", "Lesson", "Simulation", "Challenge", "Quiz", "Scenario"}
    for item in items:
        assert item["href"].startswith("/")
    bad = await client.get("/api/v1/search", params={"q": "x" * 200})
    assert bad.status_code == 422


async def test_profile_update(user):
    client, u = user
    resp = await client.patch("/api/v1/users/me", json={"displayName": "Renamed", "level": "intermediate"})
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["displayName"] == "Renamed"
    assert updated["level"] == "intermediate"
    # Mass-assignment guard: role is not a client-settable field.
    evil = await client.patch("/api/v1/users/me", json={"displayName": "H", "role": "administrator", "email": "x@y.dev"})
    assert evil.status_code in (200, 422)
    me = (await client.get("/api/v1/auth/me")).json()["user"]
    assert me["email"] == u["email"], "email must not change via profile patch"
    from app.db.mongo import get_db

    doc = await get_db().users.find_one({"_id": u["id"]})
    assert doc["role"] == "student"
