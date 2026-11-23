#!/usr/bin/env bash
# @file .agents/demo/record-demo.sh
# @brief Record the VHS tape and speed up its final media outputs.
# @description
#   VHS retains the raw capture. The hidden watcher normalizes spinner glyphs
#   and elapsed timers, then marks a nonempty combined root/worker screen idle after two
#   seconds without another visible content change. Agent thinking/waiting in
#   those intervals is intentionally compressed; content-changing stretches
#   stay at normal speed. Herdr tab-closure state sets the final cut point only.

set -Eeuo pipefail

vhs /opt/demo/demo.tape
python3 /opt/demo/postprocess-video.py /out
