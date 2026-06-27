## PR Update

- PR の description は日本語で書く。
- 記事レビュー中の細かい修正は、ユーザーが `PR 出して`、`PR 更新して`、`commit`、`push` などを明示するまでローカル変更と検証に留める。各指摘ごとに commit / push / PR 更新しない。

## Article Editing

- 記事を書く・直す前に `docs/article-editing-guidelines.md` を確認し、略語、引用、用語統一、段落構成の方針を反映する。
- 記事の日本語を直すときは、まず見出し、段落の役割、図表やリンクの接続、引用位置を点検し、その後で語句を直す。NG 語の置換だけで完了扱いにしない。
- 記事への指摘を直す前に、`docs/article-editing-guidelines.md` の該当セクションを読み返す。特に引用位置、略語、見出し、表、式まわりは、過去に同じ指摘が出ているため必ず確認する。
- 記事への指摘を直す前に、指摘箇所だけでなく前後 1〜2 段落を読み、段落の役割、前後との接続、読者に渡す情報を確認する。単語や 1 文だけの置換で済ませず、必要なら段落ごと組み替える。
- 記事編集で受けた指摘は、表面的な修正例ではなく「なぜ読みにくいか」「次にどう判断するか」まで抽象化して `docs/article-editing-guidelines.md` に短く反映する。
- 外部資料を本文で紹介するときは、リンク先を開いて確認できた内容だけを書く。図がある、比較している、主張している、などの紹介文を推測で補わない。
- 記事を変更したら `npx textlint ./articles/<slug>.md` を実行する。
- 記事を変更したら `npm run article-style:audit -- ./articles/<slug>.md` を実行し、過去に指摘された表現が再発していないか確認する。
- `article-style:audit` は既知の表面症状を拾う補助であり、品質保証として扱わない。audit が通っても、修正した段落と前後 1〜2 段落を読み、段落の役割、引用位置、用語の初出、表や図への接続を人間の判断で確認する。
- pre-commit は `lefthook.yml` で管理する。新しい clone や worktree で作業を始めるときは、`mise install` のあとに `lefthook install` を実行してから編集・commit に入る。
- commit 前の自動確認では、staged された記事に `textlint` と `article-style:audit`、staged された docs に `textlint`、監査スクリプトに `node --check`、staged diff に `git diff --cached --check` が走る。自動確認が通っても、上の人間レビューは省略しない。
- 記事レビューでは、ユーザーが明示的に求めない限りスクリーンショット取得や `npx zenn preview` を実行しない。本文修正と lint / audit を優先する。
- bare URL は埋め込み用途のことがあるため、意図を確認せずに markdown link へ書き換えない。
- 表記揺れを見つけたら、記事全体で統一する。
