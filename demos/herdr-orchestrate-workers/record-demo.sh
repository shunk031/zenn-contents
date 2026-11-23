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
        ;;
    *)
        printf '%s\n' 'The variant must be "default" or "split".' >&2
        exit 2
        ;;
esac

export DEMO_VARIANT="$variant"
vhs "$tape"
python3 "$postprocessor" /out
