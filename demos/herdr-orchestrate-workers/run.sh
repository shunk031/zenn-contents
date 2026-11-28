#!/usr/bin/env bash

# @file demos/herdr-orchestrate-workers/run.sh
# @brief Record a selected Herdr demo variant in a disposable container.
# @option --variant <default|split> Select the single-pane or split-pane tape.
# @option --output-dir <path> Write media outputs to this host directory.

set -Eeuo pipefail

kit_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
image_tag="herdr-vhs-demo:v0.12.1-herdr0.9.5-skills4a0a194-ccstatusline2.2.34-fonts3.5.1"
claude_secret="${HOME:?}/.config/herdr-demo/claude-token"
codex_secret="${HOME:?}/.config/herdr-demo/codex-token"
provider_secret="${HOME:?}/.config/herdr-demo/codex-provider.toml"
variant=default
out_dir="$kit_dir/out"

usage() {
    printf '%s\n' 'Usage: ./run.sh [--variant default|split] [--output-dir PATH]' >&2
}

while (($#)); do
    case "$1" in
        --variant)
            if (($# < 2)); then
                usage
                exit 2
            fi
            variant="$2"
            shift 2
            ;;
        --output-dir)
            if (($# < 2)); then
                usage
                exit 2
            fi
            out_dir="$2"
            shift 2
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            usage
            exit 2
            ;;
    esac
done

case "$variant" in
    default|split) ;;
    *)
        printf '%s\n' 'The variant must be "default" or "split".' >&2
        exit 2
        ;;
esac

if [[ ! -f "$claude_secret" ]]; then
    printf '%s\n' 'Missing required Claude credential file (~/.config/herdr-demo/claude-token).' >&2
    printf '%s\n' 'Create the file before recording. Its contents are never displayed.' >&2
    exit 1
fi
if [[ ! -r "$claude_secret" ]]; then
    printf '%s\n' 'The Claude credential file is not readable.' >&2
    exit 1
fi
if [[ ! -f "$codex_secret" ]]; then
    printf '%s\n' 'Missing required Codex credential file (~/.config/herdr-demo/codex-token).' >&2
    printf '%s\n' 'Create the file before recording. Its contents are never displayed.' >&2
    exit 1
fi
if [[ ! -r "$codex_secret" ]]; then
    printf '%s\n' 'The Codex credential file is not readable.' >&2
    exit 1
fi
if [[ ! -f "$provider_secret" || ! -r "$provider_secret" || ! -s "$provider_secret" ]]; then
    printf '%s\n' 'Private provider configuration is missing, empty, or unreadable.' >&2
    printf '%s\n' 'Run create-provider-secret.py before recording.' >&2
    exit 1
fi

mkdir -p "$out_dir"
out_dir="$(cd -- "$out_dir" && pwd)"

proxy_args=()
has_proxy=0
for proxy_name in HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy NO_PROXY no_proxy; do
    if [[ -n "${!proxy_name:-}" ]]; then
        proxy_args+=(--env "$proxy_name=${!proxy_name}")
        has_proxy=1
    fi
done

docker_args=(docker run --rm \
    --entrypoint /opt/demo/record-demo.sh \
    --hostname demo \
    --user 10001:10001)
if [[ "$has_proxy" == 1 ]]; then
    docker_args+=("${proxy_args[@]}")
fi
docker_args+=(
    --mount "type=bind,source=$claude_secret,target=/run/secrets/claude-token,readonly" \
    --mount "type=bind,source=$codex_secret,target=/run/secrets/codex-token,readonly" \
    --mount "type=bind,source=$provider_secret,target=/run/secrets/codex-provider.toml,readonly" \
    --mount "type=bind,source=$out_dir,target=/out" \
    "$image_tag" "$variant")
exec "${docker_args[@]}"
