# Herdr orchestration demo kit

This kit builds a disposable container for recording a short Herdr worker demo with VHS. The image contains pinned tools, a synthetic repository, and neutral configuration. No credentials or host-specific provider settings are baked into the image.

## Prerequisites

- Docker with BuildKit and network access for image builds.
- A working host Codex configuration for the model service used by the demo.
- Valid Claude Code and Codex credentials for that service.
- On Linux, make the runtime files readable by container UID 10001 without making them world-readable. Docker Desktop on macOS maps mounted file permissions for this image user.

## Runtime files

Create or provision these files on the host under `~/.config/herdr-demo/`:

- `claude-token`
- `codex-token`
- `codex-provider.toml`

Run `./create-provider-secret.py` to create the provider file from the active host Codex configuration. It sets mode 600 and does not display settings. The three files are mounted read-only at runtime. The output directory is the only writable host mount.

## Build and record

From this directory, build the image:

```sh
docker build --pull \
  -t herdr-vhs-demo:v0.12.1-herdr0.9.5-skills4a0a194-ccstatusline2.2.34 .
```

Record GIF and MP4 outputs into `./out`:

```sh
./run.sh
```

The tape hides setup, starts a detached Herdr server, prepares the synthetic repository, and launches the real orchestration task. A hidden watcher polls structured Herdr state every second and writes UTC lifecycle timestamps to `out/timing.log`; it creates `out/finished` when the worker tab closes. The raw video is kept. Post-processing cuts three seconds after tab closure and speeds up only stretches where the terminal display did not change. Real actions remain at normal speed. The result aims for 60–90 seconds; if the recording has too little idle footage to compress, it may finish slightly below 60 seconds.

`run.sh` post-processes automatically. To regenerate the final MP4 and GIF from an existing raw capture and timing log, run:

```sh
docker run --rm \
  --mount "type=bind,source=$PWD/out,target=/out" \
  --entrypoint python3 \
  herdr-vhs-demo:v0.12.1-herdr0.9.5-skills4a0a194-ccstatusline2.2.34 \
  /opt/demo/postprocess-video.py /out
```

The host proxy environment, when configured, is forwarded to the container. Docker removes the container after each run.

## Safety and privacy

- Runtime credentials and host-specific provider settings never enter the image. The private provider file is merged into the container's Codex configuration at startup.
- Codex uses `approval_policy = "never"` and `sandbox_mode = "danger-full-access"`. The disposable container is the isolation boundary; Docker privileges and security profiles are unchanged. Credential files are read-only mounts, the output directory is the only writable host mount, and the container is removed after the run.
- The Codex status line is empty. The Claude status line uses neutral model and context widgets. Claude Code hides the current directory.
- The root uses the Sonnet model with low effort. The Codex worker uses low reasoning effort.
- The synthetic repository has a local bare remote, a tracked default branch, a clean starting tree, and a neutral Git identity.
- A real recording starts agents and uses the configured model service. Review the frames before sharing outputs.

## Checks

Run `python3 checks/check-tape-waits.py` to ensure none of the tape's `Wait` expressions can match text entered by a `Type` command.

The other scripts under `checks/` exercise setup, configuration, skill input, and worker launch. Their temporary captures go under `out/checks/`; do not include generated output in source control.
