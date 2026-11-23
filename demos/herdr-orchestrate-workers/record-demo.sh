#!/usr/bin/env bash
# @file .agents/demo/record-demo.sh
# @brief Record the VHS tape and speed up its final media outputs.
# @description
#   VHS retains the raw capture. FFmpeg accelerates only stretches whose
#   rendered terminal content stayed visually unchanged, then creates a GIF.

set -Eeuo pipefail

vhs /opt/demo/demo.tape
python3 /opt/demo/postprocess-video.py /out
