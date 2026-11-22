# Zenn の記事を管理するレポジトリ

![zenn-contents](https://socialify.git.ci/shunk031/zenn-contents/image?custom_language=VSCode&description=1&font=Source+Code+Pro&language=1&name=1&owner=1&pattern=Signal&theme=Auto)

[![textlint](https://github.com/shunk031/zenn-contents/actions/workflows/textlint.yaml/badge.svg)](https://github.com/shunk031/zenn-contents/actions/workflows/textlint.yaml)
[![zenn-dev/zenn-editor](https://img.shields.io/github/v/tag/zenn-dev/zenn-editor?color=3EA8FF&display_name=release&label=zenn&logo=zenn&logoColor=3EA8FF&sort=semver)](https://github.com/zenn-dev/zenn-editor)

VSCode で本レポジトリを開くと devcontainer で執筆環境が立ち上がります。

- [📘 How to use](https://zenn.dev/zenn/articles/zenn-cli-guide)

## Setup

```shell
mise install
lefthook install
```

`lefthook install` を実行すると、commit 前に textlint と記事の style audit が走ります。

or you can use `devcontainer` without mise.

### 記事を書くエージェント用のスキル

記事執筆の実行には、[Herdr](https://herdr.dev/tui/docs/install/) と [Google Antigravity CLI](https://antigravity.google/docs/cli) の本体を事前に導入する。

リポジトリとユーザー環境の両方にスキルを入れると同名スキルの扱いがエージェントごとに異なるため、スキルは global に導入する。

記事執筆では以下の 6 つのスキルを使用する。

- `shunk031/skills`: `shunk031-writing-tech-article`, `shunk031-writing-gemini-japanese`, `shunk031-herdr-orchestrate-workers`, `shunk031-writing-router`
- `coji/natural-japanese`: `natural-japanese`
- `herdrdev/herdr`: `herdr`

環境に不足しているスキルがある場合は、以下のコマンドで global に追加する。

```shell
npx skills add shunk031/skills --skill shunk031-writing-gemini-japanese shunk031-herdr-orchestrate-workers shunk031-writing-router --agent codex claude-code antigravity-cli --global --yes
```

```shell
npx skills add shunk031/skills --skill shunk031-writing-tech-article --agent codex claude-code antigravity-cli --global --yes
```

```shell
npx skills add coji/natural-japanese --skill natural-japanese --agent codex claude-code antigravity-cli --global --yes
npx skills add herdrdev/herdr --skill herdr --agent codex claude-code antigravity-cli --global --yes
```

記事の執筆を始める前に、以下のコマンドで 6 つのスキルを最新に更新する。

```shell
npx skills update --global shunk031-writing-tech-article shunk031-writing-gemini-japanese shunk031-herdr-orchestrate-workers shunk031-writing-router natural-japanese herdr
```

## Commands

```shell
make exec # to enter the devcontainer
```

```shell
make textlint # to check the article
```

```shell
make preview # to render the article
```
