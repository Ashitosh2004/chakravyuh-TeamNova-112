"""Authoritative challenge evaluation.

Visible practice tests come from the seeded challenge documents (identical to the
frontend bundle). Hidden tests are defined here, never stored in client-facing
API responses and never sent to the browser — the server grades with the union
of both sets. Evaluation runs student code in the ChakraScript sandbox
(services/chakrascript.py) — the same deterministic interpreter the browser uses,
never exec(), never a shell.
"""

from __future__ import annotations

import math
from typing import Any

from app.services.chakrascript import run_script

# ---------------------------------------------------------------- hidden tests
# Each entry mirrors the challenge's visible test formulas with additional,
# deterministic cases so memorizing the practice tests is not enough.


def _bitcount(n: int) -> int:
    return bin(n).count("1")


HIDDEN_TESTS: dict[str, list[dict[str, Any]]] = {
    "xor-gate": [{"name": f"hidden a={a}, b={b}", "inputs": {"a": a, "b": b}, "expectReturn": a ^ b} for a in (0, 1) for b in (0, 1)],
    "binary-to-decimal": [
        {"name": f"hidden {b3}{b2}{b1}{b0}", "inputs": {"b3": b3, "b2": b2, "b1": b1, "b0": b0}, "expectReturn": b3 * 8 + b2 * 4 + b1 * 2 + b0}
        for b3, b2, b1, b0 in [(0, 1, 0, 1), (1, 1, 0, 0), (0, 0, 1, 1), (1, 0, 1, 0), (1, 1, 0, 1), (0, 1, 1, 1)]
    ],
    "count-ones": [
        {"name": f"hidden n={n}", "inputs": {"n": n}, "expectReturn": _bitcount(n)}
        for n in (1, 2, 3, 15, 31, 64, 100, 199, 254)
    ],
    "fan-threshold": [
        {"name": f"hidden temp={t}", "inputs": {"temp": t}, "expectPins": {"9": fan, "13": led}}
        for t, fan, led in [(0, 0, 0), (29.9, 0, 0), (31, 1, 0), (44.9, 1, 0), (50, 1, 1), (100, 1, 1)]
    ],
    "hysteresis": [
        {"name": f"hidden temp={t}, prev={p}", "inputs": {"temp": t, "prev": p}, "expectReturn": e}
        for t, p, e in [(17.5, 1, 1), (21.9, 0, 0), (22.5, 0, 0), (16, 0, 1), (25, 1, 0), (18.5, 1, 1)]
    ],
    "pwm-brightness": [
        {"name": f"hidden lux={l}", "inputs": {"lux": l}, "expectPins": {"5": d}}
        for l, d in [(0, 255), (99, 255), (200, 191), (300, 191), (500, 127), (600, 95), (700, 63), (799, 0)]
    ],
    "moving-average": [
        {"name": f"hidden {w},{x},{y},{z}", "inputs": {"x0": w, "x1": x, "x2": y, "x3": z}, "expectReturn": (w + x + y + z) / 4}
        for w, x, y, z in [(5, 5, 5, 5), (1, 2, 3, 4), (-4, 0, 4, 8), (10.5, 0.5, 0, 0.5)]
    ],
    "snr-db": [
        {"name": f"hidden S={s}, N={n}", "inputs": {"S": s, "N": n}, "expectReturn": 10 * math.log10(s / n), "tolerance": 0.01}
        for s, n in [(10, 1), (1000, 1), (4, 2), (0.25, 0.025), (2, 20)]
    ],
    "seven-segment-even": [
        {"name": f"hidden n={n}", "inputs": {"n": n}, "expectOutput": [str(n % 2 == 0 and 1 or 0)]}
        for n in (1, 2, 9, 14, 255, 1000)
    ],
    "gray-code": [
        {"name": f"hidden n={n}", "inputs": {"n": n}, "expectReturn": n ^ (n >> 1)}
        for n in (4, 5, 6, 15, 16, 100, 255)
    ],
}


def hidden_tests_for(challenge_id: str) -> list[dict[str, Any]]:
    return HIDDEN_TESTS.get(challenge_id, [])


# ---------------------------------------------------------------- evaluation
# Detail strings mirror src/engines/challenge.ts runTests() so feedback reads the same.


def _round(v: float):
    return int(v) if float(v).is_integer() else float(f"{v:.4f}")


def evaluate_test(code: str, tc: dict[str, Any]) -> dict[str, Any]:
    run = run_script(code, tc.get("inputs", {}))
    inputs_desc = ", ".join(f"{k}={v}" for k, v in tc.get("inputs", {}).items())
    if not run.ok:
        return {"name": tc["name"], "passed": False, "detail": f"With {inputs_desc or 'no inputs'}: {run.error}."}
    problems: list[str] = []
    if tc.get("expectReturn") is not None:
        tol = tc.get("tolerance", 1e-6)
        if run.returnValue is None:
            problems.append(f"expected return {tc['expectReturn']}, but nothing was returned")
        elif abs(float(run.returnValue) - float(tc["expectReturn"])) > tol:
            problems.append(f"expected return {tc['expectReturn']}, got {_round(run.returnValue)}")
    for pin, want in (tc.get("expectPins") or {}).items():
        got = run.pins.get(int(pin))
        if got != want:
            problems.append(f"expected pin {pin} = {want}, got {'not written' if got is None else got}")
    if tc.get("expectOutput") is not None:
        exp = "\n".join(tc["expectOutput"])
        got = "\n".join(run.output)
        if exp != got:
            problems.append(f'expected output "{exp}", got "{got or "(nothing)"}"')
    return {
        "name": tc["name"],
        "passed": not problems,
        "detail": f"With {inputs_desc or 'no inputs'}: {'correct.' if not problems else '; '.join(problems) + '.'}",
    }


def evaluate_challenge(code: str, visible_tests: list[dict[str, Any]], hidden_tests: list[dict[str, Any]]) -> dict[str, Any]:
    """Run all tests; returns per-test outcomes for visible tests plus the aggregated result."""
    visible_results = [evaluate_test(code, tc) for tc in visible_tests]
    hidden_results = [evaluate_test(code, tc) for tc in hidden_tests]
    total = len(visible_results) + len(hidden_results)
    passed = sum(1 for r in visible_results + hidden_results if r["passed"])
    return {"visibleResults": visible_results, "hiddenResults": hidden_results, "passed": passed, "total": total}
