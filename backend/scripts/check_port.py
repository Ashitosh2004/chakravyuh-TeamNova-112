"""Cross-validate the Python ChakraScript port against the TypeScript gold master.

Run from backend/:  .venv/Scripts/python.exe scripts/check_port.py
"""

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.chakrascript import run_script

HERE = Path(__file__).parent
corpus = json.loads((HERE / "corpus.json").read_text(encoding="utf-8"))
gold = {g["name"]: g["result"] for g in json.loads((HERE / "gold.json").read_text(encoding="utf-8"))}


def close(a, b) -> bool:
    if a == b:
        return True
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isclose(float(a), float(b), rel_tol=1e-9, abs_tol=1e-9)
    return False


def compare(path, mine, want) -> list[str]:
    diffs = []
    if isinstance(want, dict):
        if not isinstance(mine, dict):
            return [f"{path}: expected object, got {type(mine).__name__}"]
        for key in sorted(set(want) | set(mine), key=str):
            if key not in mine:
                diffs.append(f"{path}.{key}: missing")
            elif key not in want:
                # JS `undefined` fields are dropped by JSON; None is equivalent.
                if mine[key] is not None:
                    diffs.append(f"{path}.{key}: extra ({mine[key]!r})")
            else:
                diffs.extend(compare(f"{path}.{key}", mine[key], want[key]))
        return diffs
    if isinstance(want, list):
        if not isinstance(mine, list) or len(mine) != len(want):
            return [f"{path}: list mismatch ({mine!r} vs {want!r})"]
        for i, (m, w) in enumerate(zip(mine, want)):
            diffs.extend(compare(f"{path}[{i}]", m, w))
        return diffs
    if not close(mine, want):
        diffs.append(f"{path}: got {mine!r}, want {want!r}")
    return diffs


failures = 0


def main() -> int:
    failures = 0
    for case in corpus:
        result = run_script(case["src"], case.get("inputs", {}), case.get("maxSteps", 100_000))
        mine = {
            "ok": result.ok,
            "returnValue": result.returnValue,
            "output": result.output,
            "pins": {str(k): v for k, v in result.pins.items()},
            "pinLog": result.pinLog,
            "error": result.error,
            "steps": result.steps,
        }
        diffs = compare(case["name"], mine, gold[case["name"]])
        if diffs:
            failures += 1
            print(f"FAIL {case['name']}")
            for d in diffs:
                print(f"   {d}")
        else:
            print(f"ok   {case['name']}")

    print(f"\n{len(corpus) - failures}/{len(corpus)} cases match the TypeScript interpreter exactly.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
