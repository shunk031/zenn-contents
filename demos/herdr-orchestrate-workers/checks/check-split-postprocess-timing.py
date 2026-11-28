#!/usr/bin/env python3
"""Dry-run the split postprocessor with optional report-detection events."""

from __future__ import annotations

import ast
import contextlib
import importlib.util
import io
import re
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch


KIT_DIR = Path(__file__).resolve().parents[1]
POSTPROCESS_PATH = KIT_DIR / "postprocess-split-video.py"
WATCHER_PATH = KIT_DIR / "timing-log-split.py"
MARKER_WRITER_PATH = KIT_DIR / "mark-timing.py"
RECORD_SCRIPT_PATH = KIT_DIR / "record-demo.sh"


def load_postprocessor(path: Path = POSTPROCESS_PATH, name: str = "postprocess_split"):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load split postprocessor")
    module = importlib.util.module_from_spec(spec)
    with patch.object(sys, "argv", [str(path), "/tmp"]):
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
    def test_recording_waits_for_watcher_before_postprocessing(self) -> None:
        record_script = RECORD_SCRIPT_PATH.read_text(encoding="utf-8")
        vhs_call = record_script.index('vhs "$tape"')
        watcher_wait = record_script.index('while [[ ! -s "$finished_marker" ]]')
        postprocess_call = record_script.index('python3 "$postprocessor" /out')
        self.assertLess(vhs_call, watcher_wait)
        self.assertLess(watcher_wait, postprocess_call)
        self.assertIn('kill -0 "$watcher_pid"', record_script)

        watcher = WATCHER_PATH.read_text(encoding="utf-8")
        final_wait_close = watcher.rindex('record(f"{active_wait}_end")')
        completion_marker = watcher.index('FINISHED_PATH.write_text(f"{finish_stamp}\\n"')
        self.assertLess(final_wait_close, completion_marker)
        self.assertIn('FINISHED_PATH.write_text("watcher_timeout\\n"', watcher)

    def test_marker_writer_records_utc_video_start(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            timing = Path(temporary) / "timing.log"
            for event in ("capture_started", "video_start"):
                subprocess.run(
                    [sys.executable, str(MARKER_WRITER_PATH), event, str(timing)],
                    check=True,
                    capture_output=True,
                    text=True,
                )
            rows = timing.read_text(encoding="utf-8").splitlines()
            self.assertEqual([row.partition("\t")[2] for row in rows], ["capture_started", "video_start"])
            for row in rows:
                stamp, _, _ = row.partition("\t")
                self.assertEqual(datetime.fromisoformat(stamp.replace("Z", "+00:00")).utcoffset().total_seconds(), 0)

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
                (1, "video_start"),
                (2, "worker_agent_created"),
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

    def test_both_postprocessors_require_video_start(self) -> None:
        root = datetime(2026, 1, 1, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as temporary:
            timing = Path(temporary) / "timing.log"
            timing.write_text(f"{root.isoformat().replace('+00:00', 'Z')}\tcapture_started\n", encoding="utf-8")
            for path, name in (
                (POSTPROCESS_PATH, "postprocess_split_missing_marker"),
                (KIT_DIR / "postprocess-video.py", "postprocess_default_missing_marker"),
            ):
                module = load_postprocessor(path, name)
                with patch.object(module, "TIMING", timing):
                    with self.assertRaisesRegex(SystemExit, "missing the video_start marker"):
                        module.read_timing()


if __name__ == "__main__":
    unittest.main()
