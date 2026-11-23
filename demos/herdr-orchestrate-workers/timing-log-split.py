#!/usr/bin/env python3
"""Watch structured Herdr lifecycle state and log hidden recording timings."""

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
DONE_REPORT = re.compile(r"\bDONE(?:\s+([a-z][a-z0-9_-]{0,31}))?:", re.IGNORECASE)
ROOT_FINAL_FOOTER = re.compile(r"\b(?:Cooked|Worked) for\b.*\bdone\b", re.IGNORECASE)
POLL_SECONDS = 0.5
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


def pane_rows(value: dict | list | None) -> list[dict] | None:
    data = result(value)
    if isinstance(data, dict):
        rows = data.get("panes")
        if isinstance(rows, list):
            return [row for row in rows if isinstance(row, dict)]
    return None


def status(row: dict) -> str:
    return str(row.get("agent_status", row.get("status", ""))).lower()


def record(event: str) -> str:
    stamp = utc_now()
    with LOG_PATH.open("a", encoding="utf-8") as stream:
        stream.write(f"{stamp}\t{event}\n")
        stream.flush()
    return stamp


def screen_text(
    pane_id: str, source: str = "recent-unwrapped", *, normalize_activity: bool = True
) -> str:
    if not pane_id:
        return ""
    output = herdr("pane", "read", pane_id, "--source", source, "--lines", "500")
    if output is None:
        return ""
    value = ANSI.sub("", output)
    if normalize_activity:
        value = SPINNER.sub("*", value)
        value = ELAPSED.sub("<elapsed>", value)
    return value


if len(sys.argv) != 6:
    raise SystemExit(2)

SESSION, ROOT_NAME, ROOT_PANE = sys.argv[1:4]
LOG_PATH = Path(sys.argv[4])
FINISHED_PATH = Path(sys.argv[5])
recorded: set[str] = set()
worker: dict = {}
worker_pane = ""
worker_name = ""
worker_was_working = False
missing_pane_samples = 0
missing_agent_samples = 0
last_screen: str | None = None
last_spinner_frame: tuple[str, ...] = ()
spinner_changed_since_screen: bool = False
screen_stable_since = time.monotonic()
wait_number = 0
active_wait = ""
deadline = time.monotonic() + WATCH_SECONDS

while time.monotonic() < deadline:
    tick_started = time.monotonic()
    agents_snapshot = json_call("agent", "list")
    agents_data = result(agents_snapshot)
    agents_known = isinstance(agents_data, dict) and isinstance(agents_data.get("agents"), list)
    rows = agent_rows(agents_snapshot)
    root_from_list = next(
        (row for row in rows if row.get("name") == ROOT_NAME or row.get("pane_id") == ROOT_PANE),
        {},
    )
    root_from_get = agent_object(json_call("agent", "get", ROOT_NAME))
    root = root_from_get or root_from_list
    root_state = status(root)
    if "root_busy" not in recorded and root_state == "working":
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
            worker_name = str(worker.get("name", ""))
            record("worker_agent_created")
            recorded.add("worker_agent_created")

    worker_target = str(worker.get("name") or worker_pane)
    worker_from_list = next(
        (
            row
            for row in rows
            if row.get("name") == worker_name or row.get("pane_id") == worker_pane
        ),
        {},
    ) if worker else {}
    worker_present = bool(worker_from_list) if agents_known else None
    worker_from_get = (
        agent_object(json_call("agent", "get", worker_target))
        if worker_target and worker_present is not False
        else {}
    )
    current_worker = worker_from_get or worker_from_list
    if current_worker:
        worker_pane = str(current_worker.get("pane_id", worker_pane))
        worker_name = str(current_worker.get("name", worker_name))
        worker = current_worker

    worker_state = status(worker)
    if worker_state == "working":
        worker_was_working = True
    if "worker_done" not in recorded and worker and (
        worker_state == "done" or (worker_was_working and worker_state == "idle")
    ):
        record("worker_done")
        recorded.add("worker_done")

    if worker and worker_present is False:
        missing_agent_samples += 1
        if missing_agent_samples >= 1 and "worker_agent_removed" not in recorded:
            if "worker_done" not in recorded:
                record("worker_done")
                recorded.add("worker_done")
                record("worker_done_inferred_from_agent_removal")
            record("worker_agent_removed")
            recorded.add("worker_agent_removed")
    elif worker_present is not False:
        missing_agent_samples = 0

    panes = pane_rows(json_call("pane", "list")) if worker_pane else None
    pane_present = (
        any(row.get("pane_id") == worker_pane for row in panes)
        if panes is not None
        else None
    )
    if worker and pane_present is False:
        missing_pane_samples += 1
        if missing_pane_samples >= 1 and "worker_pane_closed" not in recorded:
            if "worker_done" not in recorded:
                record("worker_done")
                recorded.add("worker_done")
                record("worker_done_inferred_from_pane_close")
            record("worker_pane_closed")
            recorded.add("worker_pane_closed")
    else:
        missing_pane_samples = 0

    root_screen = screen_text(ROOT_PANE)
    root_visible = screen_text(ROOT_PANE, source="visible")
    worker_screen = screen_text(worker_pane) if worker_pane else ""
    root_activity = screen_text(ROOT_PANE, normalize_activity=False)
    worker_activity = screen_text(worker_pane, normalize_activity=False) if worker_pane else ""
    if (
        "parent_report_received" not in recorded
        and worker
        and worker_name
        and "worker_done" in recorded
        and any(
            match.group(1) is None or match.group(1) == worker_name
            for match in DONE_REPORT.finditer(root_visible)
        )
    ):
        record("parent_report_received")
        recorded.add("parent_report_received")

    root_finished = (
        root_state == "done"
        or (root_state == "idle" and ROOT_FINAL_FOOTER.search(root_screen))
    )
    if (
        "parent_report_received" in recorded
        and "worker_pane_closed" in recorded
        and root_finished
        and "parent_summary_complete" not in recorded
    ):
        finish_stamp = record("parent_summary_complete")
        recorded.add("parent_summary_complete")
        FINISHED_PATH.write_text(f"{finish_stamp}\n", encoding="utf-8")

    if (
        "worker_done" not in recorded
        and worker_was_working
        and DONE_REPORT.search(worker_screen)
    ):
        record("worker_done")
        recorded.add("worker_done")
    screen = "\n".join((root_screen, worker_screen)).strip()
    activity = "\n".join((root_activity, worker_activity)).strip()
    spinner_frame = tuple(SPINNER.findall(activity))
    now = time.monotonic()
    if screen != last_screen:
        if active_wait:
            record(f"{active_wait}_end")
            active_wait = ""
        last_screen = screen
        screen_stable_since = now
        spinner_changed_since_screen = False
    elif spinner_frame != last_spinner_frame:
        spinner_changed_since_screen = True
    if (
        screen
        and spinner_frame
        and spinner_changed_since_screen
        and not active_wait
        and now - screen_stable_since >= IDLE_SECONDS
    ):
        wait_number += 1
        active_wait = f"idle_{wait_number:04d}"
        record(f"{active_wait}_start")
    elif active_wait and not spinner_frame:
        record(f"{active_wait}_end")
        active_wait = ""
    last_spinner_frame = spinner_frame

    if "parent_summary_complete" in recorded:
        break

    remaining = POLL_SECONDS - (time.monotonic() - tick_started)
    if remaining > 0:
        time.sleep(remaining)

if active_wait:
    record(f"{active_wait}_end")
