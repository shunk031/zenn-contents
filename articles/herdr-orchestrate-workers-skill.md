---
title: "herdr で複数のエージェントを対話させるシンプルなスキルの紹介"
emoji: "🐑"
type: "tech"
topics: ["herdr", "claudecode", "codex", "git", "cli"]
published: false
---

# はじめに

こんにちは [@shunk031](https://twitter.com/shunk031) です。本記事は [法政大学理工学部 Advent Calendar 2026](https://adventar.org/calendars/13106) の 1 日目の記事です。

https://adventar.org/calendars/13106

今年のアドベントカレンダーでは、12/1 から 12/3 にかけてコーディングエージェントの運用に関する記事を 3 日連続でお届けします。

- 12/1（本記事）: `herdr-orchestrate-workers-skill`（herdr で複数のエージェントを対話させるシンプルなスキルの紹介）
- 12/2: `agy-gemini-japanese-skill`（キモい AI 語を agy gemini スキルで一掃するゾォ〜）
- 12/3: `marp-paper-reading-slides`（marp でいい感じに論文紹介スライドを作るぜ）

また、少し間を空けて 12/7 には単発記事として `design-generators-harness`（世界のレイアウト生成デザイン生成のモデルを全て実装するためのハーネス）の公開も予定しています。

近年、Claude Code や Codex などのコーディングエージェントが日常の開発環境に定着してきました。しかし、1 つのエージェントに大規模な調査や実装をすべて任せると、コンテキストウィンドウの消費が進んで指示への追従精度が落ちたり、手元の作業ディレクトリでファイルの変更が衝突したりしがちです。設計や調査、実装、テスト、レビューといった独立したタスクを複数のエージェントに分担させ、それらを統括して動かす仕組みが必要になります。

本記事では、コーディングエージェント向けターミナルマルチプレクサである Herdr を用いた連携スキルを紹介します。親エージェント（オーケストレーター）が子エージェント（ワーカー）へ安全にタスクを分散して対話させるスキル `shunk031-herdr-orchestrate-workers` の仕組みを解説します。

# Herdr の概要

Herdr は、コーディングエージェントの操作と管理に特化したターミナルマルチプレクサです。

tmux や iTerm2 のようにターミナルを階層的に管理する仕組みを持ち、最上位のワークスペース (workspace)、その中のタブ (tab)、画面を分割するペイン (pane) というトポロジーを提供します。

Herdr の最大の特徴は、ペイン内で実行されているコーディングエージェントの存在を自動で認識し、その稼働状態を判定・追跡できる点です。エージェントの状態は、待機中を表す `idle`、作業中を表す `working`、承認や質問への回答待ちを表す `blocked`、完了を表す `done`、および未確定の `unknown` というライフサイクル状態として分類されます。

操作はすべて `herdr` コマンドラインインターフェース (Command Line Interface; CLI) 経由で行われます。エージェントの一覧を取得する `herdr agent list` や、プロンプトを投入する `herdr agent prompt` が用意されています。さらに、状態遷移を待機する `herdr agent wait` や、ペイン出力を取得する `herdr pane read` なども利用できます。大半の制御コマンドは JSON 形式で結果を返すため、スクリプトやエージェント自身からの機械的な状態監視が容易です。

# スキルが解く問題と全体像

複数のエージェントを並列に動かす運用では、手動でターミナルを立ち上げてプロンプトを貼り付け、完了を目視で確認する手順を踏むと運用の負担が急増します。また、同一の作業ツリーで複数のエージェントが並行してコードを書き換えると、Git のコンフリクトが頻発します。

さらに問題となるのが「エージェントの自己申告」への過度な依存です。エージェントが「実装が完了しました」と報告しても、実際にはテストが通っていなかったり、依頼と異なるファイルを書き換えていたりすることがあります。

こうした課題を解決するために作成したのが `shunk031-herdr-orchestrate-workers` スキルです。

本スキルでは、全体を統括する親エージェントを「オーケストレーター (orchestrator)」、個別のタスクを担当する子エージェントを「ワーカー (worker)」と位置づけます。オーケストレーターは計画の立案、タスクの割り振り、ワーカーの起動、報告の受信、成果物の客観的検証、後片付けに専念します。実際の実装コードの編集や調査はすべてワーカーが担当し、オーケストレーター自身は直接コードを書きません。

また、ワーカー同士の変更衝突を防ぐため、タスクごとに `git worktree` を割り当てます。`herdr worktree create` コマンドにより、タスク専用のブランチと独立した作業ディレクトリ、および専用のタブを作成し、安全な並列作業環境を確保します。

# エージェント同士の対話の仕組み

エージェント同士の対話には、複雑なリモートプロシージャコールや独自の通信プロトコルは不要です。本スキルでは、`herdr agent prompt` コマンドによるプレーンテキストの送信のみで対話します。

このシンプルな仕組みを安全に運用するために、厳格な「送信規則 (send rule)」を設けています。

相手エージェントの思考中や、ユーザーおよびバックグラウンド処理による文字入力の最中にプロンプトを流し込むと、文字列の混入によって想定外の指示として処理される危険があります。そのため、「相手エージェントの表示上の入力欄が空であるときだけ送信する」というルールを徹底します。

プロンプト送信には専用スクリプト `herdr-agent-prompt-if-input-empty.sh` を使用します。このスクリプトは対象ペインの表示内容を ANSI エスケープシーケンス単位で解析し、プロンプト記号（`❯` や `>`）の直後に未送信の通常文字列が存在しないかを確認します。入力欄が埋まっている場合は 30 秒待機して再確認し、最大 5 回までリトライします。空欄を確認できない場合は送信を中断し、未送信メッセージを安全に出力して終了します。

また、`herdr agent prompt` による送信はプレーンテキストのみで構成され、送信元メタデータが付与されません。そのため、ワーカープロトコル (worker protocol) では報告メッセージの先頭に発信者のワーカー名を明記する規約を定めています。

- `DONE <worker-name>: <一行要約> <PR URL if any>`: タスクの完了報告（PR を作成した場合のみ URL を付与）
- `BLOCKED <worker-name>: <質問や障害内容>`: 自力で進行できない場合の相談や報告
- `STATUS <worker-name>: <進捗状況>`: 目安時間を超過した場合などの定期進捗報告

この規約により、オーケストレーターは誰からのどのような報告であるかを機械的に判別し、ログやトランスクリプトとの照合を行えます。

# 報告をうのみにしない検証とレビューの原則

本スキルの最も重要な不変条件（Core invariant）が「報告よりも客観的な証拠を優先する (Evidence over reports)」という原則です。

LLM エージェントによる「完了しました」という自己申告をそのまま信用してプルリクエスト (Pull Request; PR) をマージまたは公開してはいけません。オーケストレーターは次の 3 段階で確認します。

第 1 に、Herdr のライフサイクル状態の確認です。`herdr agent wait` や `herdr agent get` を使い、エージェントが真に `done` や `idle` の定常状態に遷移したことを Herdr の状態監視から確かめます。

第 2 に、成果物と作業履歴の直接検証です。ワーカーの要約テキストを信じるのではなく、ワーカーがコミットした Git の差分、生成されたファイル、およびエージェントの実行履歴（トランスクリプト）をオーケストレーターが直接読み出し、当初の要求仕様を満たしているかを検証します。

第 3 に、独立したレビューの実施です。PR の作成や公開を伴う重要な変更では、作業を担当したワーカーとは別の文脈で独立したレビュー（`review_pr.py` などの専用スクリプトによる一発レビュー）を実行し、客観的な判定 (`ACCEPT` / `REJECT`) を得ます。

検証が完了したワーカーは、ライフサイクル管理スクリプト `herdr-worker-lifecycle.sh collect` で安全に回収します。また、PR がマージされた後の Git worktree やブランチの削除も、未コミットの変更がないことやコミットの祖先関係を厳密に確認した上で行います。

# スキルの基本的な使い方

オーケストレーターがワーカーを起動し、タスクを完了させるまでの具体的なコマンドの流れを示します。

まず、オーケストレーター自身の名前付けとタブを設定します。

```bash
herdr agent rename "$HERDR_PANE_ID" orch
herdr tab rename "$HERDR_TAB_ID" "🤖 Orchestrator"
```

次に、タスク用の独立した worktree とワークスペースを作成します。

```bash
herdr worktree create \
  --cwd "$PWD" \
  --branch feature/add-metrics \
  --base origin/main \
  --label "WIP add-metrics" \
  --no-focus
```

作成されたワークスペース内に、ライフサイクル管理スクリプトを使ってワーカーを起動します。

```bash
~/.agents/skills/shunk031-herdr-orchestrate-workers/scripts/herdr-worker-lifecycle.sh launch \
  orch-worker-1 \
  --kind codex \
  --workspace <workspace-id> \
  --cwd <worktree-path> \
  --label "🚧 add-metrics" \
  --task add-metrics \
  --root-pane <root-pane-id> \
  -- <agent-args...>
```

ワーカーが待機状態になったら、入力欄の空きを確認するスクリプトを経由してタスク指示を送信します。

```bash
task_prompt="You are Herdr worker orch-worker-1 in worktree <worktree-path>..."
~/.agents/skills/shunk031-herdr-orchestrate-workers/scripts/herdr-agent-prompt-if-input-empty.sh orch-worker-1 "$task_prompt"
```

送信後は `herdr agent wait` でワーカーの作業完了を待ちます。作業完了を検知したら成果物とトランスクリプトを検証し、問題がなければワーカーを回収します。

```bash
herdr agent wait orch-worker-1
# 成果物とログの検証後、安全に回収
~/.agents/skills/shunk031-herdr-orchestrate-workers/scripts/herdr-worker-lifecycle.sh collect orch-worker-1
```

# まとめと次回予告

本記事では、Herdr 上で複数のコーディングエージェントを協調させるスキル `shunk031-herdr-orchestrate-workers` の全体像と仕組みを紹介しました。

Herdr のプロセス・エージェント管理機構の上で、プレーンテキストと入力欄の空き判定という最小限のルールを設けることで、シンプルかつ堅牢なエージェント間対話を実現できます。単一エージェントにすべてを抱え込ませず、独立した worktree でワーカーを走らせます。オーケストレーターが証拠に基づいて検証する体制を整えることで、並列開発の生産性と信頼性を高められます。

明日 12/2 のアドベントカレンダー 2 日目では、この Herdr オーケストレーションを応用した実践例を紹介します。具体的には、`agy-gemini-japanese-skill`（キモい AI 語を agy gemini スキルで一掃するゾォ〜）を取り上げます。

https://zenn.dev/shunk031/articles/agy-gemini-japanese-skill

Antigravity CLI (agy) の Gemini モデルをワーカーとして起動し、AI が生成しがちな不自然な日本語や過剰な修飾を客観的に推敲・レビューする日本語執筆スキルの仕組みについて解説します。ぜひ明日もご覧ください。
