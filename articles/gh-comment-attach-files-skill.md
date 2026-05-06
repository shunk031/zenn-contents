---
title: "コーディングエージェントの生成結果を GitHub に集約する gh-comment-attach-files スキル"
emoji: "📎"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["github", "playwright", "codex", "claudecode", "automation"]
published: true
---

こんにちは [@shunk031](https://twitter.com/shunk031) です。みなさんは、コーディングエージェントに実験やデバッグを任せたあと、出てきたログや png などの画像ファイルをどう扱っているでしょうか。

コーディングエージェントは作るところまでは速いです。でも、その後が地味に面倒です。ローカルに成果物が散らばったままだと、自分でも見比べにくい。PR や Issue にまとまっていると人間が見返しやすいのに、そこへ載せるところだけ手作業であることが多いです。調査メモやレビューコメントと同じ場所に置いておけると、あとから流れを追いやすくなります。

この地味な作業を埋めるために、`gh-comment-attach-files` というスキルを作って [dotfiles](https://zenn.dev/shunk031/articles/testable-dotfiles-management-with-chezmoi) で管理しています。普段は Codex を使っていますが、同じ発想のスキルや補助スクリプトは Claude Code でも応用しやすいと思っています。

https://zenn.dev/shunk031/articles/testable-dotfiles-management-with-chezmoi

本記事では、このスキルが何をするものかと、どういう場面で効くかを紹介します。公開している実体は [`dotfiles` 内の `gh-comment-attach-files`](https://github.com/shunk031/dotfiles/tree/master/home/dot_config/exact_agents/skills/gh-comment-attach-files) です。以下、仕様の起点になる [`SKILL.md`](https://github.com/shunk031/dotfiles/blob/master/home/dot_config/exact_agents/skills/gh-comment-attach-files/SKILL.md) を中心に紹介していきます。

https://github.com/shunk031/dotfiles/tree/master/home/dot_config/exact_agents/skills/gh-comment-attach-files

# `gh-comment-attach-files` スキルとは

本スキルでやっていることは、GitHub の Issue / PR コメント欄にローカルファイルを添付し、GitHub にホストされた URL だけを回収することです。とてもシンプルです。

本スキルで参照される `SKILL.md` の概要は、以下のような形です。

```markdown
---
name: gh-comment-attach-files
description: Attach local files to a GitHub issue or pull request comment and return hosted attachment URLs without submitting the comment.
---

## Workflow

1. Resolve the target page from `--url` or `gh`
2. Attach local files in the comment composer
3. Return hosted URLs as JSON

## Prerequisites

- `npx @playwright/cli`
- `gh` (when resolving the target from repo metadata)

## Command

uv run python ~/.agents/skills/gh-comment-attach-files/scripts/attach_comment_files.py \
  --url https://github.com/OWNER/REPO/pull/123 \
  docs/report.md assets/chart.png
```

前提として、`npx @playwright/cli` が使えることと、`gh` を使って対象の PR / Issue を特定する場合は `gh` が認証済みであること、の 2 点が必要です。会社で GitHub Enterprise などを使っていて SSO が必要な場合でも、スキルから呼ばれたスクリプトでブラウザが立ち上がるので、その場でログインできます。

スキルの中では [`attach_comment_files.py`](https://github.com/shunk031/dotfiles/blob/master/home/dot_config/exact_agents/skills/gh-comment-attach-files/scripts/attach_comment_files.py) を呼び出して、コメント欄にファイルを添付し、そこで発行された URL だけを拾います。実行したスクリプトから返ってくる JSON は例えばこんな形です。

```json
{
  "target_url": "https://github.com/OWNER/REPO/pull/123",
  "attachments": [
    {
      "source_path": "/abs/path/results/chart.png",
      "staged_name": "chart--e5b6d4a1.png",
      "attachment_url": "https://github.com/user-attachments/assets/..."
    }
  ]
}
```

この `attachment_url` が取れると、今回のように PR description やコメントへ画像をそのまま差し込めます。調査メモからリンクしたり、エージェントへ「この URL 群を見て比較して」と渡したりもしやすくなります。

たとえば今回の記事でも、このスキルを使って PR description にスクリーンショットを差し込みました。実際には次のように、概要の下へそのまま実例画像を置けます。

![`gh-comment-attach-files` で PR description にスクリーンショットを添付した例](/images/gh-comment-attach-files-skill/pr-description-example.png)

https://github.com/shunk031/zenn-contents/pull/19

# どういう場面で効くか

私が特に便利だと思っているのは次のような場面です。

- 画像ファイルや UI 差分の結果を PR に並べて比較したいとき
- デバッグ用のスクリーンショットやログを Issue に残したいとき
- ベンチマーク結果や検証ログを補足資料として共有したいとき
- エージェントが出した成果物を PR / Issue の文脈に回収して、調査メモやレビューコメントと一緒に残したいとき

ここでのポイントは、単に「添付できる」ことではありません。Issue / PR 単位で結果がまとまり、議論や差分と同じ場所に残ることです。大量の生成結果を見るのはそれだけでしんどいので、あとから探しやすい場所に寄せておく価値が大きいと感じています。

# gh CLI のコメントコマンド vs. Playwright CLI

GitHub 公式ドキュメントでは、Issue / PR のコメント欄にファイルを添付すると、その場で GitHub へアップロードされ、テキスト欄に anonymized URL が入ると説明されています。[^1] 2026/04 現在の公式マニュアルを見る限り、`gh issue comment` や `gh pr comment` は body / body-file を受けるコメント投稿コマンドです。ファイル添付そのものを直接扱う前提のコマンドではありません。[^2][^3]

「コメント投稿まではしたくないが、GitHub が発行する URL は欲しい」という用途では、コメント欄の挙動をそのまま使うのが一番素直でした。`gh-comment-attach-files` はその部分だけを Playwright CLI で触っています。

近い発想の公開ツールとして、[`atani/gh-attach`](https://github.com/atani/gh-attach) もあります。こちらは画像ファイルのアップロード向け CLI / `gh` extension で、Playwright ベース、GitHub.com / GHE 対応、`--url-only` もあります。自分の `gh-comment-attach-files` はそれを置き換えるというより、エージェント運用の中で画像ファイルやログを GitHub へ運ぶためのローカルスキル、という位置づけで使っています。

https://github.com/atani/gh-attach

# まとめ

エージェントは成果物をどんどん作ってくれます。でも、PR や Issue に持っていく導線は意外と人力のまま残りがちです。`gh-comment-attach-files` は、その最後の 1 手だけを埋めるための小さなスキルです。

地味な道具ですが、生成結果を GitHub の文脈に回収しておけると、人が見返しやすくなります。後から走らせるエージェントにも渡しやすい。作るところだけでなく、運ぶところも整えておくとだいぶ楽です。

<!-- textlint-disable -->

[^1]: Attaching files - GitHub Docs https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files
[^2]: gh issue comment - GitHub CLI https://cli.github.com/manual/gh_issue_comment
[^3]: gh pr comment - GitHub CLI https://cli.github.com/manual/gh_pr_comment

<!-- textlint-enable -->
