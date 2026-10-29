"""Coding challenges: practice runs (visible tests) and authoritative submission
(visible + hidden tests evaluated in the ChakraScript sandbox — never exec())."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser
from app.core.exceptions import NotFoundError
from app.core.security import utcnow
from app.db.mongo import get_db
from app.schemas.challenge import (
    ChallengeDetail,
    ChallengeSummary,
    CodeRequest,
    RunResponse,
    SubmissionOut,
    SubmitResponse,
)
from app.services.activity import record_activity
from app.services.evaluation import evaluate_challenge, hidden_tests_for

router = APIRouter(prefix="/challenges", tags=["challenges"])


async def _load(db, challenge_id: str) -> dict[str, Any]:
    ch = await db.challenges.find_one({"_id": challenge_id, "published": True})
    if ch is None:
        raise NotFoundError("Challenge not found.")
    return ch


def _detail(ch: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": ch["_id"], "title": ch["title"], "category": ch["category"], "difficulty": ch["difficulty"],
        "points": ch["points"], "objective": ch["objective"], "statement": ch["statement"],
        "inputSpec": ch["input_spec"], "outputSpec": ch["output_spec"], "examples": ch["examples"],
        "constraints": ch["constraints"], "starter": ch["starter"],
        "tests": [
            {"name": t["name"], "inputs": t["inputs"], "expectReturn": t.get("expectReturn"),
             "expectPins": {str(k): v for k, v in (t.get("expectPins") or {}).items()},
             "expectOutput": t.get("expectOutput"), "tolerance": t.get("tolerance")}
            for t in ch.get("tests", [])
        ],
        "hint": ch["hint"],
        "supportedLanguage": ch.get("supported_language", "chakrascript"),
    }


@router.get("", response_model=list[ChallengeSummary])
async def list_challenges(user: dict[str, Any] = CurrentUser) -> list[dict[str, Any]]:
    db = get_db()
    challenges = await db.challenges.find({"published": True}).sort("points", 1).to_list(100)
    return [
        {"id": c["_id"], "title": c["title"], "category": c["category"], "difficulty": c["difficulty"], "points": c["points"], "objective": c["objective"]}
        for c in challenges
    ]


@router.get("/submissions/mine", response_model=list[SubmissionOut])
async def my_submissions(user: dict[str, Any] = CurrentUser) -> list[dict[str, Any]]:
    db = get_db()
    subs = await db.coding_submissions.find({"user_id": user["_id"]}).sort("created_at", -1).limit(50).to_list(50)
    out = []
    for s in subs:
        ch = await db.challenges.find_one({"_id": s["challenge_id"]}, {"title": 1})
        out.append({
            "id": s["_id"], "challengeId": s["challenge_id"], "challengeTitle": (ch or {}).get("title", s["challenge_id"]),
            "passedTestCount": s["passed_test_count"], "totalTestCount": s["total_test_count"], "score": s["score"],
            "executionStatus": s["execution_status"],
            "createdAt": s["created_at"].isoformat() if isinstance(s.get("created_at"), datetime) else str(s["created_at"]),
            "submittedCode": s["submitted_code"],
        })
    return out


@router.get("/{challenge_id}", response_model=ChallengeDetail, response_model_exclude_none=True)
async def get_challenge(challenge_id: str, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    db = get_db()
    ch = await _load(db, challenge_id)
    return _detail(ch)


@router.post("/{challenge_id}/run", response_model=RunResponse)
async def run_challenge(challenge_id: str, body: CodeRequest, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    """Practice run against the visible tests only (mirrors the browser engine)."""
    db = get_db()
    ch = await _load(db, challenge_id)
    evaluation = evaluate_challenge(body.code, ch.get("tests", []), [])
    return {"results": evaluation["visibleResults"]}


@router.post("/{challenge_id}/submit", response_model=SubmitResponse)
async def submit_challenge(challenge_id: str, body: CodeRequest, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    """Authoritative grading: visible + hidden tests. Result persisted."""
    db = get_db()
    ch = await _load(db, challenge_id)
    evaluation = evaluate_challenge(body.code, ch.get("tests", []), hidden_tests_for(challenge_id))
    passed, total = evaluation["passed"], evaluation["total"]
    all_passed = total > 0 and passed == total
    score = round(ch["points"] * passed / total) if total else 0
    run_error = any("Execution failed" in r["detail"] or not r["name"] for r in evaluation["visibleResults"] + evaluation["hiddenResults"])
    await db.coding_submissions.insert_one({
        "_id": uuid.uuid4().hex,
        "user_id": user["_id"],
        "challenge_id": challenge_id,
        "submitted_code": body.code,
        "execution_status": "error" if run_error else "ok",
        "score": score if all_passed else score,
        "passed_test_count": passed,
        "total_test_count": total,
        "created_at": utcnow(),
    })
    if all_passed:
        await record_activity(user["_id"], {"type": "challenge_passed", "challengeId": challenge_id, "points": ch["points"]})
    return {"passed": passed, "total": total, "score": score if all_passed else score}
