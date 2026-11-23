#!/usr/bin/env bash
# @file .agents/demo/checks/run-config-dry.sh
# @brief Validate the runtime Codex approval and sandbox settings without a model call.
# @description
#   Mounts the setup files read-only, disables container networking, and sources
#   the hidden setup only through its config validation return path.

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

exec docker run --rm --network none --user 10001:10001 \
    --env DEMO_CONFIG_DRY_RUN=1 \
    --mount "type=bind,source=$claude_secret,target=/run/secrets/claude-token,readonly" \
    --mount "type=bind,source=$codex_secret,target=/run/secrets/codex-token,readonly" \
    --mount "type=bind,source=$provider_secret,target=/run/secrets/codex-provider.toml,readonly" \
    --entrypoint /bin/bash \
    "$image_tag" -c 'source /opt/demo/prepare-demo.sh'
