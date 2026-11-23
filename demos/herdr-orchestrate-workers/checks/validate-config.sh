#!/usr/bin/env bash
set -euo pipefail

image_tag="${1:?pass the image tag}"

docker run --rm --entrypoint python3 "$image_tag" -c '
import tomllib

with open("/home/demo/.codex/config.toml", "rb") as stream:
    config = tomllib.load(stream)
provider = config["model_providers"][config["model_provider"]]
assert config["model"] == "gpt-6-luna"
assert config["model_reasoning_effort"] == "low"
assert config["approval_policy"] == "never"
assert config["sandbox_mode"] == "danger-full-access"
assert config["model_provider"] == "model-service"
assert provider["name"] == "Model Service"
assert provider["wire_api"] == "responses"
assert isinstance(provider["base_url"], str)
assert provider["auth"]["command"] == "/usr/local/bin/demo-credential"
assert config["tui"]["status_line"] == []
assert config["projects"]["/demo/repo"]["trust_level"] == "trusted"
assert config["projects"]["/demo/worktrees"]["trust_level"] == "trusted"
print("valid")
'
