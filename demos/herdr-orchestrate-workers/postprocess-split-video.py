#!/usr/bin/env python3
"""Trim after parent idle following worker removal and compress watcher-marked waits."""

from __future__ import annotations

import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path


if len(sys.argv) != 2:
    raise SystemExit("Pass the output directory as the only argument.")
OUTPUT = Path(sys.argv[1])
RAW = OUTPUT / "herdr-orchestration-demo-split-raw.mp4"
TIMING = OUTPUT / "timing-split.log"
FINAL = OUTPUT / "herdr-orchestration-demo-split.mp4"
GIF = OUTPUT / "herdr-orchestration-demo-split.gif"
REQUIRED = (
    "video_start",
    "worker_agent_created",
    "parent_idle_after_worker_removal",
)
WORKER_COMPLETION_EVENTS = ("worker_done", "worker_agent_removed", "worker_pane_closed")
WORKER_REMOVAL_EVENTS = ("worker_agent_removed", "worker_pane_closed")
IDLE_EVENT = re.compile(r"^(idle_[0-9]{4})_(start|end)$")
FINAL_TAIL_SECONDS = 3.0
TARGET_SECONDS = 38.0


def run(arguments: list[str]) -> str:
    result = subprocess.run(arguments, check=True, capture_output=True, text=True)
    return result.stdout.strip()


def read_timing() -> tuple[dict[str, datetime], list[tuple[str, datetime]]]:
    first_events: dict[str, datetime] = {}
    rows: list[tuple[str, datetime]] = []
    for source_row in TIMING.read_text(encoding="utf-8").splitlines():
        stamp, separator, event = source_row.partition("\t")
        if not separator:
            continue
        parsed = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        rows.append((event, parsed))
        first_events.setdefault(event, parsed)
    if "video_start" not in first_events:
        raise SystemExit(
            "The timing log is missing the video_start marker written immediately before VHS Show."
        )
    missing = [event for event in REQUIRED if event not in first_events]
    if missing:
        raise SystemExit(f"The timing log is missing required milestones: {', '.join(missing)}")
    if not any(event in first_events for event in WORKER_COMPLETION_EVENTS):
        raise SystemExit("The timing log has no worker completion or removal milestone.")
    removals = [first_events[event] for event in WORKER_REMOVAL_EVENTS if event in first_events]
    if not removals:
        raise SystemExit("The timing log has no worker removal milestone for the final cut.")
    if first_events["parent_idle_after_worker_removal"] <= min(removals):
        raise SystemExit("The parent idle milestone must follow worker agent or pane removal.")
    return first_events, rows


def idle_intervals(
    rows: list[tuple[str, datetime]], origin: datetime, duration: float
) -> list[tuple[float, float]]:
    starts: dict[str, datetime] = {}
    intervals: list[tuple[float, float]] = []
    for event, stamp in rows:
        match = IDLE_EVENT.match(event)
        if not match:
            continue
        key, edge = match.groups()
        if edge == "start":
            starts[key] = stamp
        elif key in starts:
            start = max(0.0, (starts[key] - origin).total_seconds())
            end = min(duration, (stamp - origin).total_seconds())
            if end - start >= 1.0:
                intervals.append((start, end))
    intervals.sort()
    merged: list[list[float]] = []
    for start, end in intervals:
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return [(start, end) for start, end in merged]


def filter_graph(duration: float, intervals: list[tuple[float, float]], speed: float) -> str:
    points = {0.0, duration}
    for start, end in intervals:
        points.update((start, end))
    ordered = sorted(points)
    chains: list[str] = []
    labels: list[str] = []
    for index, (start, end) in enumerate(zip(ordered, ordered[1:])):
        if end - start < 0.01:
            continue
        midpoint = (start + end) / 2
        waiting = any(left <= midpoint <= right for left, right in intervals)
        divisor = speed if waiting else 1.0
        label = f"v{index}"
        chains.append(
            f"[0:v]trim=start={start:.3f}:end={end:.3f},"
            f"setpts=(PTS-STARTPTS)/{divisor:.6f}[{label}]"
        )
        labels.append(f"[{label}]")
    if not labels:
        raise SystemExit("No video segments were available for post-processing.")
    chains.append(f"{''.join(labels)}concat=n={len(labels)}:v=1:a=0[outv]")
    return ";".join(chains)


def duration_of(path: Path) -> float:
    return float(
        run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ]
        )
    )


def main() -> None:
    if not RAW.is_file() or not TIMING.is_file():
        raise SystemExit("The raw video or timing log is missing.")
    events, rows = read_timing()
    raw_duration = duration_of(RAW)
    origin = events["video_start"]
    parent_idle_at = events["parent_idle_after_worker_removal"]
    cut_after = (parent_idle_at - origin).total_seconds() + FINAL_TAIL_SECONDS
    cut_duration = min(raw_duration, cut_after)
    if cut_duration <= 0:
        raise SystemExit("The parent idle time does not align with the raw video.")

    # Keep the final three seconds at normal speed after the parent becomes idle.
    compressible_duration = max(0.0, cut_duration - FINAL_TAIL_SECONDS)
    intervals = idle_intervals(rows, origin, compressible_duration)
    waiting_duration = sum(end - start for start, end in intervals)
    active_duration = max(0.0, cut_duration - waiting_duration)
    speed = 1.0
    if waiting_duration > 0 and active_duration < TARGET_SECONDS:
        speed = max(1.0, waiting_duration / (TARGET_SECONDS - active_duration))

    graph = filter_graph(cut_duration, intervals, speed)
    run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(RAW),
            "-filter_complex",
            graph,
            "-map",
            "[outv]",
            "-an",
            "-fps_mode",
            "vfr",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "22",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(FINAL),
        ]
    )
    run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(FINAL),
            "-vf",
            "fps=3,scale=2400:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=32:stats_mode=diff[p];[s1][p]paletteuse=dither=none:diff_mode=rectangle",
            "-loop",
            "0",
            str(GIF),
        ]
    )
    final_duration = duration_of(FINAL)
    if FINAL.stat().st_size >= 10_000_000:
        raise SystemExit("The final MP4 is not under 10,000,000 bytes.")
    gif_bytes = GIF.stat().st_size
    if gif_bytes > 3_000_000:
        raise SystemExit("The split GIF exceeds Zenn's 3 MB (3,000,000-byte) image limit.")
    print(
        f"Media complete: raw {raw_duration:.1f}s; cut {cut_duration:.1f}s after parent idle; "
        f"final {final_duration:.1f}s with no padding; {len(intervals)} spinner-only stretches at {speed:.2f}x; "
        f"GIF {gif_bytes} bytes at 2400 px, 3 fps, 32 colors, no dithering."
    )


if __name__ == "__main__":
    main()
