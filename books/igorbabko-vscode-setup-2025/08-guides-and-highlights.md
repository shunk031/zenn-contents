---
title: "Guides and Highlights"
---

行番号を相対表示に変更し、インデントガイドや空白文字の描画、現在行や選択箇所のハイライトを無効化します。対応する動画のチャプターは [Guides and highlights (26:05)](https://www.youtube.com/watch?v=VmFOsK7IhI4&t=1565s) です。

## 設定（settings.json）

```json
{
  "editor.lineNumbers": "relative",
  "editor.tabSize": 2,
  "editor.detectIndentation": false,
  "editor.showFoldingControls": "never",
  "editor.guides.indentation": false,
  "editor.renderWhitespace": "none",
  "editor.renderLineHighlight": "none",
  "editor.occurrencesHighlight": "off",
  "editor.selectionHighlight": false
}
```

## 設定項目の説明

| 設定 | 説明 |
| --- | --- |
| `editor.lineNumbers` | 行番号の表示方法を選択します。`relative` で現在の行からの相対行数を表示します。 |
| `editor.tabSize` | 1 つのタブ文字が表すスペースの数を設定します。 |
| `editor.detectIndentation` | ファイル内容からインデントを自動推測するかを制御します。`false` で設定値（`editor.tabSize`）を一律適用します。 |
| `editor.showFoldingControls` | コード折りたたみコントロールの表示タイミングを制御します。`never` で常に非表示にします。 |
| `editor.guides.indentation` | 垂直インデントガイドの表示・非表示を切り替えます。 |
| `editor.renderWhitespace` | 空白文字の可視化を制御します。`none` で非表示にします。 |
| `editor.renderLineHighlight` | 現在行の強調表示を制御します。`none` で無効化します。 |
| `editor.occurrencesHighlight` | シンボルの出現箇所の強調表示を制御します。`off` で無効化します。 |
| `editor.selectionHighlight` | 選択したテキストと一致する他の箇所の強調表示の有効・無効を切り替えます。 |

## 追加する拡張機能

本章のコミット（`.vscode/extensions.json`）での新規追加はありません。

## 変更コミット

- [`3b3f7d1`](https://github.com/igorbabko/vscode-setup/commit/3b3f7d1bce333ca80d41b0ca4193b9bd0eeb233f)
