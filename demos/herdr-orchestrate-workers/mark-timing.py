#!/usr/bin/env python3
"""Add a hidden UTC marker to the demo timing log."""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path


if len(sys.argv) != 3 or sys.argv[1] not in {"capture_started", "video_start"}:
    raise SystemExit("Event must be capture_started or video_start.")

stamp = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
with Path(sys.argv[2]).open("a", encoding="utf-8") as stream:
    stream.write(f"{stamp}\t{sys.argv[1]}\n")
    stream.flush()
