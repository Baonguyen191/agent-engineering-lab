"""Minimal test runner used by the Coding Lab and by scripts/verify_exercises.py."""

from __future__ import annotations

import json
import traceback


def run_tests(ns: dict) -> str:
    """Run every `test_*` function in `ns` in definition order. Returns a JSON list."""
    results = []
    for name, fn in list(ns.items()):
        if not (name.startswith("test_") and callable(fn)):
            continue
        doc = (fn.__doc__ or "").strip()
        try:
            fn()
            results.append({"name": name, "doc": doc, "passed": True, "message": ""})
        except AssertionError as e:
            results.append({"name": name, "doc": doc, "passed": False, "message": str(e) or "AssertionError"})
        except Exception as e:  # noqa: BLE001 - report any failure to the learner
            frames = traceback.extract_tb(e.__traceback__)
            where = f" (line {frames[-1].lineno})" if frames else ""
            results.append({"name": name, "doc": doc, "passed": False, "message": f"{type(e).__name__}: {e}{where}"})
    return json.dumps(results, ensure_ascii=False)
