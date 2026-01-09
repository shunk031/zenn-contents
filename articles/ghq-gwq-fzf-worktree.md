---
title: "コーディングエージェントにやさしい環境は、人間にも優しかった ghq × gwq × fzf のススメ"
emoji: "🤖"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["git", "ghq", "gwq", "fzf", "claudecode"]
published: true
published_at: 2026-01-09
---

こんにちは [@shunk031](https://twitter.com/shunk031) です。業務や趣味に `git clone` 等でレポジトリが増えると、どこに clone したか・どこで作業しているかが分かりにくくなり、`cd` や補完に時間を取られがちですよね。さらに開発のためにブランチを切ったり、Pull Request のレビューのために別ブランチをチェックアウトしたりすると、切り替えや stash の手間がどんどん増えます。私はよくブランチの切り替えをミスってコンフリクトを起こしたり、変更を失いかけたりしています。

こうした問題は Claude Code や Codex のようなコーディングエージェントを使い始めると更に露呈します。複数タスクを並列に走らせるほど、作業ディレクトリが 1 つだと衝突しやすいからです。コーディングエージェントなんてなんぼでもしばきたいですよネ。

本記事では、以下の 3 つのツールを組み合わせて日々の開発をさらに効率的にする方法を紹介します。もちろんコーディングエージェントは使いましょう。

- [`ghq`](https://github.com/x-motemen/ghq) で clone の置き場所を揃える（レポジトリが増えても破綻しない）
- [`gwq`](https://github.com/d-kuro/gwq) で git worktree 運用をラクにする（並列作業が前提になる）
- [`fzf`](https://github.com/junegunn/fzf) でディレクトリ間の移動を最短化する（一覧 → 曖昧検索 → 即ジャンプ）

# なぜ git worktree がコーディングエージェントと相性が良いのか

[git worktree](https://git-scm.com/docs/git-worktree) は、1 つのリポジトリに対して複数の作業ディレクトリ（worktree）を持てる仕組みです。Git 公式ドキュメントでも「main worktree と linked worktree」を整理し、不要になった linked worktree は git worktree remove で片付ける、と明確に説明されています。[^1]

これがコーディングエージェントと相性が良い理由は単純で、作業場（ディレクトリ）が分離されるからです。

- タスク A を worktree A で進める
- タスク B を worktree B で進める
- それぞれにエージェントを起動しても、同じレポを取り合わない

Anthropic のベストプラクティスでも、worktree によって複数の Claude セッションを同時に動かす運用が紹介されています。[^2]

# 本記事で紹介するツール群

## `ghq`：clone の置き場所を標準化する

https://github.com/x-motemen/ghq

ghq はリモートレポジトリの clone を整理する CLI ツールで、`host/owner/repo` のように root 配下へ並べる思想です。`ghq list` コマンドで手元に clone されているレポジトリの一覧を出せるので、後述する `fzf` コマンドと繋ぐとレポジトリ間を行き来できる UI になります。`ghq list --full-path` コマンドでフルパスを出して `fzf` と組み合わせる例も、ghq の著者らが公開しているハンドブックに載っています。[^3]

## `fzf`：あらゆる一覧を “選べる UI” にする

https://github.com/junegunn/fzf

fzf はコマンドライン上で動作する、高速でインタラクティブなあいまい検索ツール (fuzzy finder) です。さまざまなコマンドの出力をパイプで受け取り、リアルタイムに絞り込みながら選択できる UI を提供します。

![](https://junegunn.github.io/fzf/images/fzf.gif)

## `gwq`：worktree を “ghq っぽく” 管理する

https://github.com/d-kuro/gwq

`gwq` は worktree を効率的に管理する CLI ツールで、gwq の README でも「[ghq が clone を管理するように、gwq は worktree を管理する](https://github.com/d-kuro/gwq?tab=readme-ov-file#gwq---git-worktree-manager)」と説明されています。fuzzy finder 前提の操作で、作成・切替・削除がしやすい設計です。

![](https://raw.githubusercontent.com/d-kuro/gwq/refs/heads/main/docs/assets/usage.gif)

# `clone` と `worktree` を「同じ root」に集約する

本記事のキモは「**オリジナルのレポジトリと、git worktree の作業ディレクトリを同じ root（例：`~/ghq`）配下に集約することで、 fzf 検索の対象が 1 箇所に揃うので、移動が爆速になる**」点です。以下に具体的な設定方法を示します。

## セットアップ：`ghq` と `gwq` を `~/ghq` に寄せる

### `ghq`：root を `~/ghq` に固定する

ghq 側の root を `~/ghq` に固定します。ghq は git-config による設定を想定しています。

```shell:~/.config/git/config
[ghq]
  root = ~/ghq
```

正しく設定されると、例えば `ghq get github.com/owner/repo` したときに、以下のようなディレクトリ構成になります。

```
~/ghq/
  github.com/
    owner/
      repo/
```

### `gwq`：worktree の `basedir` を `~/ghq` に寄せる

gwq の設定は `~/.config/gwq/config.toml` に置き、`worktree.basedir` や `naming.template` を設定できます。

```shell:~/.config/gwq/config.toml
[naming]
template = '{{.Host}}/{{.Owner}}/{{.Repository}}={{.Branch}}'

[worktree]
basedir = '~/ghq'
```

gwq は [template に Host / Owner / Repository / Branch などの変数が使える](https://github.com/d-kuro/gwq?tab=readme-ov-file#configuration)ことも明記されています（ブランチの sanitize も可能です）。

私は `'{{.Host}}/{{.Owner}}/{{.Repository}}={{.Branch}}'` の形式を採用しています。[`gwq` のデフォルトのように `{{.Branch}}` でディレクトリを分けてしまう](https://github.com/d-kuro/gwq?tab=readme-ov-file#configuration:~:text=template%20%3D%20%22%7B%7B.Host%7D%7D/%7B%7B.Owner%7D%7D/%7B%7B.Repository%7D%7D/%7B%7B.Branch%7D%7D%22)と、ghq で clone したディレクトリの中に worktree が増えてしまい、fzf で探しにくくなるので注意してください。

正しく設定されると、例えば `gwq add feature-branch` したときに、以下のようなディレクトリ構成になります。

```
~/ghq/
  github.com/shunk031/app                # オリジナル（ghq get したもの）
  github.com/shunk031/app=feature-auth   # worktree（gwq）
  github.com/shunk031/app=bugfix-login   # worktree（gwq）
  ...
  github.com/shunk031/infra              # 別レポ（ghq get したもの）
  github.com/shunk031/infra=refactor-tf  # worktree（gwq）
```

### “移動” を作る：ghq + fzf で dev コマンドを持つ

ghq は `ghq list` コマンドで一覧が取れるので、fzf に渡すだけで「移動 UI」になります。`ghq list --full-path` コマンドを使うとフルパス出力もでき、fzf と組み合わせた “瞬時に移動” が可能になります 🥰。

以下は私が使っているコマンドの例です。

```shell
#!/usr/bin/env bash

function ghq-path() {
    ghq list --full-path | fzf
}

function dev() {
    local moveto
    moveto=$(ghq-path)
    cd "${moveto}" || exit 1

    # rename session if in tmux
    if [[ -n ${TMUX} ]]; then
        local repo_name
        repo_name="${moveto##*/}"

        tmux rename-session "${repo_name//./-}"
    fi
}
```

この `dev` コマンドを実行すると、ghq 配下のレポジトリ一覧が fzf で出てきて、選ぶと即座に `cd` します。さらに tmux セッション内であればセッション名もレポジトリ名に変わるので、ターミナルの切り替えも楽になります。

# まとめ：集約して、選んで、並列に回す

本記事では `ghq` + `gwq` + `fzf` の組み合わせで clone してくるレポジトリを整理して素早く移動可能にし、さらに並列でコーディングエージェントを快適に動かす方法を紹介しました。
`ghq` により作業ディレクトリを一元管理し、`gwq` により worktree の管理を簡素化し、`fzf` により迅速な移動を実現します。これらのツールを組み合わせることで、複数のタスクやコーディングエージェントを同時に扱う際の混乱を避け、生産性を向上させることができます。ぜひ試してみてください！

<!-- textlint-disable -->

[^1]: Git - git-worktree Documentation https://git-scm.com/docs/git-worktree
[^2]: Claude Code Best Practices \ Anthropic https://www.anthropic.com/engineering/claude-code-best-practices#:~:text=c.%20Use%20git%20worktrees
[^3]: ghq-handbook/ja/05-command-list.md at master · Songmu/ghq-handbook https://github.com/Songmu/ghq-handbook/blob/master/ja/05-command-list.md

<!-- textlint-enable -->
