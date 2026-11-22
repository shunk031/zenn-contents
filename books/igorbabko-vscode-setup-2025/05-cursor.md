---
title: "Cursor"
---

エディタのカーソル形状をブロックに変更し、点滅の無効化やグラデーション背景、マルチカーソル用の修飾キーを設定します。対応する動画のチャプターは [Cursor gradient (17:05)](https://www.youtube.com/watch?v=VmFOsK7IhI4&t=1025s) です。

## 設定（settings.json）

```json
{
  "custom-ui-style.stylesheet": {
    ".monaco-editor .cursors-layer .cursor": "background-image: linear-gradient(135deg, #ffaffc 10%, #DA70D6 100%)"
  },
  "editor.multiCursorModifier": "ctrlCmd",
  "editor.cursorBlinking": "solid",
  "editor.cursorStyle": "block",
  "workbench.colorCustomizations": {
    "editorCursor.background": "#000000"
  }
}
```

## 設定項目の説明

| 設定 | 説明 |
| --- | --- |
| `custom-ui-style.stylesheet[".monaco-editor .cursors-layer .cursor"]` | エディタカーソルにピンクから紫へのグラデーション背景を適用します。 |
| `editor.multiCursorModifier` | マウスクリックでカーソルを追加する際の修飾キーを設定します。`ctrlCmd` は Windows / Linux で Ctrl、macOS で Command を割り当てます。 |
| `editor.cursorBlinking` | カーソルの点滅アニメーションを設定します。`solid` で点滅を無効化（常時点灯）します。 |
| `editor.cursorStyle` | カーソルの形状を設定します。`block` でブロック型にします。 |
| `workbench.colorCustomizations.editorCursor.background` | テーマカスタマイズにおけるエディタカーソルの背景色を設定します。 |

## 追加する拡張機能

本章のコミット（`.vscode/extensions.json`）での新規追加はありません。

## 変更コミット

- [`71871cc`](https://github.com/igorbabko/vscode-setup/commit/71871cc4364994f356a76c81912d15df3e92e37b)
