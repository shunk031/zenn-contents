#!/usr/bin/env python3
"""Add a hidden UTC marker to the demo timing log."""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path


if len(sys.argv) != 3 or sys.argv[1] != "capture_started":
    raise SystemExit(2)

stamp = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
with Path(sys.argv[2]).open("a", encoding="utf-8") as stream:
    stream.write(f"{stamp}\tcapture_started\n")
    stream.flush()
