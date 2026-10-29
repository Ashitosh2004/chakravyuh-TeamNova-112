"""Quizzes: hidden answers, validation, server-side scoring, review, ownership."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.usefixtures("seeded_app")

QUIZ_ID = "communication-fundamentals"


async def _first_quiz(client) -> dict:
    quizzes = (await client.get("/api/v1/quizzes")).json()
    assert quizzes
    return quizzes[0]


async def test_quiz_list_and_detail_hide_answers(user):
    client, _ = user
    quizzes = (await client.get("/api/v1/quizzes")).json()
    assert len(quizzes) >= 3
    quiz = (await client.get(f"/api/v1/quizzes/{QUIZ_ID}")).json()
    assert quiz["questions"]
    for q in quiz["questions"]:
        assert "answer" not in q, "correct answer leaked before submission"
        assert "explanation" not in q, "explanation leaked before submission"


async def test_quiz_submit_rejects_unknown_question_ids(user):
    client, _ = user
    resp = await client.post(
        f"/api/v1/quizzes/{QUIZ_ID}/submit",
        json={"answers": {"nonexistent-question": 1}, "timeTakenSec": 10},
    )
    assert resp.status_code == 422


async def test_server_side_scoring_persists_attempt(user):
    client, _ = user
    quiz = (await client.get(f"/api/v1/quizzes/{QUIZ_ID}")).json()
    # Answer nothing: score 0, everything counted.
    resp = await client.post(f"/api/v1/quizzes/{QUIZ_ID}/submit", json={"answers": {}, "timeTakenSec": 33})
    assert resp.status_code == 200
    result = resp.json()
    assert result["total"] == len(quiz["questions"])
    assert result["score"] == 0
    assert result["accuracy"] == 0
    assert set(result["byTopic"].keys()) == {q["topic"] for q in quiz["questions"]}

    attempts = (await client.get("/api/v1/quizzes/attempts/mine")).json()
    assert len(attempts) == 1
    assert attempts[0]["score"] == 0

    # Scoring is computed on the server from stored answers.
    from app.db.mongo import get_db

    doc = await get_db().quiz_attempts.find_one({"_id": result["attemptId"]})
    assert doc is not None and doc["status"] == "submitted"


async def test_review_reveals_answers_and_explanations(user):
    client, _ = user
    result = (await client.post(f"/api/v1/quizzes/{QUIZ_ID}/submit", json={"answers": {}, "timeTakenSec": 5})).json()
    review = (await client.get(f"/api/v1/quizzes/attempts/{result['attemptId']}/review")).json()
    assert review["submitted"] is True
    assert review["questions"]
    for q in review["questions"]:
        assert "correctAnswer" in q
        assert q.get("explanation")


async def test_attempt_lifecycle_submit_twice_rejected(user):
    client, _ = user
    started = await client.post(f"/api/v1/quizzes/{QUIZ_ID}/attempts")
    assert started.status_code == 200
    attempt_id = started.json()["attemptId"]
    first = await client.post(
        f"/api/v1/quizzes/{QUIZ_ID}/attempts/{attempt_id}/submit",
        json={"answers": {}, "timeTakenSec": 5},
    )
    assert first.status_code == 200
    second = await client.post(
        f"/api/v1/quizzes/{QUIZ_ID}/attempts/{attempt_id}/submit",
        json={"answers": {}, "timeTakenSec": 5},
    )
    assert second.status_code == 422
    assert second.json()["code"] in ("already_submitted", "validation")


async def test_attempt_ownership(second_user, user):
    client_b, user_b = second_user
    # user_b cannot review an attempt belonging to user_a.
    client_a, _ = user
    result = (await client_a.post(f"/api/v1/quizzes/{QUIZ_ID}/submit", json={"answers": {}, "timeTakenSec": 5})).json()
    resp = await client_b.get(f"/api/v1/quizzes/attempts/{result['attemptId']}/review")
    assert resp.status_code == 403


async def test_correct_answers_score_full(user, seeded_app):
    client, _ = user
    from app.db.mongo import get_db

    questions = await get_db().quiz_questions.find({"quiz_id": QUIZ_ID}).sort("order", 1).to_list(None)
    perfect = {q["_id"]: q["answer"] for q in questions}
    # numeric / mcq / tf / truthtable answers all come through as native types
    result = (await client.post(f"/api/v1/quizzes/{QUIZ_ID}/submit", json={"answers": perfect, "timeTakenSec": 10})).json()
    assert result["score"] == result["total"] * 10
    assert result["accuracy"] == 100
