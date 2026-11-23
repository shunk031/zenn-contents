Output "/out/skill-input-dry.mp4"
Set Width 1440
Set Height 900
Set FontSize 18
Set FontFamily "RobotoMono Nerd Font Mono, Noto Sans Mono CJK JP"
Require bash
Require herdr
Require claude

Hide
Type "source /opt/demo/prepare-demo.sh"
Enter
Wait+Screen@180s /DEMO_SETUP_READY/
Type "clear"
Enter
Type "herdr --session demo"
Enter
Wait+Screen@90s /\/demo\/repo/
Show
Type "/shunk031-herdr-orchestrate-workers"
Wait+Screen@30s /dispatch parallel worker agents/
Type " worker に今日の日付を YYYY-MM-DD 形式で書いた hello.txt を作らせて、自分で確認して worker を閉じて。Codex は -c model_reasoning_effort=low で起動して。"
Wait+Screen@30s /worker に今日の日付を YYYY-MM-DD 形式で書いた hello\.txt/
Sleep 2s
