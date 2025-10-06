---
title: "テスト可能な dotfiles 管理：chezmoi で実現する開発環境構築"
emoji: "🏠️"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["dotfiles", "chezmoi", "bats", "githubactions"]
published: true
published_at: 2025-10-05
---

本記事では、筆者の dotfiles リポジトリ [shunk031/dotfiles](https://github.com/shunk031/dotfiles) を題材に、テスト可能性を重視した dotfiles 管理のアプローチについて解説します。

https://github.com/shunk031/dotfiles

## はじめに

### dotfiles と dotfiles リポジトリ

dotfiles とは、`.bashrc`、`.vimrc`、`.gitconfig` などの「`.`」で始まる設定ファイル群のことです。近年、これらを Git リポジトリで管理する [dotfiles リポジトリ](https://awesomeopensource.com/projects/dotfiles) が開発者の間で広く普及しています。

https://awesomeopensource.com/projects/dotfiles
https://qiita.com/yutkat/items/c6c7584d9795799ee164

dotfiles リポジトリは単なる設定ファイルの管理ではなく、設定ファイル、インストールやセットアップ用のスクリプトを含む開発環境構築の自動化ツールとして機能することが多いです。これにより、新しいマシンや環境でのセットアップが迅速かつ一貫して行えるようになります。

### テストされないスクリプトの問題

ほとんどの dotfiles リポジトリに含まれるセットアップスクリプトやインストールスクリプトは、正しく動作するかテストされていません（つらい）。そのため、新しい環境でセットアップを実行すると様々な問題の発生可能性があります。スクリプトのエラー、依存関係の問題による一部ツールのインストール失敗、OS アップデートによるスクリプト動作不具合などが起こっても、実際に実行するまで問題に気づけません。新しいパソコンや環境を手に入れてルンルンでセットアップを始めたのに、途中でエラーが発生して環境構築が完了しない、というのは非常にストレスフルな体験です。

この品質保証の欠如により、本来は自動化されるべき環境構築が、結果として手動での問題解決とデバッグに多くの時間を費やすことになってしまいます。

### 本リポジトリのアプローチ：テスト可能な構成

上記の問題を解決するため、私の dotfiles リポジトリではテスト可能性を重視したアーキテクチャを構築しています。セットアップスクリプトを独立したファイルとして管理し個別テストを可能にし、[Bats](https://github.com/bats-core/bats-core) による自動テストで品質を担保し、GitHub Actions で macOS ・ Ubuntu 環境での継続的テストとコードカバレッジ計測しています。

dotfiles の管理には [chezmoi](https://www.chezmoi.io/) を採用しています。chezmoi は GitHub 上で高い人気を誇る ([10,000+⭐️](https://github.com/twpayne/chezmoi/stargazers)) 現代的な dotfiles 管理ツールで、Go 製のシングルバイナリのため依存関係がなく簡単にインストールできます。

https://github.com/twpayne/chezmoi
https://www.chezmoi.io/

新しいマシンでの環境構築は、chezmoi の公式インストーラーを使用して以下の非常に簡単なワンライナーで実行できます[^1]。

```shell
sh -c "$(curl -fsLS get.chezmoi.io)" -- init --apply $GITHUB_USERNAME
```

環境固有の設定は Go の `text/template` をベースとした chezmoi のテンプレート機能により、以下のように動的生成できます。

```go:.gitconfig.tmpl
[user]                           # テンプレート機能により動的に指定可能
    name = "{{.name}}"           # - ユーザー名
    email = "{{.email}}"         # - メールアドレス etc.
{{- if eq .chezmoi.os "darwin"}} # macOS 固有の設定
[credential]
    helper = osxkeychain
{{- end}}
```

https://www.chezmoi.io/user-guide/templating/

このように、テスト可能な構成によりスクリプトの品質保証を実現し、 chezmoi のテンプレート機能により環境固有設定を柔軟に管理することで、信頼性の高い dotfiles 管理の実現を目指しています。

## アーキテクチャ設計：テスト可能な構成

### レポジトリ構造

本リポジトリでは [`home/`](https://github.com/shunk031/dotfiles/tree/master/home)、[`install/`](https://github.com/shunk031/dotfiles/tree/master/install)、[`tests/`](https://github.com/shunk031/dotfiles/tree/master/tests) の大きく 3 つのディレクトリに分けて、それぞれ dotfiles の管理、環境構築スクリプト、自動テストを独立して管理しています。

```
.
├── ...
│
├── home/                   # chezmoi 管理下の dotfiles
│   ├── dot_bashrc          # - ~/.bashrc として展開される
│   ├── dot_vimrc           # - ~/.vimrc として展開される
│   ├── dot_config/         # - ~/.config/ として展開される
│   └── .chezmoi.yaml.tmpl  # - chezmoi 設定ファイル
│
├── install/                # セットアップスクリプト（テスト可能）
│   ├── common/             # - 共通のインストールスクリプト
│   ├── macos/              # - macOS 固有のスクリプト
│   └── ubuntu/             # - Ubuntu 固有のスクリプト
│
├── tests/                  # Bats による自動テスト
│   ├── install/            # - インストールスクリプトのテスト
│   └── files/              # - chezmoi 展開後のファイルのテスト
│
└── ...
```

### 設計思想

このアーキテクチャの核心は「関心の分離」と「テスト可能性の最大化」にあります。従来の dotfiles リポジトリでは設定ファイルとセットアップスクリプトが混在し、テストが困難でしたが、本構成では各要素を明確に分離しています。

#### `install/` ディレクトリ：スクリプト分離による単体テスト容易性

セットアップスクリプトを chezmoi から独立させることで、個別のテストが可能になります。

- [`install/common/rust.sh`](https://github.com/shunk031/dotfiles/blob/master/install/common/rust.sh): マシン共通で使用するツール (e.g., Rust) のインストール
- [`install/macos/common/brew.sh`](https://github.com/shunk031/dotfiles/blob/master/install/macos/common/brew.sh): macOS 共通で使用する Homebrew のインストール
- [`install/ubuntu/common/misc.sh`](https://github.com/shunk031/dotfiles/blob/master/install/ubuntu/common/misc.sh): Ubuntu 共通で使用するツール (e.g., curl, jq) のインストール

プラットフォーム別の構成により、OS 固有のロジックを分離し、それぞれを独立してテストできます。各スクリプトは単一責任の原則に従い、特定のツールやパッケージのインストールのみを担当します。

#### `home/` ディレクトリ：chezmoi テンプレートと dotfiles

chezmoi の管理下にある実際の dotfiles です。chezmoi 独自のファイル命名規則 [(`dot_` プレフィックス etc.)](https://www.chezmoi.io/user-guide/frequently-asked-questions/design/#why-does-chezmoi-use-weird-filenames) に従い、テンプレート機能を活用します。なお本リポジトリでは [.chezmoiroot](https://www.chezmoi.io/user-guide/advanced/customize-your-source-directory/) ファイルで `home` をソースディレクトリとして指定しています[^2]。

- [`home/dot_zshrc`](https://github.com/shunk031/dotfiles/blob/master/home/dot_zshrc): `~/.zshrc` として展開される
- [`home/dot_config/git/config.tmpl`](https://github.com/shunk031/dotfiles/blob/master/home/dot_config/git/config.tmpl): `~/.config/git/config` として展開される chezmoi テンプレート
- [`home/.chezmoi.yaml.tmpl`](https://github.com/shunk031/dotfiles/blob/master/home/.chezmoi.yaml.tmpl): chezmoi の設定ファイル

`install/` ディレクトリのスクリプトとは独立しており、設定ファイルの配置と環境構築が分離されています。

#### `tests/` ディレクトリ：Bats による自動テスト

Bash Automated Testing System (Bats) を使用して、`install/` ディレクトリのスクリプトをテストします。スクリプトに対応するようにテスト用のディレクトリやファイルを構成することを意識しています。

https://github.com/bats-core/bats-core

- [`tests/install/common/rust.bats`](https://github.com/shunk031/dotfiles/blob/master/tests/install/common/rust.bats): Rust インストールスクリプトのテスト
- [`tests/install/macos/common/brew.bats`](https://github.com/shunk031/dotfiles/blob/master/tests/install/macos/common/brew.bats): Homebrew インストールスクリプトのテスト
- [`tests/files/common.bats`](https://github.com/shunk031/dotfiles/blob/master/tests/files/common.bats): chezmoi 展開後のファイルの存在確認

各テストファイルはスクリプトの動作を検証し、期待される結果（パッケージのインストール、設定ファイルの生成など）が得られることを確認します。

## テスト・ CI/CD 戦略

本リポジトリでは「継続的検証」を基本方針としたテスト戦略を採用しています。`install/` ディレクトリのスクリプトが正しく動作することを様々な環境で検証し、問題を事前に発見することで、実際の環境構築時の失敗を防いでいます。

### Bats による単体テストの実装

[Bash Automated Testing System (Bats)](https://github.com/bats-core/bats-core) を使用して、各インストールスクリプトの動作を検証します。Bats は shellscript 専用のテストフレームワークで、シンプルな記法でテストを記述できます。

```bash:tests/install/macos/common/brew.bats
#!/usr/bin/env bats

@test "brew installation script exists" {
  [-f "install/macos/common/brew.sh"]
}

@test "brew installation script is executable" {
  [-x "install/macos/common/brew.sh"]
}

@test "brew installation script runs without errors" {
  run bash install/macos/common/brew.sh
  ["$status" -eq 0]
}

@test "brew command is available after installation" {
  run command -v brew
  ["$status" -eq 0]
}
```

各テストでは、スクリプトの存在確認、実行可能権限の確認、実際の実行、そして期待される結果（コマンドの利用可能性など）を段階的に検証します。

### GitHub Actions による包括的検証

GitHub Actions を使用して、多段階での検証しています。単体テストに加えて、実際のエンドツーエンドセットアップも定期的に実行し、包括的な品質保証を実現しています。

#### 単体テストの実行

macOS と Ubuntu 環境での自動テストを実行し、プラットフォーム固有の問題を早期発見しています。

```yaml:.github/workflows/test.yaml
name: Test
on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
    runs-on: ${{matrix.os}}

    steps:
      - uses: actions/checkout@v4
      - name: Install Bats
        run: |
          if [["${{ matrix.os}}" == "ubuntu-latest" ]]; then
            sudo apt-get update && sudo apt-get install -y bats
          else
            brew install bats-core
          fi

      - name: Run tests
        run: bats tests/install/

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
```

#### 実際のセットアップの定期実行

より重要なのは、実際のユーザー体験と同じ環境での検証です。本リポジトリのワークフローでは、毎週金曜日に [`setup.sh`](https://github.com/shunk031/dotfiles/blob/master/setup.sh) を使用したセットアップ過程を macOS と Ubuntu それぞれの Runner で自動実行しています。このスクリプトは前述した chezmoi による環境構築のワンライナーを wrap したものです。

```yaml:.github/workflows/remote.yaml
name: Snippet install
on:
  schedule:
    - cron: "0 0 * * 5"  # 毎週金曜日

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-14]
        system: [client, server]
        exclude:
          - os: macos-14
            system: server

    runs-on: ${{matrix.os}}
    steps:
      - name: Setup dotfiles with snippet
        run: |
          if ["${OS}" == "macos-14" ]; then
            bash -c "$(curl -fsLS https://shunk031.me/dotfiles/setup.sh)"
          elif ["${OS}" == "ubuntu-latest" ]; then
            bash -c "$(wget -qO - https://shunk031.me/dotfiles/setup.sh)"
          fi
```

この定期実行により、外部依存関係の変更、OS アップデート、パッケージマネージャーの変更などが環境構築に与える影響を継続的に監視し、実際のユーザーが実行する際の信頼性を確保しています。

#### コードカバレッジ計測と Codecov 連携

[kcov](https://github.com/SimonKagstrom/kcov) を使用して shellscript のコードカバレッジを計測し、[Codecov](https://codecov.io/) で可視化しています。これにより、テストされていないコードパスを特定し、テストの改善に役立てています。実際の計測は [`scripts/run_unit_test.sh`](https://github.com/shunk031/dotfiles/blob/master/scripts/run_unit_test.sh) を使用しています。

https://github.com/SimonKagstrom/kcov
https://about.codecov.io/

```bash
# カバレッジ計測の例
kcov --clean --include-path=install/macos/common/ \
  coverage/ \
  bats tests/install/macos/common/brew.bats
```

カバレッジレポートは [codecov/codecov-action](https://github.com/codecov/codecov-action) の利用により Pull Request 時に自動でコメントされ、変更による影響を即座に把握できます。
https://github.com/codecov/codecov-action

#### パフォーマンス測定とベンチマーク自動化

dotfiles 適用後の shell 起動パフォーマンスを継続的に監視し、設定変更による影響を早期発見するため、ベンチマーク測定も自動化しています。

本実装は [benchmark-action/github-action-benchmark](https://github.com/benchmark-action/github-action-benchmark) を使用した以下の記事を参考にしています。shell の初回起動時間と平均起動時間（10 回測定）の両方を計測し、dotfiles による設定が shell 起動に与える影響を定量化しています。

https://github.com/benchmark-action/github-action-benchmark
https://zenn.dev/odan/articles/17a86574b724c9

測定結果は [GitHub Pages](https://shunk031.me/my-dotfiles-benchmarks/) で公開され、継続的なパフォーマンス監視を実現しています。新しいプラグインや設定の追加が shell 起動時間に与える影響を数値で確認でき、パフォーマンスの劣化を未然に防ぐことができます。

https://shunk031.me/my-dotfiles-benchmarks/

## 実装詳細と運用フロー

### セットアップスクリプトの構造と実装例

`install/` ディレクトリのスクリプトは、単一責任の原則に従って設計されています。各スクリプトは特定のツールのインストールと設定のみを担当し、独立してテスト可能な構造になっています。

スクリプトの基本構造として、OS 別の処理は別々のファイルに分離されており、各プラットフォーム専用のスクリプトとして実装されています。すべてのインストールスクリプトは以下の共通パターンに従います。 shellscript の書き方については [Minimal safe Bash script template](https://betterdev.blog/minimal-safe-bash-script-template/) が参考になります。

https://betterdev.blog/minimal-safe-bash-script-template/


```bash
#!/usr/bin/env bash
set -Eeuo pipefail

# デバッグモードの設定
if ["${DOTFILES_DEBUG:-}" ]; then
    set -x
fi

# ツール固有の関数群
function is_tool_exists() {
    command -v tool_name &>/dev/null
}

function install_tool() {
    if ! is_tool_exists; then
        # プラットフォーム固有のインストール処理
        # macOS: brew install tool_name
        # Ubuntu: sudo apt-get install -y tool_name
    fi
}

# メイン処理
function main() {
    install_tool
    # 追加の設定処理があれば実行
}

if [["${BASH_SOURCE[0]}" == "${0}" ]]; then
    main
fi
```

この `if [["${BASH_SOURCE[0]}" == "${0}" ]]; then` の条件文は、スクリプトが直接実行された場合のみ `main` 関数を実行するためのものです。スクリプトが他のファイルから `source` コマンドで読み込まれた場合（例：テストファイルから関数を呼び出す場合）は、関数定義のみが読み込まれ `main` は実行されません[^3]。これにより、同一スクリプトを「実行用」と「ライブラリ用」の両方で使用でき、テスト可能性が大幅に向上します。

例えば、Homebrew のインストールは `install/macos/common/brew.sh`、chezmoi の Ubuntu 用インストールは `install/ubuntu/common/chezmoi.sh` に分離しています。この構造でプラットフォーム最適化とテスト可能性を実現しています。

### 開発・保守フロー

#### 新規アプリケーション追加手順

1. インストールスクリプトの作成

```bash
# install/macos/common/new_tool.sh を作成
# 上記の基本構造に従って実装
```

2. テストファイルの作成

```bash
# tests/install/macos/common/new_tool.bats を作成
@test "new_tool installation script exists" {
  [-f "install/macos/common/new_tool.sh"]
}

@test "new_tool can be installed" {
  run bash install/macos/common/new_tool.sh
  ["$status" -eq 0]
}
```

3. ローカルでのテスト実行

```bash
bats tests/install/macos/common/new_tool.bats
```

#### テスト駆動での開発プロセス

開発は常にテストファーストで進めます。

1. テストケースの作成: 期待する動作をテストとして先に記述
2. 最小限の実装: テストが通る最小限のスクリプトを実装
3. リファクタリング: 動作を保持しながらコードを改善
4. 統合テスト: CI 環境での動作確認

この運用フローにより、品質と保守性を維持しながら、継続的に dotfiles を改善していくことができます。各変更は必ずテストでカバーされ、CI パイプラインで検証されるため、実際の環境で問題が発生するリスクを最小限に抑えています。

## まとめ

本記事では、chezmoi とテスト駆動開発を組み合わせた「テスト可能な dotfiles 管理」のアプローチについて解説しました。従来の dotfiles リポジトリが抱える「セットアップスクリプトが正しく動作するか実行するまでわからない」という根本的な課題に対して、包括的な解決策を提示しました。具体的には、Bats による単体テスト、GitHub Actions による継続的検証、そして実際のエンドツーエンドセットアップの定期実行を組み合わせたアプローチです。みなさんもぜひ、自身の dotfiles 管理にテスト可能性を取り入れ、信頼性の高い開発環境構築を実現してみてください。

https://github.com/shunk031/dotfiles

<!-- textlint-disable -->

[^1]: [GitHub 上の `$GITHUB_USERNAME/dotfiles` を参照して chezmoi がセットアップを開始してくれます。](https://www.chezmoi.io/quick-start/#start-using-chezmoi-on-your-current-machine:~:text=Create%20a%20new%20repository%20on%20GitHub%20called%20dotfiles%20and%20then%20push%20your%20repo%3A)

[^2]: chezmoi のデフォルトでは[リポジトリルートがソースディレクトリ](https://www.chezmoi.io/user-guide/advanced/customize-your-source-directory/)になります。

[^3]: Python の `if __name__ == "__main__"` と同じような仕組みです。

<!-- textlint-enable -->
