---
title: "開発環境現状確認（2026年）"
emoji: "💭"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["開発環境", "dotfiles", "chezmoi", "vscode", "claudecode"]
published: true
published_at: 2026-01-17
---

こんにちは [@shunk031](https://twitter.com/shunk031) です。[`開発環境現状確認`](https://b.hatena.ne.jp/q/%E9%96%8B%E7%99%BA%E7%92%B0%E5%A2%83%E7%8F%BE%E7%8A%B6%E7%A2%BA%E8%AA%8D?target=text&sort=recent&users=1&safe=on)[^1][^2][^3]というタイトルの記事をいくつか見たので、自分の環境も整理してみます。

なお、環境構築に使用している dotfiles は以下で公開しています。

https://github.com/shunk031/dotfiles

## 著者のバックグラウンド

開発環境の現状を確認する前に、私のバックグラウンドを説明しておくとなぜそのような設定になっているかがわかりやすいかもと思い以下記述します。

私は画像生成やデザイン生成に関する研究開発に取り組む Research Scientist をしています。主に Python を使用しており、普段は手元の Macbook から、リソースリッチな GPU マシンへ接続して研究開発を行うスタイルです。

開発の前提として、ローカルマシンですべてを完結させるのではなく macOS 上でエディタやターミナルを操作しつつ、計算資源を必要とする処理は GPU サーバ（Ubuntu）側で実行するという構成になっています。そのため、ローカルとリモートを強く意識したツール選定や設定が多く、一般的な開発環境とは少し違う点もありそうです。

## マシン・OS

個人用と仕事用で端末は分かれていますが、使い方はできるだけ揃えるようにしています。

- 個人端末: MacBook Air M2[^4]
- 会社支給端末: MacBook Pro M4
- ローカル OS: macOS
- リモート環境: GPU サーバ（Ubuntu）

基本的には後述する VSCode の Remote SSH 機能を使い、ローカルの VSCode から GPU サーバへ接続して開発しています。個人端末と会社端末の差異は極力意識しないよう、ツールや設定は可能な限り共通化しています。

## エディタ

メインのエディタは VSCode です。日常的な実装やレビューはすべて VSCode で完結しています。

https://code.visualstudio.com/

ちょっとした設定変更やファイル編集は vim を使うこともあります。以前は emacs（spacemacs）をかなり深くカスタマイズして使っていましたが、ここ数年で VSCode + 拡張機能 + AI コーディングの組み合わせに完全に移行しました。

https://www.spacemacs.org/

## AI コーディング

AI コーディングは **Claude Code 一択** で、モデルは Sonnet 4.5 を使っています。設定は dotfiles で管理しており、以下で公開しています。探索的な使い方をすることが多いためコンテキストを消費しがちなのですが、Claude Mem を導入してみて様子を見ています（あんまりご利益がわかっていない）。

https://github.com/thedotmack/claude-mem

実験系の実装についても、あらかじめ目標を明確にしておけば、データの前処理からモデルの学習、デバッグまで一通りかなり良い感じに回してくれるようになりました。コードを細かく書くというより、「方針を決めてレビューする」比重が年々高くなっています。

### `~/.claude`

https://github.com/shunk031/dotfiles/tree/master/home/dot_claude

### `~/.claude-mem`

https://github.com/shunk031/dotfiles/tree/master/home/dot_claude-mem

## ターミナル

ターミナルは iTerm2 を使用しています。全画面の hotkey window として使うのが前提です。

https://iterm2.com/

少し前に Ghostty を試し、年始にも再度移行を検討しましたが、hotkey window 相当の機能（quick terminal）を使おうとすると頻繁にフリーズしてしまい、実用には耐えませんでした。そもそも iTerm2 で特に不便しているわけでもないため、今年も当面は iTerm2 を使い続けそうです。

https://x.com/shunk031/status/2003020715466121317?s=20

## ターミナルマルチプレクサ

ターミナルの分割やセッション管理はすべて tmux に任せています。iTerm2 側にも分割機能はありますが、そちらは使っていません。

https://github.com/tmux/tmux

ローカル環境では `C-z` をリーダーキーにし、GPU サーバなどのリモート環境では `C-q` をリーダーキーにして運用しています。tmux の中でさらに tmux を使っている形になるため、この運用をしている人はあまり見かけず、やや異端な使い方をしています。

## シェル環境

### シェル

ローカル・リモートともに zsh を使用しています。shell script を書くときは bash style で書くことが多いです。

https://github.com/zsh-users/zsh

### プロンプト

プロンプトは、ローカルでは powerlevel10k、リモートでは starship を使っています。見た目を大きく変えることで、「今どこで作業しているか」を直感的に判別できるようにしています。どちらも高性能で、アイコン表示も含めて必要な情報が確認しやすく気に入っています。starship 側はできるだけシンプルな設定にしています。

#### Powerlevel10k

https://github.com/romkatv/powerlevel10k

- 設定

https://github.com/shunk031/dotfiles/blob/master/home/dot_config/powerlevel10k/p10k.zsh

#### Starship

https://github.com/starship/starship

- 設定

https://github.com/shunk031/dotfiles/blob/master/home/dot_config/starship.toml

### よく使う CLI

環境構築は mise を基本にしています。よく使う CLI については、ほぼ mise の config を見れば分かるようにしています。

#### mise

https://github.com/jdx/mise

- 設定

https://github.com/shunk031/dotfiles/blob/master/home/dot_config/mise/config.toml

#### eza

ls コマンドの代替として eza を使っています。色付きで見やすく、git ステータスも表示できるため非常に便利です。

https://github.com/eza-community/eza

#### ghq / gwq / fzf

Git/GitHub レポジトリの操作には ghq や gwq、fzf を組み合わせて使っています。ghq でレポジトリを一元管理し、gwq で worktree を簡単に作成・管理できるようにしています。fzf を組み合わせることで、レポジトリ間の移動もスムーズに行えます。

https://zenn.dev/shunk031/articles/ghq-gwq-fzf-worktree

#### dotenvx

以下の記事に感銘を受けて .env ファイルを扱う際に dotenvx を使っています。

https://izanami.dev/post/59b95a54-77b2-42e0-9721-b457f1527b12

#### blocc (試験導入中)

また、Claude Code の Hooks 実行結果を対話中に返却し、再帰的な修正を促すために blocc の導入も試していますが、現時点ではまだうまく設定できていません。

https://github.com/shuntaka9576/blocc

https://dev.classmethod.jp/articles/shuntaka-claude-code-hooks-interactive-cli-recursive-fixes/

## 言語・実行環境

言語やツールチェーンの管理は基本的に mise を使用しています。Python については uv に完全に寄せており、今のところ特に不満はありません。

https://github.com/astral-sh/uv

## キーボード

分割キーボードは必須だと考えています。当方体がデカいオタクなので、縮こまって Macbook のキーボードを叩いていると巻き肩になり肩こりや頭痛が発生しがちです。

配列については、macOS などのデフォルト配列からできるだけ外れないほうが良いと思っているため、カラムスタッガード配列のキーボードは避けています。

以前は Mint60 を複数台自作するほど気に入って使っていましたが、現在は Mistel BAROCCO MD600 Alpha BT RGB を使用しています。

https://lilakey.com/products/mint60-starter

https://archisite.co.jp/products/mistel/eol/barocco-md600-alpha-bt-rgb/

https://x.com/shunk031/status/1762863221747441955?s=20

Alice 配列は初めてでしたが、デフォルト配列とほぼ同じ感覚で使えており、違和感はほとんどありません。キースイッチは Gateron Silent Clear に交換しており、軽い打鍵感を重視しています。MD600 はキースイッチのホットスワップに対応している点も良いところです。

https://shop.yushakobo.jp/products/8979?srsltid=AfmBOoofj8zo9jdg0q3fJqJLPSOoYTsU_wgacUzeLc29wluctNWm9evj

なお、キーキャップは GMK Olivia++ を使用しています。落ち着いた色合いでどこかシックな雰囲気があり、非常に気に入っています。

https://x.com/shunk031/status/1816083351603925015?s=20

自作キーボードも魅力的ですが、市販品のほうがよりしっかりとした作りになっていて持ち運びもしやすく、現在はこの構成に落ち着いています。

## モニター

メインモニターとして Dell の 32 インチ 4K 曲面ディスプレイを使用しています。最近はウルトラワイドモニターが気になっています。

https://www.dell.com/ja-jp/shop/dell-32-%E6%9B%B2%E9%9D%A2-4k-uhd-%E3%83%A2%E3%83%8B%E3%82%BF%E3%83%BC-s3221qs/apd/210-axhq/

サブモニターとして、会社から貸与されている LG の 27 インチディスプレイを縦置きし、Slack や Twitter（X）専用にしています。

## 机・椅子

机は FlexiSpot の昇降デスクを使っています。午後になると昇降機能を使い、立った状態でコーディングすることが多いです。

https://www.flexispot.jp/standing-desk/ef1.html

椅子はエルゴヒューマンを使用しています。作りがしっかりしており、長時間座っていても疲れにくく気に入っています。

https://www.ergohuman.jp/products/ergohuman_pro_high/

## 日本語入力

macOS 標準のライブ変換がどうしても合わず、現在は Google 日本語入力を使っています。最近は azooKey も気になっており、タイミングを見て試してみたいと考えています。

https://www.google.co.jp/ime/

https://azookey.com/

## dotfiles

冒頭でも述べた通り、開発環境の設定はすべて以下のリポジトリで公開しています。

https://github.com/shunk031/dotfiles

dotfiles は chezmoi で管理しており、`chezmoi init` などをラップした `setup.sh` を用意しています。curl / wget が使えれば一発で環境構築できるようになっています。

https://github.com/shunk031/dotfiles?tab=readme-ov-file#-setup

また、公開リポジトリへ push できないプライベートな設定については、別途 private リポジトリを作成し、そちらも chezmoi で管理しています。 `setup.sh` 内でその private リポジトリを clone し、環境構築時に反映する構成を取っています。

https://github.com/shunk031/dotfiles/blob/v-2026/setup.sh#L171-L178

GitHub Actions を使って継続的に dotfiles のテストも行っており、設定ミスや破損を防ぐようにしています。

https://zenn.dev/shunk031/articles/testable-dotfiles-management-with-chezmoi

## まとめ

2026 年の開発環境を振り返ると、特に大きく変わったのは AI コーディングの位置づけです。Claude Code を前提とした開発スタイルが定着し、実験系の実装においても、コードを書く作業そのものより、目標設定や方針決定、レビューに時間を使うようになりました。GPU サーバを用いた研究開発とも相性が良く、作業効率は明らかに向上していると感じています。

一方で、ターミナルや tmux、分割キーボードといった基盤となる部分は大きく変わっていません。iTerm2 + tmux + zsh という構成は引き続き安定しており、ローカルとリモートを行き来する開発スタイルでも安心して使えています。

また、dotfiles を chezmoi で管理し、公開・非公開の設定を分けつつ環境構築できる仕組みは、端末の入れ替えや環境追加の際にも非常に有用です。「いつでも同じ環境を再現できる」という点は、研究開発を進める上で重要だと改めて感じました。

今後は azooKey の導入や、Claude Code の Hooks の活用方法を改善していきたいと考えています。無理に新しいツールへ移行するのではなく、現在の開発スタイルを維持しながら、少しずつ改善していく予定です。

<!-- textlint-disable -->

[^1]: 開発環境現状確認（2026年） - Don't Repeat Yourself https://blog-dry.com/entry/2026/01/02/145952

[^2]: 開発環境現状確認2026｜laiso https://sizu.me/laiso/posts/3ssbv27ca1o0

[^3]: 開発環境現状確認 2026 | It's okay to be weird https://okweird.net/ja/posts/2026/01/my-dev-environment-2026/

[^4]: 博士課程卒業直前に学割で購入した思い出のパソコンくんです。今も現役です

<!-- textlint-enable -->
