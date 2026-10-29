"""Coding challenges: deterministic evaluation, hidden tests, sandbox safety,
submission persistence — plus the interpreter gold-master cross-validation."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

pytestmark = pytest.mark.usefixtures("seeded_app")

XOR_SOLUTION = "int y = (a && !b) || (!a && b);\nreturn y;"


async def test_challenge_catalog_and_detail(user):
    client, _ = user
    challenges = (await client.get("/api/v1/challenges")).json()
    assert len(challenges) == 10
    detail = (await client.get("/api/v1/challenges/xor-gate")).json()
    assert detail["supportedLanguage"] == "chakrascript"
    assert detail["tests"], "visible practice tests must be present"
    assert "hidden" not in json.dumps(detail).lower()


async def test_run_uses_visible_tests_only(user):
    client, _ = user
    resp = await client.post("/api/v1/challenges/xor-gate/run", json={"code": "return 0;"})
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 4  # xor-gate has 4 visible tests
    assert all(r["detail"] for r in results)


async def test_submit_includes_hidden_tests(user):
    client, _ = user
    resp = await client.post("/api/v1/challenges/xor-gate/submit", json={"code": XOR_SOLUTION})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 8  # 4 visible + 4 hidden
    assert body["passed"] == 8
    assert body["score"] == 10

    submissions = (await client.get("/api/v1/challenges/submissions/mine")).json()
    assert len(submissions) == 1
    assert submissions[0]["passedTestCount"] == 8
    assert submissions[0]["submittedCode"] == XOR_SOLUTION


async def test_submit_wrong_code_scores_partial(user):
    client, _ = user
    resp = await client.post("/api/v1/challenges/xor-gate/submit", json={"code": "return 0;"})
    body = resp.json()
    # "return 0" is correct for a=b (2 visible) and the same 2 hidden combos.
    assert body["passed"] == 4
    assert body["passed"] < body["total"]


async def test_syntax_error_reported_per_test(user):
    client, _ = user
    resp = await client.post("/api/v1/challenges/xor-gate/run", json={"code": "int x = ;"})
    results = resp.json()["results"]
    assert all(not r["passed"] for r in results)
    assert "Unexpected" in results[0]["detail"], results[0]["detail"]


async def test_infinite_loop_hits_step_limit_not_hang(user):
    client, _ = user
    resp = await client.post("/api/v1/challenges/xor-gate/run", json={"code": "while (1) {}"})
    assert resp.status_code == 200  # evaluation error is a test failure, not a server error
    results = resp.json()["results"]
    assert all(not r["passed"] for r in results)
    assert "Step limit" in results[0]["detail"]


async def test_code_never_executed_by_host_python(seeded_app):
    """The sandbox must not be Python exec: a Python-only expression is a syntax error."""
    from app.services.chakrascript import run_script

    res = run_script("import os\nos.system('echo pwned')\nreturn 1;")
    assert res.ok is False
    res2 = run_script("__import__('os').getcwd()")
    assert res2.ok is False


async def test_code_length_limit(user):
    client, _ = user
    resp = await client.post("/api/v1/challenges/xor-gate/run", json={"code": "// " + "x" * 21_000})
    assert resp.status_code == 422  # schema cap (20k) rejects oversized submissions


# --------------------------------------------------------- gold master

def test_interpreter_matches_typescript_gold_master():
    """Every corpus case must reproduce the TS interpreter's output exactly."""
    here = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(here))
    from scripts.check_port import compare, corpus, gold  # noqa: E402  (path added at runtime)
    from app.services.chakrascript import run_script  # noqa: E402

    failures = []
    for case in corpus:
        result = run_script(case["src"], case.get("inputs", {}), case.get("maxSteps", 100_000))
        mine = {
            "ok": result.ok, "returnValue": result.returnValue, "output": result.output,
            "pins": {str(k): v for k, v in result.pins.items()}, "pinLog": result.pinLog,
            "error": result.error, "steps": result.steps,
        }
        diffs = compare(case["name"], mine, gold[case["name"]])
        if diffs:
            failures.append((case["name"], diffs))
    assert not failures, failures[:5]


def test_quiz_scoring_matches_frontend_engine(seeded_app):
    from app.services.quiz_service import score_quiz

    questions = [
        {"_id": "q1", "type": "mcq", "topic": "Logic", "prompt": "?", "options": ["a", "b"], "answer": 1, "explanation": ""},
        {"_id": "q2", "type": "tf", "topic": "Logic", "prompt": "?", "answer": True, "explanation": ""},
        {"_id": "q3", "type": "numeric", "topic": "Signals", "prompt": "?", "answer": 3.3, "tolerance": 0.01, "explanation": ""},
        {"_id": "q4", "type": "truthtable", "topic": "Logic", "prompt": "?", "inputs": ["A", "B"], "answer": [0, 1, 1, 1], "explanation": ""},
    ]
    answers = {"q1": 1, "q2": True, "q3": 3.305, "q4": [0, 1, 1, 1]}
    result = score_quiz(questions, answers, 10)
    assert result["score"] == 40 and result["accuracy"] == 100
    # numeric outside tolerance is wrong
    result2 = score_quiz(questions, {**answers, "q3": 3.5}, 10)
    assert result2["score"] == 30
    # unanswered truth table cell is wrong but "answered=False" when null
    result3 = score_quiz(questions, {**answers, "q4": [0, None, 1, 1]}, 10)
    assert result3["perQuestion"][3]["answered"] is False
