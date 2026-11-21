---
title: "herdr で複数のエージェントを対話させるシンプルなスキルの紹介"
emoji: "🐑"
type: "tech"
topics: ["herdr", "ai", "codex", "claudecode", "adventcalendar2026"]
published: false
---

こんにちは [@shunk031](https://twitter.com/shunk031) です。本記事は [法政大学理工学部 Advent Calendar 2026](https://adventar.org/calendars/13106) の 1 日目の記事です。

https://adventar.org/calendars/13106

法政大学理工学部のアドベントカレンダーでは、12/1 から 12/3 にかけて 3 日連続でコーディングエージェントの運用に関する続き物の記事を投稿します。全体の予定は次の通りです。

- 12/1: [herdr で複数のエージェントを対話させるシンプルなスキルの紹介](https://zenn.dev/shunk031/articles/herdr-orchestrate-workers-skill)（本記事）
- 12/2: [キモいAI語をagy geminiスキルで一掃するゾォ〜](https://zenn.dev/shunk031/articles/agy-gemini-japanese-skill)
- 12/3: [marp でいい感じに論文紹介スライドを作るぜ](https://zenn.dev/shunk031/articles/marp-paper-reading-slides)

なお、12/7 には単発記事として [世界のレイアウト生成デザイン生成のモデルを全て実装するためのハーネス](https://zenn.dev/shunk031/articles/design-generators-harness) も公開予定です。

普段の開発で Claude Code や Codex などのコーディングエージェントを使っていると、複数の課題を同時に進めたい場面や、調査と実装を切り分けて進めたい場面が増えてきます。しかし、1 つのエージェントセッションにすべての作業を任せると、コンテキストウィンドウがすぐに消費されて判断の精度が落ちたり、同じ作業ディレクトリ内で別々の変更が競合したりします。

作業ごとにエージェントを分けるマルチエージェント運用を組めばこの問題は防げます。しかし、人間が手作業で複数のターミナルを開き、進捗を監視し、出力を別のエージェントにコピーして渡す運用は手間がかかります。

そこで本記事では、ターミナルワークスペースマネージャーである Herdr を使ったマルチエージェント運用を取り上げます。親エージェント（オーケストレーター）が子エージェント（ワーカー）へタスクを振り分け、自律的に対話させるスキル `shunk031-herdr-orchestrate-workers` を紹介します。

https://github.com/shunk031/skills/tree/main/skills/herdr/shunk031-herdr-orchestrate-workers

# Herdr とは

Herdr は、ターミナル上で AI コーディングエージェントの作業スペースを管理するツールです。公式ドキュメントでは「Terminal workspace manager for AI coding agents」と説明されています。[^herdr-doc]

https://herdr.dev/tui/docs/

Herdr では、Git の作業ディレクトリ（git worktree）ごとにターミナルのタブやワークスペースを分離できます。それぞれのタブで動くエージェントの起動、状態取得、終了といったライフサイクルを、コマンドラインインターフェース (Command Line Interface; CLI) から一元管理できます。

`shunk031-herdr-orchestrate-workers` スキルは、この Herdr を基盤として動作します。1 つの親エージェントが複数のワーカーエージェントを立ち上げ、タスクを割り当て、作業の完了や進捗の報告を受け取って検証・調整するための一連の手順とスクリプトを提供します。

# スキルの全体像

このスキルでは、エージェントの責務を親と子で明確に分離します。親であるオーケストレーターはタスクの分解、ワーカーの起動、依頼の送信、受領確認、成果物の検証、外部レビュー、プルリクエスト (Pull Request; PR) のマージ可否判断を担当します。子であるワーカーは、割り当てられた 1 つの独立タスクに集中し、調査、設計、コード実装、テスト、PR 作成などの実作業を担当します。

一連のライフサイクルは、次の 6 つの段階で進みます。

1. 計画と命名: オーケストレーター自身に名前（`orch` など、32 文字以内）を付け、ワーカーにも接頭辞付きの名前（`orch-impl` など）を割り当てる。
2. ワークスペースとワーカーの起動: 独立したタスクごとに Git worktree とタブを用意し、ライフサイクルヘルパー（`herdr-worker-lifecycle.sh launch`）を使ってワーカーを起動する。
3. 依頼送信と受領確認: ワーカーの入力欄が空であることを確認してからプロンプトを送信し、ライフサイクルの状態更新（`state_change_seq` の進捗）と可読な受領応答を確認する。
4. ワーカーの作業と報告: ワーカーは割り当てられた worktree 内で作業し、進捗や結果をオーケストレーター宛てにプレーンテキストで報告する。
5. 成果物の検証と回収: オーケストレーターは報告を鵜呑みにせず、実際のライフサイクル状態やファイル差分、テスト結果、トランスクリプトを直接確認する。
6. 安全な片付け: 検証完了後にワーカーのペイン・タブを回収（`herdr-worker-lifecycle.sh collect`）し、PR マージ後に安全な条件を満たした worktree のみ削除する。

# エージェント同士の対話の仕組み

本記事のタイトルに「シンプル」とある理由の 1 つは、エージェント同士の通信メカニズムが極めて最小限に設計されている点にあります。専用のメッセージブローカーや複雑なリモートプロシージャコール (Remote Procedure Call; RPC) サーバーは使いません。Herdr の標準 CLI である `herdr agent prompt` を使い、相手エージェントにプレーンテキストを送信するだけで対話が成立します。

## 入力欄が空のときだけ送るガード

プレーンテキストを直接送る仕組みは簡潔です。しかし、相手エージェントがコマンドを実行中だったり、入力欄（composer）に未送信の文字が残っていたりする状態でプロンプトを流し込むと、入力中の内容と混ざったりプロンプトが破棄されたりする危険があります。

そのため、送信前に入力欄の状態を判定するヘルパースクリプト `herdr-agent-prompt-if-input-empty.sh` を介して送信します。このスクリプトは、ターミナルの ANSI 表示状態を awk スクリプト（`herdr-visible-input-state.awk`）で解析します。プロンプト記号（`❯`、`›`、または Antigravity CLI の `>`）の後ろが空であると判定されたときだけ、`herdr agent prompt` を呼び出します。

実際の送信判定処理は次のようになっています。

```bash
if [[ "$input_state" == empty ]]; then
    herdr agent prompt "$target" "$message"
    exit $?
fi
```

入力欄が空でない場合は 30 秒待機して再試行し、最大試行回数に達しても空にならなければ送信を取りやめて終了コード 75 で安全に終了します。これにより、最小限の CLI コマンドでありながら安全な通信を担保しています。

## プレーンテキストで送信元を識別する報告プロトコル

`herdr agent prompt` は対象のペインに入力文字列を直接注入するため、送信元のメタデータが付与されません。そのため、ワーカー側からの報告フォーマットには、先頭に自分自身のワーカー名を添える規約を設けています。

ワーカーがオーケストレーターへ送る報告は、用途に応じて次の 3 種類の形式を使います。

```text
DONE <worker-name>: <一言サマリ>
BLOCKED <worker-name>: <進行不能な理由や確認事項>
STATUS <worker-name>: <現在の進捗段階>
```

先頭にワーカー名を明記することで、オーケストレーターは受信したプレーンテキストからどのワーカーの発言かを機械的に判別できます。

# 報告をうのみにしない検証と独立レビュー

マルチエージェント運用で最も警戒すべきなのは、ワーカーの「完了しました」という自己申告を信じてそのままマージしてしまうことです。エージェントがテストの失敗を見落としていたり、要件の一部を満たしていないにもかかわらず完了と報告してしまうケースは珍しくありません。

このスキルの中心原則には "Evidence over reports"（報告より証拠）が定められています。

オーケストレーターは、ワーカーから `DONE` 報告が届いてもそれだけで完了とは判断しません。Herdr 上のライフサイクル状態（`herdr agent wait` が settle したか）、ワーカーの実行トランスクリプト、git diff、生成された成果物ファイル、テストの成否といった客観的な証拠を直接検証します。

さらに、成果物の品質を担保するため、作業を担当したワーカーとは別の独立した読み取り専用エージェント（ワンショットの Codex など）を立ち上げてレビューします（`review_pr.py`）。ワーカー自身による自己レビューを排し、第三者の視点で受け入れ基準に適合しているかを検査することで、不完全な変更のすり抜けを防ぎます。

# 使ってみる

`shunk031-herdr-orchestrate-workers` スキルは、筆者の GitHub リポジトリ `shunk031/skills` で公開しています。

https://github.com/shunk031/skills

Vercel Labs が開発している `skills` CLI を使うと、Claude Code や Codex などのエージェント環境へ一括で導入できます。[^skills-cli]

リポジトリ内の全スキルを導入するコマンドは次の通りです。

```bash
npx skills add shunk031/skills --skill '*' --agent claude-code --agent codex --global --yes
```

導入前に利用可能なスキルの一覧を確認したい場合は、`--list` オプションを実行します。

```bash
npx skills add shunk031/skills --list
```

スキルを導入した後は、オーケストレーターエージェントがライフサイクルヘルパーを使ってワーカーを起動できます。

```bash
herdr-worker-lifecycle.sh launch <your-name>-<task> --kind <kind>
```

ワーカーによる実装と検証が完了した後は、オーケストレーターが次のコマンドでワーカーのペインを安全に回収します。

```bash
~/.agents/skills/shunk031-herdr-orchestrate-workers/scripts/herdr-worker-lifecycle.sh collect <worker-name>
```

# まとめと次回予告

本記事では、Herdr 上で複数のコーディングエージェントを協調させるスキル `shunk031-herdr-orchestrate-workers` を紹介しました。

専用のメッセージサーバーを使わずにプレーンテキストの CLI 入力だけで対話し、入力欄の空き判定ガードによって安全な送信を実現しています。また、ワーカーの報告文を鵜呑みにせず、実際のライフサイクル状態やファイル成果物の検証、独立したレビューを挟むことで、エージェント運用の堅牢性を高めています。

明日（12/2）のカレンダー 2 日目では、このオーケストレーション基盤の上で Google の Antigravity CLI（agy）をワーカーとして動かす応用例を紹介します。

記事タイトルは [キモいAI語をagy geminiスキルで一掃するゾォ〜](https://zenn.dev/shunk031/articles/agy-gemini-japanese-skill) です。AI 特有の不自然な日本語表現を一掃する執筆・推敲スキル `shunk031-writing-gemini-japanese` を取り上げます。オーケストレーターと執筆ワーカー、確認役の連携フローを解説しますので、ぜひ続けてご覧ください。

<!-- textlint-disable -->

[^herdr-doc]: Terminal workspace manager for AI coding agents - Herdr https://herdr.dev/tui/docs/
[^skills-cli]: skills - Vercel Labs https://github.com/vercel-labs/skills

<!-- textlint-enable -->
