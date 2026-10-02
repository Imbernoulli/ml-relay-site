"""Unit tests for the run-event overlay (python3 -m unittest discover -s auth/tests).

The overlay functions are pure; they are loaded from modal_app.py's source without
importing modal (no network, no Modal account needed)."""
import ast
import unittest
from pathlib import Path

SRC = (Path(__file__).resolve().parent.parent / "modal_app.py").read_text()
ns: dict = {}
for node in ast.parse(SRC).body:
    if (isinstance(node, ast.FunctionDef) and node.name in ("apply_run_events", "_recompute_current")) or (
            isinstance(node, ast.Assign) and any(getattr(t, "id", "") == "RUN_EVENTS" for t in node.targets)):
        exec(compile(ast.Module([node], []), "modal_app.py", "exec"), ns)
apply_run_events = ns["apply_run_events"]


def backend_record():
    """What the backend pushes: it knows the run was submitted and is building."""
    return {"issue": 9, "steps": [
        {"t": 100, "kind": "daytona", "label": "Daytona run gh-9-1 submitted", "state": "done", "key": "run:gh-9-1:submitted"},
        {"t": 100, "kind": "daytona", "label": "Environment building", "state": "running", "detail_public": "run gh-9-1",
         "key": "run:gh-9-1:env"},
        {"t": 110, "kind": "agent", "label": "Report posted", "state": "done", "key": None}],
        "current": {"t": 100, "label": "Environment building", "state": "running"}}


class RunEventOverlayTests(unittest.TestCase):
    def test_env_built_moves_the_backends_own_steps_no_duplicate(self):
        rec, pending = apply_run_events(backend_record(), {"gh-9-1": {"started": 120, "env_built": 900}})
        labels = [(s["label"], s["state"]) for s in rec["steps"]]
        self.assertEqual(labels, [("Daytona run gh-9-1 submitted", "done"), ("Environment building", "done"),
                                  ("Report posted", "done"), ("Sandbox started", "done")])
        self.assertEqual(pending, {"gh-9-1": {"started": 120, "env_built": 900}})

    def test_overlay_survives_the_backends_next_full_push(self):
        events = {"gh-9-1": {"started": 120, "env_built": 900}}
        first, events = apply_run_events(backend_record(), events)
        again, events = apply_run_events(backend_record(), events)   # backend pushed stale steps again
        self.assertEqual(first["steps"], again["steps"])
        self.assertEqual(sum(1 for s in again["steps"] if s["label"] == "Sandbox started"), 1)

    def test_finished_closes_running_settings_and_shows_collection(self):
        rec = backend_record()
        rec["steps"].append({"t": 950, "kind": "setting", "label": "Setting aime (seed 42)", "state": "running",
                             "key": "run:gh-9-1:setting:aime:42"})
        out, _ = apply_run_events(rec, {"gh-9-1": {"env_built": 900, "finished": 5000}})
        by = {s["key"]: s for s in out["steps"] if s.get("key")}
        self.assertEqual(by["run:gh-9-1:setting:aime:42"]["state"], "done")
        self.assertEqual((by["run:gh-9-1:results"]["label"], by["run:gh-9-1:results"]["state"]),
                         ("Run finished, collecting results", "running"))
        self.assertEqual(out["current"]["label"], "Run finished, collecting results")
        failed, _ = apply_run_events(rec, {"gh-9-1": {"env_built": 900, "failed": 5000}})
        self.assertEqual({s["key"]: s["state"] for s in failed["steps"] if s.get("key")}["run:gh-9-1:results"], "failed")

    def test_collected_run_is_dropped_and_left_alone(self):
        rec = backend_record()
        rec["steps"].append({"t": 6000, "kind": "daytona", "label": "Results collected", "state": "done",
                             "key": "run:gh-9-1:results"})
        out, pending = apply_run_events(rec, {"gh-9-1": {"finished": 5000}})
        self.assertEqual(pending, {})
        self.assertEqual(out["steps"], rec["steps"])

    def test_finished_without_env_built_invents_no_sandbox(self):
        out, _ = apply_run_events(backend_record(), {"gh-9-1": {"started": 120, "finished": 3300}})
        keys = {s.get("key"): s for s in out["steps"] if s.get("key")}
        self.assertNotIn("run:gh-9-1:sandbox", keys)
        self.assertEqual(keys["run:gh-9-1:env"]["state"], "running")     # the collection decides
        self.assertEqual(keys["run:gh-9-1:results"]["label"], "Run finished, collecting results")

    def test_started_only_does_not_invent_progress(self):
        out, _ = apply_run_events(backend_record(), {"gh-9-1": {"started": 120}})
        self.assertEqual(out["steps"], backend_record()["steps"])


if __name__ == "__main__":
    unittest.main()
