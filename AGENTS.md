## PR Update

- PR の description は日本語で書く。
- 記事の直しは、内容の確認役の ACCEPT と、`textlint`・`article-style:audit` が通った区切りごとに、1 回 commit と push をして PR 本文も更新する。明示の指示は待たない。
- 指摘 1 つごとに push しない（区切りごとにまとめる）。
- マージと公開（`published` や `published_at` の変更を含む）は、これまでどおりユーザーの明示の承認を待つ。

## Article Editing

- 記事（`articles/*.md`）と本の章（`books/<slug>/*.md`）は、`shunk031-writing-tech-article` スキルで読者、目的、調査、構成を決める。
- 記事、本の章、docs（`docs/*.md`）の日本語は agy（Google の Antigravity CLI。Gemini を使う）の worker が担当する。執筆は `shunk031-writing-gemini-japanese` スキルの手順で行い、呼び出し元は本文を直接書かない。必要なスキルと入れ方は README の Setup を見る。
- 呼び出し元は元資料の調査、`textlint` や `article-style:audit` の実行、commit や PR を担当する。
- 記事や本の章を書く・直す前に `docs/article-editing-guidelines.md` を確認し、略語、引用、用語統一、段落構成の方針を反映する。
- 記事や本の章の日本語を直すときは、まず見出し、段落の役割、図表やリンクの接続、引用位置を点検し、その後で語句を直す。NG 語の置換だけで完了扱いにしない。
- 記事や本の章への指摘を直す前に、`docs/article-editing-guidelines.md` の該当セクションを読み返す。特に引用位置、略語、見出し、表、式まわりは、過去に同じ指摘が出ているため必ず確認する。
- 記事や本の章への指摘を直す前に、指摘箇所だけでなく前後 1〜2 段落を読み、段落の役割、前後との接続、読者に渡す情報を確認する。単語や 1 文だけの置換で済ませず、必要なら段落ごと組み替える。
- 記事や本の章の編集で受けた指摘は、表面的な修正例ではなく「なぜ読みにくいか」「次にどう判断するか」まで抽象化して `docs/article-editing-guidelines.md` に短く反映する。
- 外部資料を本文で紹介するときは、リンク先を開いて確認できた内容だけを書く。図がある、比較している、主張している、などの紹介文を推測で補わない。
- 記事や本の章を変更したら呼び出し元が対象ファイル（`./articles/<slug>.md` または `./books/<slug>/*.md`）に `npx textlint <path>` を実行し、結果を agy に渡して直させる。
- 記事や本の章を変更したら、呼び出し元が `npm run article-style:audit -- <path>` を実行する。対象は `./articles/<slug>.md` または `./books/<slug>/*.md` とし、過去に指摘された表現の再発を確認して結果を agy に渡す。
- `article-style:audit` は既知の表面症状を拾う補助であり、品質保証として扱わない。audit が通っても、修正した段落と前後 1〜2 段落を読み、段落の役割、引用位置、用語の初出、表や図への接続を人間の判断で確認する。
- pre-commit は `lefthook.yml` で管理する。新しい clone や worktree で作業を始めるときは、`mise install` のあとに `lefthook install` を実行してから編集・commit に入る。
- commit 前の自動確認では、staged された記事と本の章に `textlint` と `article-style:audit`、staged された docs に `textlint` が走る。監査スクリプトには `node --check`、staged diff には `git diff --cached --check` が走る。自動確認が通っても、上の人間レビューは省略しない。
- 記事や本の章のレビューでは、ユーザーが明示的に求めない限りスクリーンショット取得や `npx zenn preview` を実行しない。本文修正と lint / audit を優先する。
- bare URL は埋め込み用途のことがあるため、意図を確認せずに markdown link へ書き換えない。
- 表記揺れを見つけたら、記事全体や本全体で統一する。
