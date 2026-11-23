#!/usr/bin/env python3
"""Cut after Herdr reports tab closure and compress watcher-marked idle time.

The watcher marks a stretch idle when nonempty normalized pane text has no
visible content changes for two seconds. Spinner-only and elapsed-timer-only changes
are intentionally normalized away, so agent thinking/waiting is compressed.
Visible content changes remain at normal speed. Herdr lifecycle state does not
classify idle time; worker-tab closure is used only to choose the final cut.
"""

from __future__ import annotations

import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path


if len(sys.argv) != 2:
    raise SystemExit("Pass the output directory as the only argument.")
OUTPUT = Path(sys.argv[1])
RAW = OUTPUT / "herdr-orchestration-demo-raw.mp4"
TIMING = OUTPUT / "timing.log"
FINAL = OUTPUT / "herdr-orchestration-demo.mp4"
GIF = OUTPUT / "herdr-orchestration-demo.gif"
REQUIRED = (
    "video_start",
    "root_busy",
    "worker_agent_created",
    "worker_done",
    "worker_tab_closed",
)
IDLE_EVENT = re.compile(r"^(idle_[0-9]{4})_(start|end)$")


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
        raise SystemExit("The timing log is missing one or more required lifecycle milestones.")
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
    # Herdr's worker-tab-closed lifecycle event determines the endpoint only;
    # compression intervals come exclusively from screen-stability events.
    cut_after = (events["worker_tab_closed"] - origin).total_seconds() + 12.0
    cut_duration = min(raw_duration, cut_after)
    if cut_duration <= 0:
        raise SystemExit("The worker-closure time does not align with the raw video.")

    intervals = idle_intervals(rows, origin, cut_duration)
    waiting_duration = sum(end - start for start, end in intervals)
    active_duration = max(0.0, cut_duration - waiting_duration)
    target_duration = 75.0 if active_duration <= 75.0 else 90.0
    speed = 1.0
    if waiting_duration > 0 and active_duration < target_duration:
        speed = max(1.0, waiting_duration / (target_duration - active_duration))

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
            "fps=15,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer",
            "-loop",
            "0",
            str(GIF),
        ]
    )
    final_duration = duration_of(FINAL)
    if not 55.0 <= final_duration <= 90.0:
        raise SystemExit(
            f"The available idle stretches produced a {final_duration:.1f}s result outside the target range."
        )
    print(
        f"Media complete: raw {raw_duration:.1f}s; kept {cut_duration:.1f}s; "
        f"final {final_duration:.1f}s; {len(intervals)} idle stretches at {speed:.2f}x."
    )


if __name__ == "__main__":
    main()
