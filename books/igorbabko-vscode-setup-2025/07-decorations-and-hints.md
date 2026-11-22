---
title: "Decorations and Hints"
---

スティッキースクロールや CodeLens、パラメーターヒントなどの視覚的な補助表示を無効化し、ファイル保存時の末尾処理を設定します。対応する動画のチャプターは [Decorations and hints (20:53)](https://www.youtube.com/watch?v=VmFOsK7IhI4&t=1253s) です。

## 設定（settings.json）

```json
{
  "editor.stickyScroll.enabled": false,
  "editor.colorDecorators": false,
  "editor.codeLens": false,
  "editor.links": false,
  "editor.matchBrackets": "never",
  "editor.parameterHints.enabled": false,
  "editor.lightbulb.enabled": "off",
  "editor.hover.enabled": false,
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "scm.diffDecorations": "none"
}
```

## 設定項目の説明

| 設定 | 説明 |
| --- | --- |
| `editor.stickyScroll.enabled` | スクロール時に関数などのコンテキストを画面上部に固定表示するスティッキースクロールの有効・無効を切り替えます。 |
| `editor.colorDecorators` | カラー値のインラインプレビュー表示の有効・無効を切り替えます。 |
| `editor.codeLens` | コード上部に表示される CodeLens 注釈の表示・非表示を切り替えます。 |
| `editor.links` | エディタテキスト内のクリック可能なリンク検出の有効・無効を切り替えます。 |
| `editor.matchBrackets` | 対応する括弧の強調表示を制御します。`never` で無効化します。 |
| `editor.parameterHints.enabled` | 入力中のシグネチャ・パラメーターヒントの表示・非表示を切り替えます。 |
| `editor.lightbulb.enabled` | コードアクションの電球インジケーターの表示を制御します。`off` で非表示にします。 |
| `editor.hover.enabled` | エディタのシンボル上にマウスホバーした際の情報表示の有効・無効を切り替えます。 |
| `files.trimTrailingWhitespace` | ファイル保存時に末尾の空白文字を自動削除します。 |
| `files.insertFinalNewline` | ファイル保存時に最終行に空行を自動挿入します。 |
| `scm.diffDecorations` | ソース管理（SCM）によるエディタガターの差分マーカー表示を制御します。`none` で非表示にします。 |

## 追加する拡張機能

本章のコミット（`.vscode/extensions.json`）での新規追加はありません。

## 変更コミット

- [`975173a`](https://github.com/igorbabko/vscode-setup/commit/975173a0f7ddf904e5d250f41dac713f8774dab4)
