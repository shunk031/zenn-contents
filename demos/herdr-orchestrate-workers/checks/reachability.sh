#!/usr/bin/env bash
# @file .agents/demo/checks/reachability.sh
# @brief Check the configured service with an unauthenticated HEAD request.
# @description
#   Mounts only the private provider settings, sends no authorization header,
#   and prints only the HTTP status code. It does not call a model.

set -Eeuo pipefail

image_tag="${1:?pass the image tag}"
provider_secret="${HOME:?}/.config/herdr-demo/codex-provider.toml"

if [[ ! -r "$provider_secret" || ! -s "$provider_secret" ]]; then
    printf '%s\n' '000'
    exit 1
fi

docker_args=(docker run --rm --user 10001:10001)
for proxy_name in HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy NO_PROXY no_proxy; do
    if [[ -n "${!proxy_name:-}" ]]; then
        docker_args+=(--env "$proxy_name=${!proxy_name}")
    fi
done

python_code='
import tomllib
import urllib.error
import urllib.request

with open("/run/secrets/codex-provider.toml", "rb") as stream:
    private = tomllib.load(stream)
providers = private.get("model_providers")
if not isinstance(providers, dict) or len(providers) != 1:
    print("000")
    raise SystemExit(1)
provider = next(iter(providers.values()))
base_url = provider.get("base_url") if isinstance(provider, dict) else None
if not isinstance(base_url, str) or not base_url:
    print("000")
    raise SystemExit(1)
request = urllib.request.Request(base_url, method="HEAD", headers={})
try:
    with urllib.request.urlopen(request, timeout=15) as response:
        print(response.status)
except urllib.error.HTTPError as error:
    print(error.code)
except Exception:
    print("000")
'

docker_args+=(
    --mount "type=bind,source=$provider_secret,target=/run/secrets/codex-provider.toml,readonly"
    --entrypoint python3
    "$image_tag"
    -c
    "$python_code"
)
"${docker_args[@]}"
