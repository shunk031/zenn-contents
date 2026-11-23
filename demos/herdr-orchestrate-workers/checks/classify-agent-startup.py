#!/usr/bin/env python3
"""Classify an agent startup screen without printing its contents."""

from __future__ import annotations

import re
import sys


TEXT = sys.stdin.read().casefold()
RULES = (
    ("interactive-approval", r"\b(trust|approve|approval|confirm|allow)\b"),
    ("authentication", r"\b(sign in|login|unauthorized|authentication|credential)\b"),
    ("network", r"\b(connection|network|dns|timed out|refused|tls)\b"),
    ("configuration", r"\b(invalid config|unsupported|unknown model|not supported)\b"),
    ("startup-error", r"\b(error|failed|blocked|unavailable)\b"),
)

for category, expression in RULES:
    if re.search(expression, TEXT):
        print(category)
        break
else:
    print("unrecognized")
