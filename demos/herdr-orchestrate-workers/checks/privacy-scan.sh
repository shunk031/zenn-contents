#!/usr/bin/env bash
set -euo pipefail

image_tag="${1:?pass the image tag}"
kit_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"

python3 - "$kit_dir" "$image_tag" <<'PY'
from pathlib import Path
import json
import re
import subprocess
import sys

kit_dir = Path(sys.argv[1])
image_tag = sys.argv[2]
terms = ("gen" + "ai", "gate" + "way", "l" + "ycorp", "line" + "corp", "ya" + "hoo", "fla" + "va", "l" + "y")
short_name = re.compile(r"(?<![A-Za-z0-9_])" + re.escape(terms[6]) + r"(?![A-Za-z0-9_])", re.IGNORECASE)

def scan(label, text):
    for number, row in enumerate(text.splitlines(), 1):
        for term in terms:
            found = short_name.search(row) if term == terms[6] else re.search(re.escape(term), row, re.IGNORECASE)
            if found:
                print(f"{label}:{number} {term}")

for path in sorted(kit_dir.rglob("*")):
    if path.is_file():
        try:
            payload = path.read_bytes()
            if b"\0" not in payload:
                scan(str(path.relative_to(kit_dir)), payload.decode("utf-8", errors="replace"))
        except OSError:
            pass

history = subprocess.run(
    ["docker", "history", "--no-trunc", image_tag],
    check=True,
    capture_output=True,
    text=True,
).stdout
scan("docker history", history)

inspection = subprocess.run(
    ["docker", "inspect", image_tag],
    check=True,
    capture_output=True,
    text=True,
).stdout
scan("docker inspect", inspection)

filesystem_script = r'''
from pathlib import Path
import re

terms = ("gen" + "ai", "gate" + "way", "l" + "ycorp", "line" + "corp", "ya" + "hoo", "fla" + "va", "l" + "y")
short_name = re.compile(r"(?<![A-Za-z0-9_])" + re.escape(terms[6]) + r"(?![A-Za-z0-9_])", re.IGNORECASE)
roots = (Path("/home/demo"), Path("/demo"), Path("/opt/demo"), Path("/usr/local/bin/demo-credential"))

def report(path, payload):
    for number, row in enumerate(payload.decode("utf-8", errors="replace").splitlines(), 1):
        for term in terms:
            found = short_name.search(row) if term == terms[6] else re.search(re.escape(term), row, re.IGNORECASE)
            if found:
                print(f"{path}:{number} {term}")

for root in roots:
    paths = (root,) if root.is_file() else root.rglob("*")
    for path in paths:
        try:
            if not path.is_file() or path.stat().st_size > 8_000_000:
                continue
            payload = path.read_bytes()
            if b"\0" not in payload:
                report(path, payload)
        except OSError:
            continue
'''
filesystem = subprocess.run(
    ["docker", "run", "--rm", "--entrypoint", "python3", image_tag, "-c", filesystem_script],
    check=True,
    capture_output=True,
    text=True,
).stdout
for number, row in enumerate(filesystem.splitlines(), 1):
    print(row)
PY
