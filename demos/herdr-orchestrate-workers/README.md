# Herdr orchestration demo kit

This kit builds a disposable container for recording two VHS variants of a Herdr worker demo. The image contains pinned tools, a synthetic repository, and neutral configuration. Credentials and host-specific provider settings stay outside the image and are mounted read-only at runtime.

VHS uses RobotoMono Nerd Font Mono v3.5.1 as its primary font and Noto Sans Mono CJK JP as its fallback. The build verifies the primary font archive's SHA-256 and keeps its Apache License 2.0 file in the image.

## Prerequisites

- Docker with BuildKit and network access for image builds.
- A working host Codex configuration and valid Claude Code and Codex credentials for the organization's model gateway.
- On Linux, make the runtime files readable by container UID 10001 without making them world-readable. Docker Desktop on macOS maps mounted file permissions for this image user.

## Runtime files

Create or provision these files on the host under `~/.config/herdr-demo/`:

- `claude-token`
- `codex-token`
- `codex-provider.toml`

Run `./create-provider-secret.py` to create the provider file from the active host Codex configuration. It sets mode 600 and does not display settings. All three files are mounted read-only at runtime. The output directory is the only writable host mount.

## Build and record

From this directory, build the image:

```sh
docker build --pull \
  -t herdr-vhs-demo:v0.12.1-herdr0.9.5-skills4a0a194-ccstatusline2.2.34-fonts3.5.1 .
```

Record the default single-pane variant:

```sh
./run.sh
```

Record the split-pane variant used for the article:

```sh
./run.sh --variant split
```

Use `--output-dir PATH` to select a different output directory. Each variant keeps its raw capture and writes separate final MP4 and GIF files into `out/`:

| Variant | Raw capture                              | Final MP4                            | GIF                                  |
| ------- | ---------------------------------------- | ------------------------------------ | ------------------------------------ |
| Default | `herdr-orchestration-demo-raw.mp4`       | `herdr-orchestration-demo.mp4`       | `herdr-orchestration-demo.gif`       |
| Split   | `herdr-orchestration-demo-split-raw.mp4` | `herdr-orchestration-demo-split.mp4` | `herdr-orchestration-demo-split.gif` |

The default variant records at 1440 × 900. Immediately before `Show`, the tape writes a UTC `video_start` marker to the timing log. The postprocessor uses this marker as video time zero for the worker-tab cut and every idle interval. It fails if the marker is missing. Its hidden watcher checks the combined root and worker panes once per second. It removes ANSI escapes and normalizes spinner glyphs and elapsed-time values before comparing samples. A nonempty normalized screen with no visible content change for two seconds counts as idle. Spinner-only and timer-only thinking or waiting intervals are compressed; stretches with other visible content changes stay at normal speed. Structured Herdr state does not classify idle intervals. It sets the cut twelve seconds after the worker tab closes, matching the approved default take.

The split variant records at 2400 × 1080. Its tape sets `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1` during capture. This keeps the split client in the normal screen buffer. See the [Claude Code fullscreen documentation](https://code.claude.com/docs/en/fullscreen.md). Immediately before `Show`, the tape writes a UTC `video_start` marker to the timing log. The postprocessor uses it as video time zero for the cut and all waiting intervals. It fails if the marker is missing. The tape keeps a fixed eight-minute raw capture. A hidden watcher polls Herdr state every 0.5 seconds. It records worker creation, worker completion status, agent removal, pane closure, and parent idle after removal as separate events. A worker status of `done` records completion; agent or pane removal also implies completion. Detection of a `DONE` report in the root pane is informational only. The watcher writes `out/finished-split` when a later poll first sees the parent idle after removal. The postprocessor requires worker creation, worker done status or removal, and parent idle after a recorded removal. It cuts three seconds after parent idle and speeds up spinner-only waiting intervals recorded by the watcher while keeping other visible content changes at normal speed. The article uses this split-pane variant and shows the worker's `DONE` report; that text does not control timing or the final cut.

The split GIF uses 2400 px width, 3 fps, 32 colors, and no dithering. The postprocessor stops with an error if the GIF exceeds Zenn's 3 MB (3,000,000-byte) per-image limit.

The host proxy environment, when configured, is forwarded to the container. Docker removes the container after each run.

## Safety and privacy

- Runtime credentials and host-specific provider settings never enter the image. At startup, the private file's single provider table selects the Codex provider ID. Setup fails if it contains zero or multiple provider tables.
- Codex uses `approval_policy = "never"` and `sandbox_mode = "danger-full-access"`. The disposable container is the isolation boundary; Docker privileges and security profiles are unchanged. Credential files are read-only mounts, the output directory is the only writable host mount, and the container is removed after the run.
- The Codex status line is empty. The Claude status line uses neutral model and context widgets. Claude Code hides the current directory.
- The root uses the Sonnet model with low effort. The Codex worker uses low reasoning effort.
- The synthetic repository has a local bare remote, a tracked default branch, a clean starting tree, and a neutral Git identity.
- A real recording starts agents and uses the configured model service. Review the frames before sharing outputs.

## Checks

Run `python3 checks/check-tape-waits.py` to ensure none of the tape's `Wait` expressions can match text entered by a `Type` command.

Run `python3 checks/check-split-postprocess-timing.py` to dry-run the split postprocessor with and without an optional report event. A bare `DONE` token is also checked as a valid informational report match.

The other scripts under `checks/` exercise setup, configuration, skill input, and worker launch. Their temporary captures go under `out/checks/`; do not include generated output in source control.
