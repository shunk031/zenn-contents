Output "/out/herdr-orchestration-demo-split-raw.mp4"
Set Width 2400
Set Height 1080
Set FontSize 18
Set FontFamily "RobotoMono Nerd Font Mono, Noto Sans Mono CJK JP"
# Keep the split client visible in the normal screen buffer; see https://code.claude.com/docs/en/fullscreen.md.
Require bash
Require herdr
Require claude
Require codex

# Setup and credentials stay out of the recording. The script never prints secret data.
Hide
Type "export CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1 && source /opt/demo/prepare-demo.sh && clear && python3 /opt/demo/mark-timing.py capture_started /out/timing-split.log && herdr --session demo"
Enter
Sleep 30s
Type "python3 /opt/demo/mark-timing.py video_start /out/timing-split.log"
Enter
Show
Type "/shunk031-herdr-orchestrate-workers 今のタブを縦に分けて、右側で Codex worker を model_reasoning_effort=low で起動して hello.txt を作らせて。worker には終わったら親にプロンプトで DONE を報告させて、報告が届いたら右のペインを閉じて"
Enter
Sleep 8m
