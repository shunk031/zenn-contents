---
title: "marp でいい感じに論文紹介スライドを作るぜ"
emoji: "📑"
type: "tech"
topics: ["marp", "markdown", "slides", "presentation"]
published: false
---

## 論文紹介スライドの作成課題と Markdown の選定理由

研究室の輪読会や勉強会での論文紹介スライド作成には、特有の負担がつきまといます。
Keynote や PowerPoint などのグラフィカルユーザーインターフェース (Graphical User Interface; GUI)[^gui] ツールを使うと、スライドごとのフォントサイズや余白の微調整に多くの時間が奪われます。
Git による差分管理やバージョン管理が難しく、過去に作成したスライドの資産を再利用しにくい点も悩みです。

法政大学理工学部 Advent Calendar 2026 の 3 日目です。
1 日目の [herdr によるエージェント協調](https://zenn.dev/shunk031/articles/herdr-orchestrate-workers-skill) や 2 日目の [agy による日本語執筆規約](https://zenn.dev/shunk031/articles/agy-gemini-japanese-skill) に続き、本稿では Marp による論文紹介スライドの作成環境と、美しく効率的に量産するための仕組みを解説します。
Marp は、マークダウン (Markdown)[^markdown] からスライドを生成するエコシステムです。
Marp を核としたカスタムテーマ、実描画による自動レイアウト検査、コーディングエージェント協調を組み合わせることで、ソフトウェア開発と同等の品質管理をスライド作成に持ち込めます。

## mise と Marp CLI による環境構築とコマンド体系

スライド作成環境の構成要素は、すべてバージョン管理下で統一されています。
ツールチェーンのバージョン管理には mise を採用し、Node.js と Marp のコマンドラインインターフェース (Command Line Interface; CLI)[^cli] を宣言的に固定します。

```toml:mise.toml
[tools]
node = "24.18.0"
"@marp-team/marp-cli" = "4.5.1"
```

各発表のスライドは、独立したディレクトリ単位で管理します。
設定ファイルやスクリプト群はリポジトリ共通とし、個別スライドの関心事を分離します。

```text
.
├── .marprc.cjs                  # Marp CLI 設定ファイル
├── themes/
│   └── ly.css                   # カスタムテーマ ly
├── scripts/
│   ├── check-layout.cjs         # 実描画レイアウト検査スクリプト
│   ├── check-release.cjs        # リリース前検証スクリプト
│   └── parenthesis-supplements.cjs # 括弧・引用の自動調整プラグイン
├── slides/
│   ├── example/                 # レイアウト見本デッキ
│   │   ├── slides.md
│   │   └── assets/
│   └── <発表名>/                 # 個別発表デッキ
│       ├── slides.md
│       └── assets/
└── dist/
    └── <発表名>/
        └── slides.pdf           # 生成成果物
```

日常の作業で用いるコマンドは、mise のタスクとして集約されています。
プレビュー起動や PDF 出力に際して、開発者が複雑な引数を覚える必要はありません。

```shell
# ローカルサーバーによるライブプレビュー起動
mise run preview

# Chrome 実描画によるレイアウト検査の実行
mise run check-layout

# 検査を通過した後に PDF を生成（dist/<発表名>/slides.pdf に出力）
mise run pdf
```

`mise run pdf` は、ビルド処理の直前に依存関係として `check-layout` を自動で呼び出します。
レイアウト崩れを含むスライドがビルド成果物として出力される事態を未然に防ぎます。

## 論文紹介スライドを読みやすくする 6 つの記法と設計

学術論文の要点を的確に伝えるためには、スライド内の情報配置に明確な秩序が求められます。
独自テーマ `ly` では、論文紹介に特化した複数の記法とカスタムコンポーネントを定義しています。

### 1. 見出しと要約の 1 行配置

スライド上部の専有面積を抑えつつ、そのページで最も伝えたいメッセージを提示するために、見出しと説明を 1 行にまとめる記法を採用します。

```markdown
## 主題 **|** _説明_
```

テーマ `ly.css` は、この構造を解釈してスタイリングを自動適用します。
太字で挟まれたパイプ記号 `**|**` の前にある主題は 48px のウェイト 700 で描画され、後ろの説明は 25.7px のウェイト 400 で描画されます。
中央にはテーマカラーの濃紺（`--color-heading`、`#00003e`）で境界線が引かれ、スライドの論点を即座に把握できます。

### 2. 論文表紙レイアウト

スライド 1 枚目には、論文タイトル、著者名、所属機関、書誌情報、発表者情報を整然と配置する専用レイアウトを用意しています。

```markdown
<!--
_class: paper-title title-slide-big first-slide
_paginate: false
-->

# 論文タイトル

_副題や補足事項_

- **Author One**, Author Two, Author Three
- Institution Name
- Conference / Journal '26
- [[Paper](https://example.com/paper)] [[Code](https://example.com/code)]
```

CSS グリッドにより、スライド左側にはタイトルや著者リストが展開され、右側には発表日や発表者情報、所属ロゴが配置されます。
タイトル中のアンダースコア記号で囲んだテキストは白文字のアクセントとして強調され、コントラストを高めます。

### 3. 自己紹介スライド

輪読会や外部勉強会での発表者紹介のために、`profile-slide` クラスを提供しています。
背景色を灰色に切り替える `content-slide-gray` と組み合わせることで、本論との視覚的な境界を明確にします。

```markdown
<!--
_class: profile-slide content-slide-gray
_paginate: false
-->

## 自己紹介 **|** _発表者氏名_

- **所属**: ○○大学 理工学部 / 研究室名
- **研究分野**: 自然言語処理 (Natural Language Processing; NLP)[^nlp]
- **関心**: エージェントシステム、機械学習基盤

![Profile](assets/profile.jpg)
```

左列に経歴や専門分野を箇条書きで示し、右列にプロフィール写真や所属アイコンを配置する 2 列構成が自動で適用されます。

### 4. 引用と括弧補足のフォントサイズ統一

スライド内に文献引用や英語の補足語句を挿入する際、本文と同じサイズで書くと視覚的なノイズになりがちです。
Marp のエンジン拡張 `parenthesis-supplements.cjs` により、半角括弧内のテキストや引用表記を自動判別し、一律で 20px（`--citation-font-size`）に縮小します。

```markdown
- 教師なし学習 (unsupervised learning) の設定で検証を行います。
- 提案手法は従来モデルを上回る精度を達成した _[[Vaswani+ NeurIPS'17](https://arxiv.org/abs/1706.03762)]_。
```

手動で HTML タグや CSS スタイルを挟むことなく、通常の Markdown を記述するだけで統一感のあるタイポグラフィが維持されます。

### 5. 図版・キャプション・軸説明の統一記法

図版を配置する際は、引用ブロック記法 `>` を用いて画像とキャプションをグループ化します。
論文から引用した図であることを明記し、閲覧者がグラフを誤読しないよう配慮します。

```markdown
> ![Figure 1](assets/figure1.png)
> Figure 1 from [[Author+ Venue'26](https://example.com)]: モデルの全体アーキテクチャ。
> - 横軸: 学習ステップ数
> - 縦軸: テスト損失 (Test Loss)
```

画像直下に引用元リンク付きのキャプションを配置し、さらにグラフの縦軸と横軸が何を表しているかを箇条書きで添えます。
スライドを見る参加者が、グラフの前提条件を迷わず把握できるように設計されています。

### 6. 数式注釈の重なりと余白崩れの防止

数式を展開する際、アンダーブレース `\underbrace` を使って各項の物理的な意味を説明することが多くあります。
MathJax によるレンダリングでは、注釈の文字列が長いと数式全体の横幅が不自然に広がり、左右の余白を圧迫する問題が生じます。

```markdown
$$
\min_{\theta} \mathbb{E} \left[ \underbrace{\mathcal{L}_{\text{task}}(\theta)}_{\mathclap{\text{主タスクの損失}}} + \lambda \underbrace{\mathcal{R}(\theta)}_{\mathclap{\text{正則化項}}} \right]
$$
```

注釈部分を `\mathclap{...}` で囲むことで、注釈テキストの水平方向の占有幅をゼロとして計算させます。
数式の配置間隔が崩れず、複数行にわたる数式でも整然としたレイアウトを保持できます。

## Headless Chrome 実描画によるレイアウト崩れの自動検査

Markdown でスライドを作成する際、最大の課題となるのが文字の溢れや意図しない折り返しです。
テキストエディタ上では問題なく見えても、実際にレンダリングするとスライド枠外に文章がはみ出してしまう事故が起こります。

本環境では、Headless Chrome を起動してスライド各要素のバウンディングボックスを精密に測定する検査スクリプト `scripts/check-layout.cjs` を備えています。

検査スクリプトが検証する代表的な不具合パターンは次のとおりです。

- `midword-wrap`: 日本語や英単語の途中で発生した不自然な単語内改行
- `unbalanced-lines`: 複数行見出しにおける行長の極端なアンバランス（2 行目が数文字だけ余る現象）
- `title-wrap`: 1 行に収めるべきスライド見出しの意図しない折り返し
- `column-alignment`: 2 列レイアウトにおいて左右のカラム上端や下端が揃っていない状態
- `math-overflow`: ディスプレイ数式がスライドの表示可能領域を水平方向にはみ出す問題
- `sparse-body`: スライド下部に過大な空白が残り、情報密度が極端に低い状態
- `parenthesis-width`: 統一ルールに反する全角括弧の使用

スライド開発中は、Marp のフロントマターに `class: debug-layout` を指定することで、各要素の測定境界線をブラウザ上で視覚的に確認できます。
さらに、GitHub Actions の CI ワークフローで検査スクリプト `scripts/check-release.cjs` を実行し、デバッグ用クラスが残ったままのスライドが存在すると失敗ステータスを返します。

## GitHub Actions による継続的インテグレーション

ローカルで実施した検証は、GitHub Actions による継続的インテグレーション (Continuous Integration; CI)[^ci] パイプライン上でも厳密に再現されます。

ワークフロー設定ファイル `.github/workflows/slides.yml` では、macOS ランナー環境上で以下のステップを順次実行します。

1. `mise run check-release`: `debug-layout` クラスの残存チェック
2. `mise run test`: スライドの情報分類やメタデータ整合性の検証
3. `mise run test-layout`: レイアウト検査スクリプト自体のセルフテスト（`scripts/check-layout.cjs --self-test`）
4. `mise run pdf`: `check-layout` による全デッキ検査を通過した後の配布用 Portable Document Format (PDF)[^pdf] 生成

CI ワークフローを追加した上で、GitHub のルールセット設定で Validate slides を必須ステータスチェック (required check) に指定すれば、検査を通過していないスライドのマージを確実に防げます。

## 見本デッキ slides/example/slides.md の活用

リポジトリ内には、設計された全レイアウトパターンを実証する見本デッキ `slides/example/slides.md` が同梱されています。
単なる静的なドキュメントではなく、前述のレイアウト検査をすべてパスする「動く仕様書」として機能します。

見本デッキには以下のスライド類型が網羅されています。

- `paper-title`: 論文メタデータ配置
- `profile-slide`: 発表者経歴紹介
- `problem-slide`: 研究の背景と課題設定
- `method-slide`: 提案手法の数式およびアルゴリズム説明
- `dataset-slide`: 実験データセットの統計量と前処理
- `experiment-slide`: ベースライン手法との比較結果と考察
- `summary-slide`: 論文の結論と今後の展望

新しい発表スライドを準備する際は、見本デッキから目的に合致するスライド構成をコピーし、本文テキストを書き換えるだけで体裁の整った資料が完成します。

## コーディングエージェントによる執筆と品質管理の規則

本環境では、人間による手動執筆だけでなく、Codex や Claude Code などのコーディングエージェントを用いたスライド作成にも対応しています。
リポジトリ直下の `AGENTS.md`（`CLAUDE.md` はこれへのシンボリックリンク）では、エージェントが順守すべき執筆・検証ルールを明文化しています。

- 配置の判断基準: プレビューで配置を判断する際は `mise run preview` によるブラウザ表示を用い、VS Code のプレビュー制約に留意する。
- 変更後の検証義務: 執筆やテーマ変更後は `mise run pdf` を実行し、変更した資料の全ページで文字のはみ出し、図、背景、日本語フォントを確認する。
- 完了前の点検: 完了報告の前に `review.md` の候補や原寸 PNG、`lines.json` を確認し、検出されたエラーや不具合を修正する。

スライドの記法やレイアウトの制約をエージェント向けの指示書として明確に定義することで、AI を活用しながらも崩れのないスライドを作成できます。

## ソフトウェア開発のプラクティスをスライド作成に持ち込む

Marp を中心としたスライド作成環境は、スライド作成を「お絵描き」から「ソフトウェア開発」へと昇華させます。
宣言的な Markdown 記述、バージョン固定されたツールチェーン、Headless Chrome による実描画テスト、そして GitHub Actions による CI。
体裁の調整に費やす無駄な時間を削減できれば、論文の内容理解と議論そのものへ集中できます。
研究発表や技術プレゼンテーションの品質を高めたい方は、ぜひ Markdown によるスライド作成基盤を試してみてください。

[^gui]: グラフィカルユーザーインターフェース (Graphical User Interface; GUI) は、グラフィックを用いた直感的な操作画面を指します。
[^markdown]: マークダウン (Markdown) は、プレーンテキスト形式で記述された軽量マークアップ言語です。
[^cli]: コマンドラインインターフェース (Command Line Interface; CLI) は、テキストコマンドを入力して操作するインターフェースを指します。
[^nlp]: 自然言語処理 (Natural Language Processing; NLP) は、人間の言語をコンピュータで処理・解析する技術分野です。
[^ci]: 継続的インテグレーション (Continuous Integration; CI) は、ソースコードの変更を自動的にテスト・ビルドする開発手法です。
[^pdf]: Portable Document Format (PDF) は、環境に依存せず文書を表示・印刷するためのファイル形式です。
