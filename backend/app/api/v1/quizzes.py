"""Quizzes: retrieval without answers, server-side scoring, attempts, review.

The frontend submits to POST /api/v1/quizzes/{id}/submit (docs/API_CONTRACT.md);
the fuller attempt lifecycle (start/submit/review) is also provided. Scoring is
a faithful port of src/engines/quiz.ts, so server results match the browser's
practice score. Correct answers and explanations are only revealed in review.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, serialize
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationAppError
from app.core.security import utcnow
from app.db.mongo import get_db
from app.schemas.quiz import (
    AttemptSummary,
    PerQuestionResult,
    PublicQuestion,
    QuizDetail,
    QuizResultResponse,
    QuizReviewResponse,
    QuizSubmitRequest,
    QuizSummary,
    ReviewQuestion,
    TopicScore,
)
from app.services.activity import record_activity
from app.services.quiz_service import is_answered, is_correct, score_quiz

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


async def _load_quiz(db, quiz_id: str) -> dict[str, Any]:
    quiz = await db.quizzes.find_one({"_id": quiz_id, "published": True})
    if quiz is None:
        raise NotFoundError("Quiz not found.")
    questions = await db.quiz_questions.find({"quiz_id": quiz_id}).sort("order", 1).to_list(500)
    return {**quiz, "questions": questions}


def _quiz_detail(quiz: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": quiz["_id"],
        "title": quiz["title"],
        "category": quiz["category"],
        "description": quiz["description"],
        "difficulty": quiz["difficulty"],
        "timeLimitSec": quiz.get("time_limit_sec"),
        "questions": [
            {
                "id": q["_id"],
                "type": q["type"],
                "topic": q["topic"],
                "prompt": q["prompt"],
                "options": q.get("options"),
                "inputs": q.get("inputs"),
                "tolerance": q.get("tolerance"),
                "unit": q.get("unit"),
                "figure": q.get("figure"),
            }
            for q in quiz["questions"]
        ],
    }


@router.get("", response_model=list[QuizSummary])
async def list_quizzes(user: dict[str, Any] = CurrentUser) -> list[dict[str, Any]]:
    db = get_db()
    quizzes = await db.quizzes.find({"published": True}).sort("category", 1).to_list(100)
    out = []
    for q in quizzes:
        count = await db.quiz_questions.count_documents({"quiz_id": q["_id"]})
        out.append({
            "id": q["_id"], "title": q["title"], "category": q["category"], "description": q["description"],
            "difficulty": q["difficulty"], "timeLimitSec": q.get("time_limit_sec"), "questionCount": count,
        })
    return out


@router.get("/attempts/mine", response_model=list[AttemptSummary])
async def my_attempts(user: dict[str, Any] = CurrentUser) -> list[dict[str, Any]]:
    db = get_db()
    attempts = (
        await db.quiz_attempts.find({"user_id": user["_id"]}).sort("submitted_at", -1).limit(50).to_list(50)
    )
    out = []
    for a in attempts:
        quiz = await db.quizzes.find_one({"_id": a["quiz_id"]}, {"title": 1})
        out.append({
            "attemptId": a["_id"], "quizId": a["quiz_id"], "quizTitle": (quiz or {}).get("title", a["quiz_id"]),
            "score": a["score"], "accuracy": a["accuracy"], "total": a["total"],
            "submittedAt": a["submitted_at"].isoformat() if isinstance(a.get("submitted_at"), datetime) else str(a.get("submitted_at")),
            "started": a.get("status") == "submitted",
        })
    return out


@router.get("/attempts/{attempt_id}/review", response_model=QuizReviewResponse)
async def review_attempt(attempt_id: str, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    db = get_db()
    attempt = await db.quiz_attempts.find_one({"_id": attempt_id})
    if attempt is None:
        raise NotFoundError("Attempt not found.")
    if attempt["user_id"] != user["_id"]:
        raise ForbiddenError()
    quiz = await db.quizzes.find_one({"_id": attempt["quiz_id"]})
    questions = await db.quiz_questions.find({"quiz_id": attempt["quiz_id"]}).sort("order", 1).to_list(500)
    per_q = {p["id"]: p for p in attempt.get("per_question", [])}
    review_questions = []
    for q in questions:
        p = per_q.get(q["_id"], {"correct": False, "answered": False})
        review_questions.append({
            "id": q["_id"], "correct": p["correct"], "answered": p["answered"],
            "prompt": q["prompt"], "type": q["type"], "topic": q["topic"],
            "yourAnswer": (attempt.get("submitted_answers") or {}).get(q["_id"]),
            "correctAnswer": q.get("answer"), "explanation": q.get("explanation"),
            "options": q.get("options"),
        })
    return {
        "attemptId": attempt["_id"],
        "quizId": attempt["quiz_id"],
        "quizTitle": (quiz or {}).get("title", attempt["quiz_id"]),
        "score": attempt["score"],
        "accuracy": attempt["accuracy"],
        "timeTakenSec": attempt.get("duration_seconds", 0),
        "submitted": attempt.get("status") == "submitted",
        "questions": review_questions,
        "byTopic": attempt.get("by_topic", {}),
    }


@router.get("/{quiz_id}", response_model=QuizDetail, response_model_exclude_none=True)
async def get_quiz(quiz_id: str, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    db = get_db()
    quiz = await _load_quiz(db, quiz_id)
    return _quiz_detail(quiz)


@router.post("/{quiz_id}/attempts")
async def start_attempt(quiz_id: str, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    db = get_db()
    quiz = await _load_quiz(db, quiz_id)
    attempt_id = uuid.uuid4().hex
    await db.quiz_attempts.insert_one({
        "_id": attempt_id,
        "user_id": user["_id"],
        "quiz_id": quiz_id,
        "status": "started",
        "submitted_answers": None,
        "started_at": utcnow(),
        "submitted_at": None,
        "score": 0,
        "accuracy": 0,
        "total": len(quiz["questions"]),
        "duration_seconds": 0,
    })
    return {"attemptId": attempt_id, "startedAt": utcnow().isoformat(), "quiz": _quiz_detail(quiz)}


@router.post("/{quiz_id}/attempts/{attempt_id}/submit", response_model=QuizResultResponse)
async def submit_attempt(quiz_id: str, attempt_id: str, body: QuizSubmitRequest, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    db = get_db()
    attempt = await db.quiz_attempts.find_one({"_id": attempt_id})
    if attempt is None:
        raise NotFoundError("Attempt not found.")
    if attempt["user_id"] != user["_id"]:
        raise ForbiddenError()
    if attempt.get("status") == "submitted":
        raise ValidationAppError("This attempt was already submitted.", code="already_submitted")
    return await _score_and_store(db, quiz_id, attempt_id, body.answers, body.timeTakenSec, user["_id"])


@router.post("/{quiz_id}/submit", response_model=QuizResultResponse)
async def submit_quiz(quiz_id: str, body: QuizSubmitRequest, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    """Single-shot submission used by the frontend (docs/API_CONTRACT.md)."""
    db = get_db()
    attempt_id = uuid.uuid4().hex
    await db.quiz_attempts.insert_one({
        "_id": attempt_id,
        "user_id": user["_id"],
        "quiz_id": quiz_id,
        "status": "started",
        "submitted_answers": None,
        "started_at": utcnow(),
        "submitted_at": None,
        "score": 0,
        "accuracy": 0,
        "total": 0,
        "duration_seconds": 0,
    })
    return await _score_and_store(db, quiz_id, attempt_id, body.answers, body.timeTakenSec, user["_id"])


async def _score_and_store(
    db, quiz_id: str, attempt_id: str, answers: dict[str, Any], time_taken: int, user_id: str
) -> dict[str, Any]:
    quiz = await _load_quiz(db, quiz_id)
    questions = quiz["questions"]
    by_id = {q["_id"]: q for q in questions}
    unknown = [qid for qid in answers if qid not in by_id]
    if unknown:
        raise ValidationAppError("Submission contains unknown question ids.", details={"unknown": unknown[:10]})

    result = score_quiz(questions, answers, time_taken)
    now = utcnow()
    await db.quiz_attempts.update_one(
        {"_id": attempt_id},
        {
            "$set": {
                "status": "submitted",
                "submitted_answers": answers,
                "submitted_at": now,
                "score": result["score"],
                "maximum_score": result["total"] * 10,
                "accuracy": result["accuracy"],
                "by_topic": result["byTopic"],
                "per_question": result["perQuestion"],
                "duration_seconds": time_taken,
                "total": result["total"],
                "correct": result["correct"],
                "answered": result["answered"],
            }
        },
    )
    await record_activity(
        user_id,
        {
            "type": "quiz_attempt",
            "quizId": quiz_id,
            "score": result["score"],
            "accuracy": result["accuracy"],
            "byTopic": result["byTopic"],
            "timeTakenSec": time_taken,
        },
    )
    return {
        "attemptId": attempt_id,
        "score": result["score"],
        "total": result["total"],
        "correct": result["correct"],
        "answered": result["answered"],
        "accuracy": result["accuracy"],
        "byTopic": result["byTopic"],
        "perQuestion": result["perQuestion"],
        "timeTakenSec": time_taken,
    }
