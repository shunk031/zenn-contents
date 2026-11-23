#!/usr/bin/env python3
"""Dry-run the split postprocessor with optional report-detection events."""

from __future__ import annotations

import ast
import contextlib
import importlib.util
import io
import re
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch


KIT_DIR = Path(__file__).resolve().parents[1]
POSTPROCESS_PATH = KIT_DIR / "postprocess-split-video.py"
WATCHER_PATH = KIT_DIR / "timing-log-split.py"


def load_postprocessor():
    spec = importlib.util.spec_from_file_location("postprocess_split", POSTPROCESS_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load split postprocessor")
    module = importlib.util.module_from_spec(spec)
    with patch.object(sys, "argv", [str(POSTPROCESS_PATH), "/tmp"]):
        spec.loader.exec_module(module)
    return module


def report_pattern() -> re.Pattern[str]:
    tree = ast.parse(WATCHER_PATH.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "DONE_REPORT"
            for target in node.targets
        ):
            call = node.value
            if isinstance(call, ast.Call) and call.args:
                return re.compile(ast.literal_eval(call.args[0]), re.IGNORECASE)
    raise AssertionError("The watcher has no DONE_REPORT pattern")


class SplitPostprocessTimingTest(unittest.TestCase):
    def run_fixture(self, include_bare_done: bool) -> None:
        postprocessor = load_postprocessor()
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            raw = output / "raw.mp4"
            raw.write_bytes(b"raw fixture")
            final = output / "final.mp4"
            gif = output / "final.gif"
            timing = output / "timing.log"

            origin = datetime(2026, 1, 1, tzinfo=timezone.utc)
            events = [
                (0, "capture_started"),
                (1, "worker_agent_created"),
            ]
            if include_bare_done:
                self.assertIsNotNone(report_pattern().search("DONE"))
                events.append((12, "worker_done"))
                events.append((14, "parent_report_received"))
            events.extend(
                [
                    (15, "worker_agent_removed"),
                    (16, "parent_idle_after_worker_removal"),
                ]
            )
            timing.write_text(
                "".join(
                    f"{(origin + timedelta(seconds=offset)).isoformat().replace('+00:00', 'Z')}\t{event}\n"
                    for offset, event in events
                ),
                encoding="utf-8",
            )

            def fake_run(arguments: list[str]) -> str:
                Path(arguments[-1]).write_bytes(b"dry-run output")
                return ""

            def fake_duration(path: Path) -> float:
                return 90.0 if path == raw else 18.0

            with (
                patch.object(postprocessor, "OUTPUT", output),
                patch.object(postprocessor, "RAW", raw),
                patch.object(postprocessor, "TIMING", timing),
                patch.object(postprocessor, "FINAL", final),
                patch.object(postprocessor, "GIF", gif),
                patch.object(postprocessor, "run", fake_run),
                patch.object(postprocessor, "duration_of", fake_duration),
                contextlib.redirect_stdout(io.StringIO()),
            ):
                postprocessor.main()

            self.assertTrue(final.is_file())
            self.assertTrue(gif.is_file())

    def test_postprocess_without_report_detection(self) -> None:
        self.run_fixture(include_bare_done=False)

    def test_postprocess_with_bare_done_detection(self) -> None:
        self.run_fixture(include_bare_done=True)


if __name__ == "__main__":
    unittest.main()
