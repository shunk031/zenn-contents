---
title: "herdr で複数のエージェントを対話させるシンプルなスキルの紹介"
emoji: "🤖"
type: "tech"
topics: ["herdr", "codex", "claudecode", "agent"]
published: false
---

こんにちは [@shunk031](https://twitter.com/shunk031) です。この記事は、法政大学理工学部 Advent Calendar 2026 の 12/1 の記事です。12/1、12/2、12/3 の記事は続き物です。

Claude Code や Codex などのコーディングエージェントに別々の作業を頼むと、作業場所や報告のまとめ方も決める必要があります。今回は、作業を worker に分けて依頼し、結果を確かめる流れをまとめた `shunk031-herdr-orchestrate-workers` スキルを紹介します。

# Herdr は作業場所とエージェントをまとめる

[Herdr](https://herdr.dev/tui/docs/concepts/) は、ターミナルを workspace、tab、pane に分けて管理するツールです。workspace はプロジェクトやタスクの作業場所、tab はその中の画面、pane はコマンドやエージェントを動かすターミナルです。Herdr はコーディングエージェントが動く pane を認識し、[エージェントの起動や状態確認](https://herdr.dev/tui/docs/agent-automation/)を扱います。

紹介する [`shunk031-herdr-orchestrate-workers`](https://github.com/shunk031/skills/tree/main/skills/herdr/shunk031-herdr-orchestrate-workers) は、Herdr 上で複数の worker を動かすときの手順を定めたスキルです。依頼する側のエージェントをオーケストレーター、個別のタスクを進めるエージェントを worker と呼びます。スキルは、タスクの分割から worker の起動、報告の確認、成果物の検証までを扱います。

# タスクごとに worker を分けて依頼する

オーケストレーターは、まず依頼を独立したタスクに分けます。各タスクの worker には、それぞれ [Git worktree](https://git-scm.com/docs/git-worktree) と Herdr の tab を割り当てます。Git worktree は、1 つのリポジトリに複数の作業ディレクトリを持つ Git の仕組みです。作業場所をタスクごとに分けたうえで、worker を起動します。

worker を起動したら、オーケストレーターは Herdr の `herdr agent prompt` でタスクを渡します。送信後は、worker の状態が変わったことと、worker が依頼を読んだ記録を確かめます。具体的な作業内容だけでなく、成果物の形式や触れてはいけない範囲もプロンプトに書いておくと、結果を確認しやすくなります。

# 入力欄が空のときだけプロンプトを送る

このスキルでは、エージェント同士のやり取りをプレーンテキストのプロンプトで行います。送信前には、送信先エージェントの画面に表示された入力欄で、プロンプト記号の後ろに文字が残っていないかを確認します。入力欄が空の場合だけ `herdr agent prompt` で送信し、入力中か判断できない場合は送信しません。

この確認を担うのが、スキルに付属する[入力欄の状態を確かめるスクリプト](https://github.com/shunk031/skills/blob/main/skills/herdr/shunk031-herdr-orchestrate-workers/scripts/herdr-agent-prompt-if-input-empty.sh)です。入力中か、状態を判定できない場合はプロンプトを送らず、入力欄の内容を保ちます。

# 報告を受け取ったら成果物と状態を確認する

worker からの報告は、作業の結果や確認が必要なことをオーケストレーターへ伝えます。完了した作業の要約は `DONE`、先へ進むために必要な質問は `BLOCKED`、作業中の段階と完了見込みは `STATUS` として報告します。

worker の報告に加え、Herdr の状態、成果物、Git や pull request の状態を照合して、依頼内容が満たされたかを判断します。成果物を利用者へ渡すときには、独立した確認者による内容レビューも行います。

確認が終わり、その worker に追加の依頼をしないと決めたら、スキルの手順に従って worker の pane を回収します。

# まずは確認しやすいタスクで試す

スキルの導入方法は [`shunk031/skills` の README](https://github.com/shunk031/skills#install) にあります。Herdr 自体の導入は、公式の [Install guide](https://herdr.dev/tui/docs/install/) を参照してください。

初回は、成果物を自分で確認できるタスクを選ぶと、依頼文と検証手順を対応させやすいです。独立して進められる作業を worker に渡し、戻ってきた成果物を依頼内容と突き合わせてみてください。

# まとめと次回予告

このスキルの中心は、worker を起動することだけではありません。作業場所を分け、入力欄を確かめて依頼を送り、報告と成果物を照合してから作業場所を回収します。

12/2 は、この仕組みの上で `agy`（Antigravity CLI）を執筆担当にする日本語執筆スキルを紹介します。Herdr の worker 運用が、文章を書く作業にどうつながるのかを見ていきます。
