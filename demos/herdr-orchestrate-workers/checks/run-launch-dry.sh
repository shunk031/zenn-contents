#!/usr/bin/env bash
# @file .agents/demo/checks/run-launch-dry.sh
# @brief Run the worker lifecycle dry check without network or credentials.

set -Eeuo pipefail

image_tag="herdr-vhs-demo:v0.12.1-herdr0.9.5-skills4a0a194-ccstatusline2.2.34"
claude_secret="${HOME:?}/.config/herdr-demo/claude-token"
codex_secret="${HOME:?}/.config/herdr-demo/codex-token"
provider_secret="${HOME:?}/.config/herdr-demo/codex-provider.toml"

for secret in "$claude_secret" "$codex_secret" "$provider_secret"; do
    if [[ ! -r "$secret" || ! -s "$secret" ]]; then
        printf '%s\n' 'A required read-only setup file is missing or unreadable.' >&2
        exit 1
    fi
done

exec docker run --rm --user 10001:10001 \
    --mount "type=bind,source=$claude_secret,target=/run/secrets/claude-token,readonly" \
    --mount "type=bind,source=$codex_secret,target=/run/secrets/codex-token,readonly" \
    --mount "type=bind,source=$provider_secret,target=/run/secrets/codex-provider.toml,readonly" \
    --entrypoint /opt/demo/checks/launch-dry-run.sh \
    "$image_tag"
