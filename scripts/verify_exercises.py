"""Verify every Coding Lab exercise with CPython.

Each file in src/content/python/exercises/ holds one or more exercises, split by
marker lines "# @@<exercise-id>:<starter|solution|tests>". For every exercise:
  * the reference solution must pass every test
  * the starter code must fail at least one test (so learners have something to do)

Run: npm run verify:python   (or: python scripts/verify_exercises.py)
"""

from __future__ import annotations

import contextlib
import io
import json
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PY_DIR = ROOT / "src" / "content" / "python"
sys.path.insert(0, str(PY_DIR))
os.environ["LAB_LLM_MODE"] = "mock"
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from labkit.testing import run_tests  # noqa: E402

MARKERS = ("starter", "solution", "tests")


def split_sections(text: str) -> dict[str, dict[str, str]]:
    """Same parsing rules as src/content/exercises.ts (parseExerciseFile)."""
    out: dict[str, dict[str, list[str]]] = {}
    current: list[str] | None = None
    for line in text.splitlines():
        if line.startswith("# @@"):
            ex_id, _, section = line[4:].strip().partition(":")
            current = out.setdefault(ex_id, {}).setdefault(section, [])
        elif current is not None:
            current.append(line)
    return {ex: {s: "\n".join(v).strip() + "\n" for s, v in secs.items()} for ex, secs in out.items()}


def run(code: str, tests: str) -> list[dict]:
    ns: dict = {"__name__": "__main__"}
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            exec(compile(code, "main.py", "exec"), ns)
            exec(compile(tests, "tests.py", "exec"), ns)
            return json.loads(run_tests(ns))
    except Exception as e:  # noqa: BLE001
        return [{"name": "<module>", "passed": False, "message": f"{type(e).__name__}: {e}"}]


def main() -> int:
    exercises: dict[str, dict[str, str]] = {}
    for f in sorted((PY_DIR / "exercises").glob("*.py")):
        exercises.update(split_sections(f.read_text(encoding="utf-8")))
    failures = 0
    for ex_id, parts in exercises.items():
        missing = [m for m in MARKERS if m not in parts]
        if missing:
            print(f"FAIL {ex_id}: missing sections {missing}")
            failures += 1
            continue
        sol = run(parts["solution"], parts["tests"])
        start = run(parts["starter"], parts["tests"])
        sol_ok = bool(sol) and all(r["passed"] for r in sol)
        starter_fails = any(not r["passed"] for r in start)
        status = "ok  " if sol_ok and starter_fails else "FAIL"
        print(f"{status} {ex_id:<28} solution {sum(r['passed'] for r in sol)}/{len(sol)}  starter fails: {starter_fails}")
        if not sol_ok:
            for r in sol:
                if not r["passed"]:
                    print(f"       - {r['name']}: {r['message']}")
        if not (sol_ok and starter_fails):
            failures += 1
    print(f"\n{len(exercises) - failures}/{len(exercises)} exercises verified")
    return 1 if failures or not exercises else 0


if __name__ == "__main__":
    sys.exit(main())
