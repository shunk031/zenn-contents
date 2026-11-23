#!/usr/bin/env bash
# @file .agents/demo/checks/run-skill-input-dry.sh
# @brief Check slash skill discovery and Japanese text entry without a model call.
# @description
#   Starts an idle Claude Code pane, opens the slash picker, and types the
#   prepared instruction without submitting it. VHS captures the rendered text.

set -Eeuo pipefail

kit_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
image_tag="herdr-vhs-demo:v0.12.1-herdr0.9.5-skills4a0a194-ccstatusline2.2.34"
claude_secret="${HOME:?}/.config/herdr-demo/claude-token"
codex_secret="${HOME:?}/.config/herdr-demo/codex-token"
provider_secret="${HOME:?}/.config/herdr-demo/codex-provider.toml"
out_dir="${1:-$kit_dir/out/checks}"

for secret in "$claude_secret" "$codex_secret" "$provider_secret"; do
    if [[ ! -r "$secret" || ! -s "$secret" ]]; then
        printf '%s\n' 'A required read-only setup file is missing or unreadable.' >&2
        exit 1
    fi
done

mkdir -p "$out_dir"
out_dir="$(cd -- "$out_dir" && pwd -P)"
docker run --rm --network none --hostname demo --user 10001:10001 \
    --env DEMO_SKILL_DRY_RUN=1 \
    --mount "type=bind,source=$claude_secret,target=/run/secrets/claude-token,readonly" \
    --mount "type=bind,source=$codex_secret,target=/run/secrets/codex-token,readonly" \
    --mount "type=bind,source=$provider_secret,target=/run/secrets/codex-provider.toml,readonly" \
    --mount "type=bind,source=$out_dir,target=/out" \
    "$image_tag" /opt/demo/checks/skill-input-dry.tape

printf '%s\n' 'SKILL_INPUT_DRY_CAPTURED'
