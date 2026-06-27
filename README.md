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
