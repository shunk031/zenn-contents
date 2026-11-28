#!/usr/bin/env python3
"""Fail when a VHS Wait regex can match any literal Type string."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


TAPE_DIR = Path(__file__).resolve().parents[1]
TAPES = (TAPE_DIR / "demo.tape", TAPE_DIR / "demo-split.tape")
WAIT_REQUIRED_TAPES = (TAPE_DIR / "demo.tape",)
TYPE_COMMAND = re.compile(r'^\s*Type\s+("(?:\\.|[^"\\])*")\s*$')
WAIT_PREFIX = re.compile(r"^\s*Wait(?:\+Screen)?@\d+s\s+(/.*)\s*$")


def wait_pattern(source_row: str, row_number: int) -> str:
    """Read a slash-delimited pattern, honoring escaped slash delimiters."""
    match = WAIT_PREFIX.match(source_row)
    if not match:
        raise ValueError(f"Wait command at row {row_number} has no supported regex")
    literal = match.group(1)
    if not literal.startswith("/"):
        raise ValueError(f"Wait command at row {row_number} is not slash-delimited")

    escaped = False
    closing = None
    for index in range(1, len(literal)):
        char = literal[index]
        if char == "/" and not escaped:
            closing = index
        if char == "\\" and not escaped:
            escaped = True
        else:
            escaped = False
    if closing is None or literal[closing + 1 :].strip():
        raise ValueError(f"Wait regex at row {row_number} is not closed")
    return literal[1:closing].replace(r"\/", "/")


def main() -> int:
    summaries: list[str] = []
    for tape in TAPES:
        type_strings: list[tuple[int, str]] = []
        wait_patterns: list[tuple[int, re.Pattern[str]]] = []

        for row_number, source_row in enumerate(tape.read_text(encoding="utf-8").splitlines(), 1):
            stripped = source_row.lstrip()
            if stripped.startswith("Type "):
                match = TYPE_COMMAND.match(source_row)
                if not match:
                    print(f"{tape.name}: Type row {row_number} is not a quoted string", file=sys.stderr)
                    return 2
                type_strings.append((row_number, json.loads(match.group(1))))
            elif stripped.startswith("Wait"):
                try:
                    pattern = wait_pattern(source_row, row_number)
                    wait_patterns.append((row_number, re.compile(pattern)))
                except (ValueError, re.error) as error:
                    print(f"{tape.name}: invalid Wait regex at row {row_number}: {error}", file=sys.stderr)
                    return 2

        if not type_strings:
            print(f"{tape.name}: no Type strings found", file=sys.stderr)
            return 2
        if tape in WAIT_REQUIRED_TAPES and not wait_patterns:
            print(f"{tape.name}: no Wait regexes found", file=sys.stderr)
            return 2

        overlaps: list[tuple[int, int]] = []
        for wait_row, pattern in wait_patterns:
            for type_row, text in type_strings:
                if pattern.search(text):
                    overlaps.append((wait_row, type_row))

        if overlaps:
            for wait_row, type_row in overlaps:
                print(f"{tape.name}: Wait row {wait_row} matches Type row {type_row}", file=sys.stderr)
            return 1
        summaries.append(f"{tape.name}: {len(type_strings)} Type strings, {len(wait_patterns)} Wait regexes")

    print("validated " + "; ".join(summaries) + "; no overlaps")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
