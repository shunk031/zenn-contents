# syntax=docker/dockerfile:1.7
# Pin the official Node image used as a binary source, then use VHS as the final base.
FROM node:26.13.1-bookworm-slim@sha256:5df79989ed685e09f0a98019db4cebfb22fb9df1a53c0161664a011f7ff6b0f1 AS node-runtime

# Official VHS v0.12.1 multi-architecture image, pinned to its verified index digest.
FROM ghcr.io/charmbracelet/vhs@sha256:ea49a6a1c529be83153e88321892b5585964418f0b9055e8c1e0d732194234a3

ARG TARGETARCH
ARG CLAUDE_CODE_VERSION=2.1.330
ARG CODEX_CLI_VERSION=0.171.0
ARG CCSTATUSLINE_VERSION=2.2.34
ARG HERDR_VERSION=0.9.5
ARG SKILLS_COMMIT=4a0a19413527661c4078b00d573b75e1f1efc8d6
ARG NOTO_CJK_COMMIT=523d033d6cb47f4a80c58a35753646f5c3608a78
ARG NOTO_CJK_FONT_SHA256=4d01725be822d144cf9a56ade981e6fb920cd7a610b8fc24cc601a920beea5b9

USER root

COPY --from=node-runtime /usr/local/ /usr/local/

RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install --no-install-recommends -y \
        bash ca-certificates curl gawk git jq passwd python3 xz-utils \
    && rm -rf /var/lib/apt/lists/*

RUN set -eu; \
    font_dir=/usr/local/share/fonts/opentype/noto-cjk; \
    doc_dir=/usr/local/share/doc/noto-cjk; \
    mkdir -p "$font_dir" "$doc_dir"; \
    curl -fLsS --retry 3 --retry-all-errors \
      "https://raw.githubusercontent.com/notofonts/noto-cjk/$NOTO_CJK_COMMIT/Sans/Mono/NotoSansMonoCJKjp-Regular.otf" \
      -o "$font_dir/NotoSansMonoCJKjp-Regular.otf"; \
    printf '%s  %s\n' "$NOTO_CJK_FONT_SHA256" "$font_dir/NotoSansMonoCJKjp-Regular.otf" | sha256sum -c -; \
    curl -fLsS --retry 3 --retry-all-errors \
      "https://raw.githubusercontent.com/notofonts/noto-cjk/$NOTO_CJK_COMMIT/LICENSE" \
      -o "$doc_dir/LICENSE"; \
    fc-cache -f; \
    fc-match -f '%{family}\n' 'Noto Sans Mono CJK JP' | grep -F 'Noto Sans Mono CJK JP'

RUN set -eu; \
    case "$TARGETARCH" in \
      arm64) herdr_arch=aarch64; herdr_sha=17d7536f2da50859523680ef279dffcac8e4a235f4e46fe8da6c2ec44141897c ;; \
      amd64) herdr_arch=x86_64; herdr_sha=14d9e8bc8b4a9e0118d77c32266f76d461f09b40342eb23752960bd89f59929d ;; \
      *) printf 'Unsupported build architecture: %s\n' "$TARGETARCH" >&2; exit 1 ;; \
    esac; \
    curl -fLsS "https://github.com/herdrdev/herdr/releases/download/v$HERDR_VERSION/herdr-linux-$herdr_arch" -o /usr/local/bin/herdr; \
    printf '%s  %s\n' "$herdr_sha" /usr/local/bin/herdr | sha256sum -c -; \
    chmod 0755 /usr/local/bin/herdr; \
    herdr --version

RUN npm install --global --no-audit --no-fund --allow-scripts=@anthropic-ai/claude-code \
      "@anthropic-ai/claude-code@$CLAUDE_CODE_VERSION" \
      "@openai/codex@$CODEX_CLI_VERSION" \
      "ccstatusline@$CCSTATUSLINE_VERSION" \
    && claude --version \
    && codex --version \
    && ccstatusline --version

RUN groupadd --gid 10001 demo \
    && useradd --uid 10001 --gid 10001 --create-home --shell /bin/bash demo \
    && mkdir -p /demo/claude-config/skills /home/demo/.codex \
       /home/demo/.config/herdr /home/demo/.cache /home/demo/.agents \
       /demo/repo /demo/worktrees /demo/origin.git /opt/demo /opt/demo/checks \
    && printf '%s\n' '{"spinnerTipsEnabled":false,"statusLine":{"type":"command","command":"ccstatusline --config /demo/claude-config/ccstatusline.settings.json"}}' > /demo/claude-config/settings.json \
    && printf '%s\n' \
       'model = "gpt-6-luna"' \
       'model_provider = "model-service"' \
       'model_reasoning_effort = "low"' \
        'approval_policy = "never"' \
        'sandbox_mode = "danger-full-access"' \
       '' \
       '[model_providers.model-service]' \
       'name = "Model Service"' \
       'base_url = "https://example.invalid"' \
       'wire_api = "responses"' \
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
       'trust_level = "trusted"' \
       > /home/demo/.codex/config.toml \
    && printf '%s\n' '#!/bin/sh' 'set -eu' 'secret=/run/secrets/codex-token' '[ -r "$secret" ] || exit 1' '/usr/bin/tr -d "\r\n" < "$secret"' > /usr/local/bin/demo-credential \
    && chmod 0755 /usr/local/bin/demo-credential \
    && printf '%s\n' 'onboarding = false' > /home/demo/.config/herdr/config.toml \
    && printf '%s\n' 'export HISTFILE=/dev/null' 'set +o history' 'export PS1="demo:\w\$ "' > /home/demo/.bashrc \
    && printf '%s\n' '[user]' '    name = Demo' '    email = demo' '[init]' '    defaultBranch = main' > /home/demo/.gitconfig \
    && chown -R demo:demo /home/demo /demo /opt/demo

ENV HOME=/home/demo \
    USER=demo \
    LOGNAME=demo \
    SHELL=/bin/bash \
    CODEX_HOME=/home/demo/.codex \
    HERDR_CONFIG_PATH=/home/demo/.config/herdr/config.toml \
    HISTFILE=/dev/null \
    GIT_TERMINAL_PROMPT=0 \
    TERM=xterm-256color \
    IS_DEMO=1 \
    CLAUDE_CONFIG_DIR=/demo/claude-config \
    CLAUDE_CODE_HIDE_CWD=1 \
    CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION=false \
    DISABLE_TELEMETRY=1 \
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1

USER demo
WORKDIR /demo/repo

RUN git -c init.templateDir=/dev/null init --quiet --initial-branch=main \
    && printf '%s\n' '# Synthetic demo repository' '' 'A tiny repository for a public agent-orchestration demonstration.' > README.md \
    && git add README.md \
    && git commit --quiet -m "Add synthetic demo repository"

RUN git -c init.templateDir=/dev/null init --quiet --bare --initial-branch=main /demo/origin.git \
    && git remote add origin /demo/origin.git \
    && git push --quiet --set-upstream origin main \
    && test "$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}')" = origin/main \
    && test -z "$(git status --porcelain)" \
    && test "$(git config user.name)" = Demo \
    && test "$(git config user.email)" = demo \
    && git ls-remote --symref origin HEAD | grep -Eq '^ref: refs/heads/main[[:space:]]HEAD$'

RUN set -eu; \
    skills_tmp="$(mktemp -d)"; \
    git -C "$skills_tmp" init --quiet; \
    git -C "$skills_tmp" remote add origin https://github.com/shunk031/skills.git; \
    git -C "$skills_tmp" fetch --depth=1 origin "$SKILLS_COMMIT"; \
    git -C "$skills_tmp" checkout --quiet --detach FETCH_HEAD; \
    test "$(git -C "$skills_tmp" rev-parse HEAD)" = "$SKILLS_COMMIT"; \
    source="$skills_tmp/skills/herdr/shunk031-herdr-orchestrate-workers"; \
    dest="/demo/claude-config/skills/shunk031-herdr-orchestrate-workers"; \
    mkdir -p "$dest"; \
    cp "$source/SKILL.md" "$dest/SKILL.md"; \
    cp -a "$source/references" "$source/scripts" "$dest/"; \
    source="$skills_tmp/skills/codex/shunk031-codex-worker-prompting"; \
    dest="/demo/claude-config/skills/shunk031-codex-worker-prompting"; \
    mkdir -p "$dest"; \
    cp "$source/SKILL.md" "$dest/SKILL.md"; \
    mkdir -p /demo/claude-config/skills/herdr; \
    herdr --skill > /demo/claude-config/skills/herdr/SKILL.md; \
    ln -s /demo/claude-config/skills "$HOME/.agents/skills"; \
    rm -rf "$skills_tmp"; \
    test -s /demo/claude-config/skills/shunk031-herdr-orchestrate-workers/SKILL.md; \
    test -s /demo/claude-config/skills/shunk031-codex-worker-prompting/SKILL.md; \
    test -s /demo/claude-config/skills/herdr/SKILL.md

COPY --chown=demo:demo prepare-demo.sh /opt/demo/prepare-demo.sh
COPY --chown=demo:demo record-demo.sh /opt/demo/record-demo.sh
COPY --chown=demo:demo timing-log.py /opt/demo/timing-log.py
COPY --chown=demo:demo mark-timing.py /opt/demo/mark-timing.py
COPY --chown=demo:demo postprocess-video.py /opt/demo/postprocess-video.py
COPY --chown=demo:demo checks/launch-dry-run.sh /opt/demo/checks/launch-dry-run.sh
COPY --chown=demo:demo checks/classify-agent-startup.py /opt/demo/checks/classify-agent-startup.py
COPY --chown=demo:demo checks/skill-input-dry.tape /opt/demo/checks/skill-input-dry.tape
COPY --chown=demo:demo checks/run-skill-input-dry.sh /opt/demo/checks/run-skill-input-dry.sh
COPY --chown=demo:demo ccstatusline.settings.json /demo/claude-config/ccstatusline.settings.json
COPY --chown=demo:demo demo.tape /opt/demo/demo.tape
COPY --chown=demo:demo demo-dry.tape /opt/demo/demo-dry.tape
RUN chmod 0755 /opt/demo/prepare-demo.sh /opt/demo/record-demo.sh \
       /opt/demo/timing-log.py /opt/demo/mark-timing.py \
       /opt/demo/postprocess-video.py \
       /opt/demo/checks/launch-dry-run.sh /opt/demo/checks/classify-agent-startup.py \
       /opt/demo/checks/run-skill-input-dry.sh

CMD ["/opt/demo/demo.tape"]
