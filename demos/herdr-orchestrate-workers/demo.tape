Output "/out/herdr-orchestration-demo-raw.mp4"
Set Width 1440
Set Height 900
Set FontSize 18
Set FontFamily "RobotoMono Nerd Font Mono, Noto Sans Mono CJK JP"
Require bash
Require herdr
Require claude
Require codex

# Setup and credentials stay out of the recording. The script never prints secret data.
Hide
Type "source /opt/demo/prepare-demo.sh"
Enter
Wait+Screen@180s /DEMO_SETUP_READY/
Type "clear"
Enter
Type "python3 /opt/demo/mark-timing.py capture_started /out/timing.log"
Enter
Type "herdr --session demo"
Enter
Wait+Screen@90s /Claude Code v[0-9.]+/
Type "python3 /opt/demo/mark-timing.py video_start /out/timing.log"
Enter
Show
Type "/shunk031-herdr-orchestrate-workers Codex worker を model_reasoning_effort=low で起動して hello.txt を作らせて"
Enter
Sleep 8m
