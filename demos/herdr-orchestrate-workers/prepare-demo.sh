#!/usr/bin/env bash
# @file .agents/demo/prepare-demo.sh
# @brief Prepare runtime configuration and the headless recording session.
# @description
#   Source this file from the hidden setup section of a tape.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    printf '%s\n' 'Source this setup from the VHS tape; do not run it standalone.' >&2
    exit 2
fi

set -Eeuo pipefail
set +o history
export HISTFILE=/dev/null
umask 077

if [[ ! -r /run/secrets/claude-token ]]; then
    printf '%s\n' 'Claude token secret is missing or unreadable inside the container.' >&2
    return 1
fi
if [[ ! -r /run/secrets/codex-token || ! -s /run/secrets/codex-token ]]; then
    printf '%s\n' 'Codex token secret is missing, empty, or unreadable inside the container.' >&2
    return 1
fi
if [[ ! -r /run/secrets/codex-provider.toml || ! -s /run/secrets/codex-provider.toml ]]; then
    printf '%s\n' 'The private provider configuration is missing or unreadable.' >&2
    return 1
fi
if [[ ! -s "$CODEX_HOME/config.toml" ]]; then
    printf '%s\n' 'The container Codex configuration is missing.' >&2
    return 1
fi

codex_config_tmp="$CODEX_HOME/config.toml.tmp"
{
    printf '%s\n' \
        'model = "gpt-6-luna"' \
        'model_provider = "model-service"' \
        'model_reasoning_effort = "low"' \
        'approval_policy = "never"' \
        'sandbox_mode = "danger-full-access"' \
        ''
    cat /run/secrets/codex-provider.toml
    printf '%s\n' \
        '' \
        '[model_providers.model-service.auth]' \
        'command = "/usr/local/bin/demo-credential"' \
        'refresh_interval_ms = 0' \
        '' \
        '[tui]' \
        'status_line = []' \
        '' \
        '[projects."/demo/repo"]' \
        'trust_level = "trusted"' \
        '' \
        '[projects."/demo/worktrees"]' \
        'trust_level = "trusted"'
} > "$codex_config_tmp"
if ! python3 - "$codex_config_tmp" <<'PY'
import sys
import tomllib

with open(sys.argv[1], 'rb') as stream:
    config = tomllib.load(stream)
provider = config['model_providers']['model-service']
assert config['model_provider'] == 'model-service'
assert config['approval_policy'] == 'never'
assert config['sandbox_mode'] == 'danger-full-access'
assert isinstance(provider.get('base_url'), str)
assert provider['auth']['command'] == '/usr/local/bin/demo-credential'
assert config['tui']['status_line'] == []
assert config['projects']['/demo/repo']['trust_level'] == 'trusted'
assert config['projects']['/demo/worktrees']['trust_level'] == 'trusted'
PY
then
    rm -f "$codex_config_tmp"
    printf '%s\n' 'The runtime Codex configuration is invalid.' >&2
    return 1
fi
chmod 0600 "$codex_config_tmp"
mv -f "$codex_config_tmp" "$CODEX_HOME/config.toml"

if [[ "${DEMO_CONFIG_DRY_RUN:-0}" == 1 ]]; then
    python3 - "$CODEX_HOME/config.toml" <<'PY'
import sys
import tomllib

with open(sys.argv[1], 'rb') as stream:
    config = tomllib.load(stream)
assert config['approval_policy'] == 'never'
assert config['sandbox_mode'] == 'danger-full-access'
print('approval_policy=never')
print('sandbox_mode=danger-full-access')
PY
    return 0
fi

CLAUDE_CODE_OAUTH_TOKEN="$(< /run/secrets/claude-token)"
if [[ -z "$CLAUDE_CODE_OAUTH_TOKEN" ]]; then
    printf '%s\n' 'Claude token secret is empty; its contents were not displayed.' >&2
    return 1
fi
export CLAUDE_CODE_OAUTH_TOKEN

mkdir -p /demo/worktrees "$HOME/.cache" "$HOME/.local/state"
if [[ ! -d /demo/repo/.git ]]; then
    printf '%s\n' 'The synthetic repository is missing from the image.' >&2
    return 1
fi

demo_session="demo"
export HERDR_CONFIG_PATH="${HERDR_CONFIG_PATH:-$HOME/.config/herdr/config.toml}"
herdr_demo() {
    herdr --session "$demo_session" "$@"
}

nohup herdr --session "$demo_session" server \
    > "$HOME/.cache/herdr-server.log" 2>&1 </dev/null &
server_is_ready() {
    local status_json
    status_json="$(herdr_demo status server --json 2>/dev/null)" || return 1
    python3 -c '
import json
import sys

status = json.load(sys.stdin)
sys.exit(0 if status.get("running") is True and status.get("compatible") is True and status.get("endpoint_compatible") is True else 1)
' <<< "$status_json" 2>/dev/null
}
server_ready=0
for attempt in $(seq 1 120); do
    if server_is_ready; then
        server_ready=1
        break
    fi
    sleep 0.5
done
if [[ "$server_ready" != 1 ]]; then
    printf '%s\n' 'The headless server did not become ready; no secrets were displayed.' >&2
    return 1
fi

workspace_json="$(herdr_demo workspace create --cwd /demo/repo --label 'Demo orchestrator')"
root_pane="$(jq -er '.result.root_pane.pane_id' <<< "$workspace_json")"
root_tab="$(jq -er '.result.tab.tab_id' <<< "$workspace_json")"

if [[ "${DEMO_DRY_RUN:-0}" == 1 ]]; then
    printf '%s\n' 'DEMO_SETUP_READY'
    return 0
fi

if [[ "${DEMO_SKILL_DRY_RUN:-0}" == 1 ]]; then
    if ! herdr_demo agent start orchestrator --kind claude --pane "$root_pane" -- --model sonnet --effort low --add-dir /demo/claude-config/skills >/dev/null 2>&1; then
        printf '%s\n' 'Claude skill discovery check could not start the idle CLI.' >&2
        return 1
    fi
    printf '%s\n' 'DEMO_SETUP_READY'
    return 0
fi

if ! herdr_demo agent start orchestrator --kind claude --pane "$root_pane" -- --model sonnet --effort low --add-dir /demo/claude-config/skills >/dev/null 2>&1; then
    printf '%s\n' 'Claude orchestrator startup needs attention; no credentials were displayed.' >&2
    return 1
fi

printf '%s\n' "$root_pane" > /tmp/demo-root-pane
: > /out/timing.log
rm -f /out/finished
nohup /opt/demo/timing-log.py "$demo_session" orchestrator "$root_pane" /out/timing.log /out/finished \
    > /dev/null 2>&1 </dev/null &

printf '%s\n' 'DEMO_SETUP_READY'
