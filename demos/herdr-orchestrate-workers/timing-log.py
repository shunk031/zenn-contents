#!/usr/bin/env python3
"""Log lifecycle timings and screen-stable intervals for video compression.

The hidden watcher intentionally treats agent thinking/waiting as idle when the
nonempty combined root and worker panes show no content change for two seconds after
ANSI escapes, spinner glyphs, and elapsed-time values are normalized. Thus a
screen that changes only by those indicators is compressed; visible content
changes keep the interval at normal speed. Structured Herdr state is separate:
it supplies lifecycle timestamps and the worker-tab-closed end-cut marker.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


ANSI = re.compile(r"\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))")
SPINNER = re.compile(r"[\u2800-\u28ff✢✣✤✥✦✧✩✪✫✬✭✮✯✰✳✴✵✶✷✸✹✺✻✼✽✾✿]")
ELAPSED = re.compile(r"\b\d+(?:\.\d+)?\s*(?:ms|s|min)\b", re.IGNORECASE)
POLL_SECONDS = 1.0
WATCH_SECONDS = 9 * 60
IDLE_SECONDS = 2.0


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def herdr(*args: str) -> str | None:
    try:
        result = subprocess.run(
            ["herdr", "--session", SESSION, *args],
            check=False,
            capture_output=True,
            text=True,
            timeout=4,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    return result.stdout if result.returncode == 0 else None


def json_call(*args: str) -> dict | list | None:
    output = herdr(*args)
    if output is None:
        return None
    try:
        return json.loads(output)
    except json.JSONDecodeError:
        return None


def result(value: dict | list | None) -> dict | list | None:
    if isinstance(value, dict):
        return value.get("result", value)
    return value


def agent_rows(value: dict | list | None) -> list[dict]:
    data = result(value)
    if isinstance(data, dict):
        rows = data.get("agents", [])
        if isinstance(rows, list):
            return [row for row in rows if isinstance(row, dict)]
    return []


def agent_object(value: dict | list | None) -> dict:
    data = result(value)
    if isinstance(data, dict):
        item = data.get("agent", data)
        return item if isinstance(item, dict) else {}
    return {}


def tab_rows(value: dict | list | None) -> list[dict] | None:
    data = result(value)
    if isinstance(data, dict):
        rows = data.get("tabs")
        if isinstance(rows, list):
            return [row for row in rows if isinstance(row, dict)]
    return None


def tab_identifier(row: dict) -> str:
    value = row.get("tab_id", row.get("id", ""))
    return str(value) if value is not None else ""


def status(row: dict) -> str:
    return str(row.get("agent_status", row.get("status", ""))).lower()


def record(event: str) -> str:
    stamp = utc_now()
    with LOG_PATH.open("a", encoding="utf-8") as stream:
        stream.write(f"{stamp}\t{event}\n")
        stream.flush()
    return stamp


def screen_text(pane_id: str) -> str:
    if not pane_id:
        return ""
    output = herdr("pane", "read", pane_id, "--source", "recent-unwrapped", "--lines", "500")
    if output is None:
        return ""
    value = ANSI.sub("", output)
    # Ignore only decorative progress and elapsed-time changes. Any other
    # visible change in either pane resets the idle timer below.
    value = SPINNER.sub("*", value)
    return ELAPSED.sub("<elapsed>", value)


if len(sys.argv) != 6:
    raise SystemExit(2)

SESSION, ROOT_NAME, ROOT_PANE = sys.argv[1:4]
LOG_PATH = Path(sys.argv[4])
FINISHED_PATH = Path(sys.argv[5])
recorded: set[str] = set()
worker: dict = {}
worker_pane = ""
worker_tab = ""
missing_tab_samples = 0
last_screen: str | None = None
screen_stable_since = time.monotonic()
wait_number = 0
active_wait = ""
deadline = time.monotonic() + WATCH_SECONDS

while time.monotonic() < deadline:
    tick_started = time.monotonic()
    rows = agent_rows(json_call("agent", "list"))
    root_from_list = next(
        (row for row in rows if row.get("name") == ROOT_NAME or row.get("pane_id") == ROOT_PANE),
        {},
    )
    root_from_get = agent_object(json_call("agent", "get", ROOT_NAME))
    root = root_from_get or root_from_list
    if "root_busy" not in recorded and status(root) == "working":
        record("root_busy")
        recorded.add("root_busy")

    if not worker:
        worker = next(
            (
                row
                for row in rows
                if row.get("name") != ROOT_NAME and row.get("pane_id") != ROOT_PANE
            ),
            {},
        )
        if worker:
            worker_pane = str(worker.get("pane_id", ""))
            worker_tab = str(worker.get("tab_id", ""))
            record("worker_agent_created")
            recorded.add("worker_agent_created")

    worker_target = str(worker.get("name") or worker_pane)
    worker_from_get = (
        agent_object(json_call("agent", "get", worker_target)) if worker_target else {}
    )
    current_worker = worker_from_get or worker
    worker_pane = str(current_worker.get("pane_id", worker_pane))
    worker_tab = str(current_worker.get("tab_id", worker_tab))
    worker = current_worker
    if "worker_done" not in recorded and worker and status(worker) == "done":
        record("worker_done")
        recorded.add("worker_done")

    tabs = tab_rows(json_call("tab", "list")) if worker_tab else None
    if worker_tab and tabs is not None:
        present = any(tab_identifier(row) == worker_tab for row in tabs)
        missing_tab_samples = 0 if present else missing_tab_samples + 1
        if missing_tab_samples >= 2 and "worker_tab_closed" not in recorded:
            stamp = record("worker_tab_closed")
            recorded.add("worker_tab_closed")
            FINISHED_PATH.write_text(f"{stamp}\n", encoding="utf-8")
            break

    screen = "\n".join(
        (screen_text(ROOT_PANE), screen_text(worker_pane) if worker_pane else "")
    ).strip()
    now = time.monotonic()
    if screen != last_screen:
        if active_wait:
            record(f"{active_wait}_end")
            active_wait = ""
        last_screen = screen
        screen_stable_since = now
    # A nonempty normalized screen stable for two seconds is intentionally idle. This
    # includes thinking/waiting screens whose only changes were a spinner or
    # elapsed timer; the separate Herdr tab state controls only the final cut.
    elif screen and not active_wait and now - screen_stable_since >= IDLE_SECONDS:
        wait_number += 1
        active_wait = f"idle_{wait_number:04d}"
        record(f"{active_wait}_start")

    remaining = POLL_SECONDS - (time.monotonic() - tick_started)
    if remaining > 0:
        time.sleep(remaining)

if active_wait:
    record(f"{active_wait}_end")
