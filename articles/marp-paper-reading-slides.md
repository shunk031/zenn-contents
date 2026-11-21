---
title: "marp でいい感じに論文紹介スライドを作るぜ"
emoji: "📑"
type: "tech"
topics: ["marp", "slides", "markdown", "presentation", "claudecode"]
published: false
---

こんにちは [@shunk031](https://twitter.com/shunk031) です。[法政大学理工学部 Advent Calendar 2026](https://adventar.org/calendars/13106) の 3 日目を担当します。

12/1 の記事では `herdr` を使って複数のエージェントを対話させるスキルを取り上げ、続く 12/2 の記事では `agy` と Gemini を組み合わせて自然な日本語へ整える推敲環境を取り上げました。これらの記事では、コーディングエージェントが協調して作業を進めるための環境づくりに焦点を当ててきました。

12/3 の今回は、その具体的な成果物の 1 つとして、研究や輪講、勉強会などで頻繁に作成する「論文紹介スライド」を Marp で作成する仕組みを取り上げます。

スライド作成において PowerPoint や Keynote などの GUI ツールを使うと、フォントや余白、数式の配置を手動で調整する手間が発生します。筆者のスライド用リポジトリ [shunk031/slides](https://github.com/shunk031/slides) では、Marp を基盤に据え、専用の CSS テーマ、数式注釈の記法ルール、Headless Chrome によるレイアウト自動検査を整えて運用しています。本記事では、このリポジトリの構成と、論文紹介スライドを見やすく仕上げるための工夫を解説します。

## Marp の概要

Marp（Markdown Presentation Ecosystem）は、Markdown ファイルからスライドを生成するオープンソースのツール群です。[^marp_app]

スライド原稿となる Markdown ファイルの先頭に YAML 形式のフロントマターを記述し、スライドの区切りには `---` を配置します。標準で 16:9 や 4:3 のアスペクト比指定に対応しており、HTML、PDF、画像（PNG や JPEG）など多様な形式へスライドを出力できます。

Marp は CSS を用いたテーマ拡張機構を備えており、独自のクラスや変数を定義してスライド全体のデザインを柔軟に制御できます。さらに数式表示エンジンとして KaTeX や MathJax を利用できるため、数式を含む学術的な発表資料の作成にも適しています。原稿がプレーンテキストとして完結するため、Git による差分管理やプルリクエストを通じたレビューと親和性が高い点も特徴です。

## スライドリポジトリの構成

筆者のリポジトリ [shunk031/slides](https://github.com/shunk031/slides) では、ツールの導入とタスク実行の管理に [mise](https://mise.jdx.dev/getting-started.html)[^mise_doc] を採用しています。`package.json` や Makefile は配置せず、すべての依存バージョンとタスク定義を `mise.toml` に集約しています。

`mise.toml` では Node.js（24.18.0）および `@marp-team/marp-cli`（4.5.1）を固定しています。スライド出力のバックエンドには Google Chrome を使用します。

リポジトリ内のディレクトリ構成は以下の通りです。各スライド資料は `slides/<発表名>/slides.md` に配置し、スライド内で参照する画像などの図版はデッキごとの `assets/` ディレクトリに相対パスで格納します。

- `slides/<発表名>/slides.md`: 各スライドデッキの原稿。図版は `slides/<発表名>/assets/` に配置。
- `themes/`: カスタムテーマ `ly.css` および同梱フォント。
- `scripts/`: Marp エンジンプラグインおよびレイアウト検査スクリプト。
- `docs/`: 執筆ガイド、レイアウト検査仕様、CI 仕様などのドキュメント。
- `.marprc.cjs`: Marp CLI の設定ファイル。テーマ読み込みとプラグイン登録を担当。

スライドのプレビューは `mise run preview` コマンドで起動します。このタスクは `marp --server .` を実行し、ローカルサーバーを立ち上げます。ブラウザで `http://localhost:8080/slides/example/slides.md` などを開くと、Markdown の保存と連動して表示が自動更新されます。Visual Studio Code (VS Code) の拡張機能である「Marp for VS Code」も利用できますが、リポジトリ独自の Marp エンジンプラグインは VS Code 内蔵プレビューでは動作しません。正確な見た目と検証結果を確認するためには、ブラウザプレビューを使用します。

PDF 出力は `mise run pdf` コマンドで実行します。このタスクはレイアウト検査（`check-layout`）の通過を前提条件としています。内部では Marp CLI で全資料を一括変換し、`dist/<発表名>/slides.pdf` に出力します（`dist/` は Git 管理外です）。

```toml
[tasks.pdf]
description = "すべての資料を dist/ に PDF 出力"
depends = ["check-layout"]
run = "marp --pdf --allow-local-files --input-dir slides --output dist"

[tasks.preview]
description = "ブラウザでスライドをプレビュー"
run = "marp --server ."
```

スライドの継続的インテグレーションには GitHub Actions（`.github/workflows/slides.yml`）を採用しています。macOS 環境上でのリリース検査、情報分類検証、レイアウト検査を経て PDF を出力し、レビュー用ファイルとともに `slides-review` アーティファクトとして保存します。外部ホスティングサービスへの自動公開は含めず、手元での生成と CI 上での検証結果の回収を確実に行う運用にしています。

## 論文紹介スライドを見やすくする工夫

### 専用テーマと豊富なレイアウト定義

リポジトリでは独自のテーマとして `ly`（`themes/ly.css`）を定義しています。スライドのフロントマターで `theme: ly` を指定し、ページごとのクラス指定 `_class` によりレイアウトを切り替えます。

```markdown
marp: true
theme: ly
class: classification-public
size: 16:9
lang: ja
_class: paper-title title-slide-big first-slide classification-public
paginate: true
_paginate: false
```

テーマの CSS では `@layouts` として、論文発表向け構成要素に対応するクラス群を登録しています。具体的には論文表紙（`paper-title`）や課題（`problem-slide`）、手法（`method-slide`）、結果（`results-slide`）などの専用クラスを定義しています。

フォントファイルおよびライセンスを `themes/assets/ly/fonts/` に同梱しています。外部ネットワークに接続できない環境でも常に一貫したタイポグラフィで描画されます。

### 主題と説明を分ける見出し記法

スライド本文の見出しでは `## 主題 **|** _説明_` という記法を採用しています。

この記法を用いると、Marp のカスタム CSS により `**|**` が中央揃えの縦線区切りとなり、主題が 48px、補足説明が約 25.7px で描画されます。スライドの要点を 1 行で端的に伝えるため、検査スクリプトでも見出しと説明がそれぞれ 1 行に収まっていることを検証します。

### 図と出典の厳密な対応

論文紹介スライドでは、図版がどの論文から引用されたものかを明確に示す必要があります。リポジトリの執筆ガイドでは、図の直下に出典と説明を配置するルールを定めています。

```markdown
> ![Figure 2: 入出力の対応](assets/figure.png)
>
> Figure from [[Huang+ ECCV’26](https://arxiv.org/html/2608.26716v1#S3.F2)]: 画像・メタデータ・質問・回答の対応
```

角括弧 `[[Huang+ ...](URL)]` をリンクの外側に置くことで、表示上の角括弧を維持しつつリンクとして機能させています。

### 数式の注釈と mathclap による幅の抑制

論文の数式解説では、各項の役割を説明するために下括弧（`\underbrace`）を使う場面が多くあります。しかし、通常の LaTeX 記法では注釈テキストの幅に応じて数式全体の横幅が広がってしまい、スライド幅からはみ出す原因となります。

この問題を解決するため、注釈部分を `\mathclap` で包む記法を必須としています。

```latex
$$
\underbrace{m\vphantom{y}}_{\mathclap{\text{平均}}} = \bigl(\underbrace{x\vphantom{y}}_{\mathclap{\text{条件 A}}}\;+\;\underbrace{y}_{\mathclap{\text{条件 B}}}\bigr)/2
$$
```

Marp エンジンプラグイン `scripts/check-math.cjs` が数式トークンを走査し、`\underbrace` に `\mathclap` が適用されていない場合はエラーを発生させてビルドを停止します。

### Chrome を使った機械的なレイアウト検査

スライド作成では、文字のはみ出しや意図しない改行、図とテキストの重なりなど、目視で見落としやすい崩れが発生します。

`mise run check-layout`（`scripts/check-layout.cjs`）を実行すると、Headless Chrome 上で全スライドを描画し、フォントや画像の読み込み完了後に各要素の配置をピクセル単位で検査します。

主な検査項目として以下のような項目が定義されています。

- 画面外へのはみ出し（`text-overflow`, `box-overflow`）
- テキスト同士の重なり（`text-overlap`）
- 極端に短い行の発生（`unbalanced-lines`）
- スライド下部の不自然な大きな空白（`sparse-body`）
- 図の出典形式の不備（`figure-caption-missing`）
- 数式注釈の衝突やはみ出し（`math-label-gap`, `math-overflow`）

検査完了後、各ページの原寸画像（`slide-N.png`）や空白測定画像（`slide-N-space.png`）、エラー一覧（`review.md`）が出力されるため、問題箇所の特定と修正が迅速に行えます。

## 代表的な作例

### レイアウト見本デッキ (`slides/example/slides.md`)

リポジトリにはレイアウト見本デッキとして `slides/example/slides.md` が用意されています。

このデッキには、論文表紙（`paper-title`）、自己紹介、見出しと箇条書きの階層、数式注釈、2 カラム比較など、テーマに含まれるすべてのレイアウトの実例が含まれています。新しいスライドを作成する際は、この見本デッキを `slides/<発表名>/slides.md` に複製して原稿を作成します。

### 実際の論文紹介スライド (`slides/2026-10-19-beyond-atomic-layouts/slides.md`)

実践的な論文紹介スライドとして、ECCV 2026 採択論文を解説したスライドデッキが格納されています。対象論文は「Beyond Atomic Layouts: Compositional Design Understanding with Vision-Language Models」です。

表紙では `paper-title` レイアウトを用いて、論文題目、著者、所属、プロジェクトページおよび arXiv へのリンク、発表者情報、注記、ロゴをグリッド配置しています。

本文では背景（`background-slide`）や課題（`problem-slide`）、定性比較（`qualitative-slide`）などの専用レイアウトを順序立てて活用しています。データセットやモデル構成（CoDeLayout や MASON）を含め、複雑なマルチモーダル研究の論点を整理しています。

## コーディングエージェントとの協調運用

本リポジトリは手作業での編集だけでなく、Claude Code や OpenAI Codex などのコーディングエージェントを使ったスライド執筆も想定しています。

エージェントがスライドを編集する際の規範として、ルートディレクトリに `AGENTS.md`（`CLAUDE.md` はこれへのシンボリックリンク）を配置しています。

`AGENTS.md` では、スライド本文の執筆や改稿において指定のスキル群を適用することを定めています。具体的には `shunk031-writing-technical-slides`（依存する `telegraph` や `kosshi` を含む）や `natural-japanese` を指定しています。

また、エージェントが陥りがちな悪手を防ぐルールも明確に言語化しています。たとえば「レイアウトへ収める目的で本文を過度なキャッチコピーへ変えない」「箇条書きの言い換えでも主張・具体例・帰結の階層関係を保つ」「検査回避のためだけの無意味な装飾を追加しない」といった規範を定めています。

この運用には、12/1 の Herdr 連携や 12/2 の日本語スキルと共通する思想が反映されています。明確な執筆ガイドライン（`AGENTS.md`）と自動検査（`check-layout`）を組み合わせることで、エージェントの自律作業と品質担保を両立させています。

## まとめ

Marp を活用した論文紹介スライドの作成構成と、見やすく仕上げるための工夫を紹介しました。

Markdown による原稿管理、専用 CSS テーマによるレイアウト定義、Headless Chrome によるレイアウト自動検査を組み合わせることで、手作業の調整負担を抑えながら安定したスライド作成が可能になります。

コーディングエージェントと協調して作業する上でも、明確なルール定義と客観的な自動検査を用意することが、手戻りを防ぎ品質を保つ土台となります。

これから論文紹介スライドや技術発表資料を作成する読者にとっても、Markdown と Marp を活用したスライド作成環境が参考になれば幸いです。

<!-- textlint-disable -->

[^marp_app]: Marp: Markdown Presentation Ecosystem https://marp.app/
[^mise_doc]: Getting Started - mise-en-place https://mise.jdx.dev/getting-started.html

<!-- textlint-enable -->
