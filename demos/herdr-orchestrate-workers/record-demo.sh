#!/usr/bin/env bash
# @file demos/herdr-orchestrate-workers/record-demo.sh
# @brief Record and post-process one selected VHS demo variant.
# @description
#   VHS retains the raw capture. The selected postprocessor writes the final MP4 and GIF.

set -Eeuo pipefail

variant="${1:-default}"
case "$variant" in
    default)
        tape=/opt/demo/demo.tape
        postprocessor=/opt/demo/postprocess-video.py
        ;;
    split)
        tape=/opt/demo/demo-split.tape
        postprocessor=/opt/demo/postprocess-split-video.py
        finished_marker=/out/finished-split
        watcher_pid_file=/out/timing-watcher-split.pid
        ;;
    *)
        printf '%s\n' 'The variant must be "default" or "split".' >&2
        exit 2
        ;;
esac

export DEMO_VARIANT="$variant"
vhs "$tape"
if [[ "$variant" == split ]]; then
    if [[ ! -s "$watcher_pid_file" ]]; then
        printf '%s\n' 'The split timing watcher did not provide a process ID.' >&2
        exit 1
    fi
    watcher_pid="$(< "$watcher_pid_file")"
    while [[ ! -s "$finished_marker" ]]; do
        if ! kill -0 "$watcher_pid" 2>/dev/null; then
            printf '%s\n' 'The split timing watcher exited before it reported completion.' >&2
            exit 1
        fi
        sleep 0.5
    done
    watcher_result="$(< "$finished_marker")"
    if [[ ! "$watcher_result" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$ ]]; then
        printf '%s\n' 'The split timing watcher did not record parent idle after worker removal.' >&2
        exit 1
    fi
    rm -f "$watcher_pid_file"
fi
python3 "$postprocessor" /out
