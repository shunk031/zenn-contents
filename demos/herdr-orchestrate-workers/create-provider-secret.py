#!/usr/bin/env python3
"""Create the private runtime provider definition from the active host config."""

from __future__ import annotations

import json
import math
import os
from pathlib import Path
import re
import tomllib


def toml_key(value: str) -> str:
    if re.fullmatch(r"[A-Za-z0-9_-]+", value):
        return value
    return json.dumps(value, ensure_ascii=False)


def toml_value(value: object) -> str:
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float) and math.isfinite(value):
        return repr(value)
    if isinstance(value, list):
        return "[" + ", ".join(toml_value(item) for item in value) + "]"
    if isinstance(value, dict) and all(isinstance(key, str) for key in value):
        pairs = (f"{toml_key(key)} = {toml_value(item)}" for key, item in value.items())
        return "{ " + ", ".join(pairs) + " }"
    raise ValueError("unsupported provider setting")


host_config_path = Path.home() / ".codex" / "config.toml"
target = Path.home() / ".config" / "herdr-demo" / "codex-provider.toml"

try:
    with host_config_path.open("rb") as stream:
        host_config = tomllib.load(stream)
    active_id = host_config["model_provider"]
    provider = host_config["model_providers"][active_id]
    if not isinstance(provider.get("base_url"), str) or not isinstance(provider.get("wire_api"), str):
        raise ValueError("unsupported provider settings")

    fields = {
        key: value
        for key, value in provider.items()
        if key not in {"auth", "name"}
    }
    fields["name"] = "Model Service"
    output = ["[model_providers.model-service]"]
    for key, value in fields.items():
        output.append(f"{toml_key(key)} = {toml_value(value)}")
    content = "\n".join(output) + "\n"

    target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(target, flags, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        stream.write(content)
        stream.flush()
        os.fsync(stream.fileno())
    os.chmod(target, 0o600)
    with target.open("rb") as stream:
        written_config = tomllib.load(stream)
    if not written_config["model_providers"]["model-service"].get("base_url"):
        raise ValueError("provider file validation failed")
except Exception:
    raise SystemExit("Could not create the private provider file from the active host config.") from None

print("Private provider file created with mode 600.")
