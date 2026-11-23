Output "/out/setup-check.gif"
Output "/out/setup-check.mp4"
Set Width 1440
Set Height 900
Set FontSize 18
Require bash
Require herdr
Require claude
Require codex

Hide
Type "export DEMO_DRY_RUN=1; source /opt/demo/prepare-demo.sh; unset DEMO_DRY_RUN"
Enter
Wait+Screen@120s /DEMO_SETUP_READY/
Type "clear"
Enter
Type "herdr --session demo"
Enter
Wait+Screen@60s /\/demo\/repo/
Show
Sleep 1s
