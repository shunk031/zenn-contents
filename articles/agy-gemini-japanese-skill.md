---
title: "キモいAI語をagy geminiスキルで一掃するゾォ〜"
emoji: "🧹"
type: "tech"
topics: ["gemini", "herdr", "claudecode", "codex", "automation"]
published: false
---

こんにちは [@shunk031](https://twitter.com/shunk031) です。本記事は [法政大学理工学部 Advent Calendar 2026](https://adventar.org/calendars/13106) の 2 日目の記事です。

昨日の 1 日目の記事では、tmux 上で複数のエージェントを対話させるツールである Herdr と、その上で並行作業をオーケストレーションする `shunk031-herdr-orchestrate-workers` スキルを取り上げました。[^herdr_article] Claude Code や Codex などのコーディングエージェントを実務に導入すると、実装や調査の並行処理が進みます。その一方で、プルリクエスト (Pull Request; PR) の本文やコミットメッセージ、ドキュメントといった日本語テキストの作成において独特の課題に直面します。

コーディングエージェントにそのまま日本語を書かせると、中身のない定型表現や抽象的な名詞句が混ざり、人間が手作業で推敲し直すコストがかさみがちです。本記事では、こうした文章を「キモい AI 語」と呼びます。対策として、親エージェント自身には日本語を書かせません。Antigravity CLI (agy) を介して Gemini ワーカーに執筆とレビューを任せる `shunk031-writing-gemini-japanese` スキルを紹介します。[^gemini_skill]

# キモい AI 語の特徴

コーディングエージェントが日本語を出力するとき、文法的な破綻はないものの、文章として不自然な表現が頻繁に現れます。

具体的には、執筆スキルや関連ドキュメントにおいて以下のようなパターンが挙げられています。[^gemini_skill][^gemini_evals][^article_guidelines]

- 抽象名詞句の連続: たとえば「〜の確立」や「〜による〜の実証」のように、具体的な操作や対象を曖昧にした抽象名詞句を重ねる表現。[^gemini_skill][^gemini_evals]
- 根拠のない安心表現: たとえば「安心のサポート」のように、不要に読み手を安心させようとする修飾句。[^gemini_skill][^gemini_evals]
- 本人の語彙や判断の歪曲: 元資料の「案 A を試してみたい」という希望を「案 A を実施する」と勝手に確定させたり、「割合は 5%?」という未確定の数値を「割合は 5%」と断定したり、書かれていない手段や理由を付け足す改変。[^gemini_skill][^gemini_evals]
- 未定義の略語や不自然な階層: 説明のない略語を唐突に出したり、隣接する節と整合しない平坦で長い同階層の箇条書きを並べたりする構成。[^gemini_skill][^gemini_evals]
- 手順書のような曖昧な語尾: 筆者の判断や技術的な関係ではなく、動作の主体が不明なまま説明をつなぐ定型句。[^article_guidelines]

これらの表現が含まれると、筆者の意図や事実関係が覆い隠され、読み手が内容の妥当性を検証しにくくなります。

# なぜ日本語の執筆を別のモデルに任せるか

Claude Code や Codex はコードベースの走査や実装タスクに長けています。しかし、日本語の成果物を直接書かせると、前述のような定型表現や過剰な断定が生じやすくなります。

一方で、Google の Gemini シリーズは日本語の文脈理解やニュアンスの制御に強みを持っています。そこで `shunk031-writing-gemini-japanese` スキルでは、実装を担当する親エージェントは自ら日本語を書きません。その代わりに、日本語成果物の作成を agy 経由で起動した Gemini ワーカーへ委任する方針を採っています。[^gemini_skill]

この委任において、不要なコマンド実行を防ぐ安全策がワーカーの権限設定です。起動するすべての agy ワーカーに対して、シェルコマンドの実行を拒否する設定を指定します。[^gemini_skill]

```json
{"permissions": {"deny": ["command(*)"]}}
```

ただし、この設定で防げるのはテストやスクリプトなどのシェルコマンド実行のみです。シェルを拒否しても agy のファイル読み書きツールは利用できるため、権限設定だけでファイルの改変やコード記述を防げるわけではありません。そのため本スキルでは、シェル拒否の設定とあわせて、指示と出力先の限定によって作業範囲を絞っています。具体的には、プロンプトで「日本語成果物の執筆またはレビューのみを行わせ、プログラムコード自体を書かせない」と指示し、呼び出し元が出力先ファイルパスを定めて作業させます。[^gemini_skill]

# スキルの処理フロー

`shunk031-writing-gemini-japanese` スキルでは、品質を安定させるために明確な工程を定めています。[^gemini_skill]

## 1. 準備と作業用ブリーフ

外部読者向けの文書を新規作成または構成変更する場合、下書きの前に呼び出し元自身が作業用ブリーフを作成します。[^gemini_skill] ブリーフは執筆準備のための内部資料であり、以下の項目を定義します。

- 想定読者
- 読者の判断または行動
- 根拠付き必須要件 3〜5 点（各要件を直接裏づける根拠資料を指定）
- 意図的に除外する事項
- 構成

必須要件を直接裏づける根拠資料が不足している場合は、下書きを直ちに停止し、利用者に資料提供を求めます。根拠の捏造や無断省略は厳禁とされています。[^gemini_skill]

## 2. 執筆ワーカーによる下書き作成

ブリーフ作成後、Herdr で専用タブを開き、シェルコマンドを拒否する設定で agy 執筆ワーカーを起動します。[^gemini_skill][^herdr_workers]

ワーカーは `shunk031-writing-router` スキルに従って担当スキル（構成から整理する `natural-japanese` や端的にまとめる `tanteki` など）を選定・適用します。[^gemini_skill][^writing_router] すべての主張や数値は元資料の裏づけを必要とし、共通チェックリストに基づいて抽象名詞句の回避や本人の語彙・意図の保持が行われます。[^gemini_skill]

## 3. 機械検査

文章が出力されたら、書式や表記ゆれ、文長制限などの機械的に検証可能な条件をツールで検査します。[^gemini_skill]

機械検査を独立して実行することで、内容レビューの段階で表記や文長といった細かな書式ルールに気を取られるのを防ぎます。

## 4. 1 人の確認役による内容レビュー

機械検査を通過した最終文書に対してのみ、専用タブで起動した 1 人の確認役である agy レビューワーカーが内容を確認します。[^gemini_skill] ブリーフを別個の承認関門にしたり、複数の確認役を重ねて起動したりはしません。[^gemini_skill]

確認役が差し戻し（`REJECT`）とする条件は、以下の 2 点のみに限定されます。[^gemini_skill]

1. 実質的な事実誤り: 捏造や事実・数値の誤り。
2. 読者の具体的誤解: 読者が文章の意味を取り違える具体的な箇所（what / why を伴う具体的な指摘）。

主観的な文体の好みや「本人らしさ」、単なる裏づけ不足、および機械検査で扱える書式や nit（小言）は差し戻し理由に含めません。[^gemini_skill] これは Google レビュアー基準や Codex 基準など、実質的な欠陥に焦点を絞るレビューの知見に基づいています。[^gemini_skill] 差し戻しが発生した場合は指摘箇所のみを執筆担当が修正し、往復は最大 2 回までと定められています。[^gemini_skill]

## 5. 承認記録と納品

機械検査の通過と確認役による `ACCEPT` が揃った段階で、呼び出し元は承認記録を残します。[^gemini_skill]

承認記録では、承認されたファイルの絶対パスをもとに SHA-256 ハッシュ値と UTC タイムスタンプを算出し、`~/.local/state/agy-japanese/accepted.tsv` に追記します。[^gemini_skill] この記録をもって納品条件の達成とみなします。

# 使ってみる

実際に Herdr と agy を組み合わせてワーカーを起動する際の流れです。

オーケストレーターは Herdr の CLI を通じて、以下のように執筆ワーカーを起動します。[^gemini_skill]

```bash
herdr tab create --workspace <workspace-id> --label "✍️ agy" --no-focus
herdr agent start <writer-name> --kind agy --pane <root-pane-id> -- --settings '{"permissions":{"deny":["command(*)"]}}' --model gemini-3.8-flash-high
```

ワーカーが起動したら、作業用ブリーフと元資料のパスをプロンプトとして送信します。

執筆とレビューを経て `ACCEPT` となった文書は、以下のスクリプトでハッシュ値とタイムスタンプを記録します。[^gemini_skill]

```bash
(
  set -o pipefail
  FILE="/absolute/path/to/accepted-file"
  [[ -f "$FILE" && -r "$FILE" ]] || exit 1
  HASH="$(perl -0777 -e '$_ = <STDIN> // ""; s/\r\n/\n/g; s/\n*\z/\n/; print' < "$FILE" | shasum -a 256 | cut -d ' ' -f 1)" || exit 1
  [[ "$HASH" =~ ^[0-9a-f]{64}$ ]] || exit 1
  STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)" || exit 1
  mkdir -p "$HOME/.local/state/agy-japanese" || exit 1
  printf '%s\t%s\t%s\n' "$STAMP" "$HASH" "$FILE" \
    >> "$HOME/.local/state/agy-japanese/accepted.tsv"
)
```

この手順により、エージェントが作成した日本語成果物について、適切な検証を経て承認された状態を客観的に管理できます。

# まとめと次回予告

コーディングエージェントに実装から日本語の作成までを一括で任せると、過剰な装飾や抽象的な表現が混入しやすくなります。しかし、親エージェントは全体の進行とコードに専念し、シェル実行を拒否しつつ指示と出力先を限定した agy ワーカーへ日本語の執筆とレビューを委任することで、不要なコマンド実行を避けながら自然な文章を生成できます。

明日の 3 日目は、アドベントカレンダーの続きとして `marp-paper-reading-slides`「marp でいい感じに論文紹介スライドを作るぜ」をお届けします。[^marp_article] 今回の日本語作成スキルや骨子作成スキルと組み合わせて、Marp による論文紹介スライドを手早く作成する手順を解説する予定です。

<!-- textlint-disable -->

[^herdr_article]: [herdr で複数のエージェントを対話させるシンプルなスキルの紹介](https://zenn.dev/shunk031/articles/herdr-orchestrate-workers-skill)
[^marp_article]: [marp でいい感じに論文紹介スライドを作るぜ](https://zenn.dev/shunk031/articles/marp-paper-reading-slides)
[^gemini_skill]: .agents/sources/skills/skills/writing/shunk031-writing-gemini-japanese/SKILL.md
[^gemini_evals]: .agents/sources/skills/skills/writing/shunk031-writing-gemini-japanese/evals/evals.json
[^writing_router]: .agents/sources/skills/skills/writing/shunk031-writing-router/SKILL.md
[^herdr_workers]: .agents/sources/skills/skills/herdr/shunk031-herdr-orchestrate-workers/SKILL.md
[^article_guidelines]: docs/article-editing-guidelines.md

<!-- textlint-enable -->
