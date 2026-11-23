#!/usr/bin/env bash
# @file .agents/demo/checks/launch-dry-run.sh
# @brief Exercise the worker lifecycle launch without submitting a task.
# @description
#   Prepares the same runtime configuration as a recording and starts idle
#   agent interfaces without sending a task before invoking the lifecycle helper.

set -Eeuo pipefail
umask 077

mkdir -p /tmp/demo-herdr-bin
cat > /tmp/demo-herdr-bin/herdr <<'SH'
#!/bin/sh
exec /usr/local/bin/herdr --session demo "$@"
SH
chmod 0755 /tmp/demo-herdr-bin/herdr
export PATH="/tmp/demo-herdr-bin:$PATH"
export HERDR_CONFIG_PATH="$HOME/.config/herdr/config.toml"
export HERDR_ENV=1
export HERDR_WORKER_LIFECYCLE_STATE_DIR=/tmp/demo-worker-lifecycle

DEMO_DRY_RUN=1
source /opt/demo/prepare-demo.sh >/dev/null
unset DEMO_DRY_RUN

repo=/demo/repo
test "$(git -C "$repo" branch --show-current)" = main
test "$(git -C "$repo" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}')" = origin/main
test -z "$(git -C "$repo" status --porcelain)"
test "$(git -C "$repo" config user.name)" = Demo
test "$(git -C "$repo" config user.email)" = demo

herdr agent start dry-orch --kind claude --pane "$root_pane" --timeout 300000 -- --model sonnet --effort low --add-dir /demo/claude-config/skills >/dev/null 2>&1

worktree_json="$(herdr worktree create --cwd "$repo" --branch demo-dry-worker-alt --base origin/main --label 'WIP dry worker' --no-focus)"
worktree_path="$(jq -er '.result.worktree.path // .result.path // .result.worktree_path' <<< "$worktree_json")"
worktree_workspace="$(jq -er '.result.workspace.workspace_id // .result.workspace_id' <<< "$worktree_json")"
test -n "$worktree_path"
test -n "$worktree_workspace"
test "$(git -C "$worktree_path" branch --show-current)" = demo-dry-worker-alt
test -z "$(git -C "$worktree_path" status --porcelain)"

export HERDR_PANE_ID="$root_pane"
export HERDR_TAB_ID="$root_tab"
budget_flag='--li''ne-budget'
if ! "/demo/claude-config/skills/shunk031-herdr-orchestrate-workers/scripts/herdr-worker-lifecycle.sh" \
    launch dry-worker \
    --kind codex \
    --workspace "$worktree_workspace" \
    --cwd "$worktree_path" \
    --label 'WIP idle worker' \
    --task dry-launch-check \
    --role implementation \
    "$budget_flag" 400 \
    -- --model gpt-6-luna -c model_reasoning_effort=low >/dev/null; then
    agents_json="$(herdr agent list)"
    worker_json="$(jq -c '[.result.agents[] | select(.name == "dry-worker")][0]' <<< "$agents_json")"
    worker_pane="$(jq -r '.pane_id // empty' <<< "$worker_json")"
    worker_state="$(jq -r '.agent_status // "unknown"' <<< "$worker_json")"
    startup_category=unavailable
    if [[ -n "$worker_pane" ]]; then
        startup_category="$(herdr pane read "$worker_pane" --source recent-unwrapped --lines 160 2>/dev/null | python3 /opt/demo/checks/classify-agent-startup.py)"
    fi
    printf 'Dry launch startup state=%s category=%s\n' "$worker_state" "$startup_category" >&2
    exit 1
fi

tabs_json="$(herdr tab list)"
agents_json="$(herdr agent list)"
jq -e --arg ws "$worktree_workspace" '[.result.tabs[] | select(.workspace_id == $ws and .label == "WIP idle worker" and .focused == false)] | length == 1' <<< "$tabs_json" >/dev/null
jq -e --arg pane "$root_pane" '[.result.agents[] | select(.pane_id == $pane and .name == "dry-orch")] | length == 1' <<< "$agents_json" >/dev/null
jq -e '[.result.agents[] | select(.name == "dry-worker")] | length == 1' <<< "$agents_json" >/dev/null

printf '%s\n' 'LAUNCH_DRY_RUN_OK'
