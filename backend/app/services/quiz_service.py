"""Server-side quiz scoring — a faithful port of src/engines/quiz.ts so the
authoritative score equals the in-browser practice score for the same answers."""

from __future__ import annotations

from typing import Any

AnswerValue = Any  # int | bool | list[int | None] | None


def is_answered(question: dict[str, Any], answer: AnswerValue) -> bool:
    if answer is None:
        return False
    qtype = question["type"]
    if qtype == "truthtable":
        return (
            isinstance(answer, list)
            and len(answer) == len(question["answer"])
            and all(x in (0, 1, True, False) for x in answer)
        )
    if qtype == "numeric":
        return isinstance(answer, (int, float)) and not isinstance(answer, bool)
    return True


def is_correct(question: dict[str, Any], answer: AnswerValue) -> bool:
    if not is_answered(question, answer):
        return False
    qtype = question["type"]
    if qtype in ("mcq", "tf"):
        return answer == question["answer"]
    if qtype == "numeric":
        tol = question.get("tolerance")
        if tol is None:
            tol = max(1e-9, abs(float(question["answer"])) * 0.01)
        return abs(float(answer) - float(question["answer"])) <= tol
    if qtype == "truthtable":
        return all(v == want for v, want in zip(answer, question["answer"]))
    return False


def score_quiz(questions: list[dict[str, Any]], answers: dict[str, AnswerValue], time_taken_sec: int) -> dict[str, Any]:
    """questions are raw Mongo docs keyed by _id."""
    by_topic: dict[str, dict[str, int]] = {}
    per_question = []
    for q in questions:
        qid = q["_id"]
        answer = answers.get(qid)
        answered = is_answered(q, answer)
        correct = is_correct(q, answer)
        agg = by_topic.setdefault(q["topic"], {"correct": 0, "total": 0})
        agg["total"] += 1
        if correct:
            agg["correct"] += 1
        per_question.append({"id": qid, "correct": correct, "answered": answered})
    correct_count = sum(1 for p in per_question if p["correct"])
    total = len(questions)
    return {
        "total": total,
        "correct": correct_count,
        "answered": sum(1 for p in per_question if p["answered"]),
        "accuracy": round((correct_count / total) * 100) if total else 0,
        "score": correct_count * 10,
        "byTopic": by_topic,
        "perQuestion": per_question,
        "timeTakenSec": time_taken_sec,
    }
