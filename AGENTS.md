## PR Update

- PR の description は日本語で書く。

## Article Editing

- 記事を書く・直す前に `docs/article-editing-guidelines.md` を確認し、略語、引用、用語統一、段落構成の方針を反映する。
- 記事への指摘を直す前に、`docs/article-editing-guidelines.md` の該当セクションを読み返す。特に引用位置、略語、見出し、表、式まわりは、過去に同じ指摘が出ているため必ず確認する。
- 記事編集で受けた指摘は、表面的な修正例ではなく「なぜ読みにくいか」「次にどう判断するか」まで抽象化して `docs/article-editing-guidelines.md` に短く反映する。
- 記事を変更したら `npx textlint ./articles/<slug>.md` を実行する。
- 記事を変更したら `npm run article-style:audit -- ./articles/<slug>.md` を実行し、過去に指摘された表現が再発していないか確認する。
- bare URL は埋め込み用途のことがあるため、意図を確認せずに markdown link へ書き換えない。
- 表記揺れを見つけたら、記事全体で統一する。
