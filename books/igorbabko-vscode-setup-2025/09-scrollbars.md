---
title: "Scrollbars"
---

エディタの水平・垂直スクロールバーを非表示にし、概要ルーラー（Overview Ruler）の各種マーカー色を透明にして装飾を排除します。対応する動画のチャプターは [Scrollbars (30:51)](https://www.youtube.com/watch?v=VmFOsK7IhI4&t=1851s) です。

## 設定（settings.json）

```json
{
  "workbench.colorCustomizations": {
    "editorOverviewRuler.wordHighlightStrongForeground": "#0000",
    "editorOverviewRuler.selectionHighlightForeground": "#0000",
    "editorOverviewRuler.rangeHighlightForeground": "#0000",
    "editorOverviewRuler.wordHighlightForeground": "#0000",
    "editorOverviewRuler.bracketMatchForeground": "#0000",
    "editorOverviewRuler.findMatchForeground": "#0000",
    "editorOverviewRuler.modifiedForeground": "#0000",
    "editorOverviewRuler.deletedForeground": "#0000",
    "editorOverviewRuler.warningForeground": "#0000",
    "editorOverviewRuler.addedForeground": "#0000",
    "editorOverviewRuler.errorForeground": "#0000",
    "editorOverviewRuler.infoForeground": "#0000",
    "editorOverviewRuler.border": "#0000"
  },
  "editor.scrollbar.horizontal": "hidden",
  "editor.scrollbar.vertical": "hidden",
  "editor.overviewRulerBorder": false,
  "editor.hideCursorInOverviewRuler": true
}
```

## 設定項目の説明

| 設定 | 説明 |
| --- | --- |
| `workbench.colorCustomizations.editorOverviewRuler.wordHighlightStrongForeground` | 概要ルーラー上の強力な単語ハイライト色を設定します。透明（`#0000`）でマークを非表示にします。 |
| `workbench.colorCustomizations.editorOverviewRuler.selectionHighlightForeground` | 概要ルーラー上の選択ハイライト色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations.editorOverviewRuler.rangeHighlightForeground` | 概要ルーラー上の範囲ハイライト色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations.editorOverviewRuler.wordHighlightForeground` | 概要ルーラー上の単語ハイライト色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations.editorOverviewRuler.bracketMatchForeground` | 概要ルーラー上の括弧一致マーカー色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations.editorOverviewRuler.findMatchForeground` | 概要ルーラー上の検索一致マーカー色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations.editorOverviewRuler.modifiedForeground` | 概要ルーラー上の変更行マーカー色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations.editorOverviewRuler.deletedForeground` | 概要ルーラー上の削除行マーカー色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations.editorOverviewRuler.warningForeground` | 概要ルーラー上の警告マーカー色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations.editorOverviewRuler.addedForeground` | 概要ルーラー上の追加行マーカー色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations.editorOverviewRuler.errorForeground` | 概要ルーラー上のエラーマーカー色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations.editorOverviewRuler.infoForeground` | 概要ルーラー上の情報マーカー色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations.editorOverviewRuler.border` | 概要ルーラー周囲の境界線色を設定します。透明で境界線を非表示にします。 |
| `editor.scrollbar.horizontal` | 水平スクロールバーの表示を制御します。`hidden` で非表示にします。 |
| `editor.scrollbar.vertical` | 垂直スクロールバーの表示を制御します。`hidden` で非表示にします。 |
| `editor.overviewRulerBorder` | 概要ルーラー周囲の境界線の表示・非表示を切り替えます。 |
| `editor.hideCursorInOverviewRuler` | 概要ルーラー内のカーソル位置マーカーを非表示にします。 |

## 追加する拡張機能

本章のコミット（`.vscode/extensions.json`）での新規追加はありません。

## 変更コミット

- [`5a393af`](https://github.com/igorbabko/vscode-setup/commit/5a393afafeb6457af47de69cda510252bdb36fb4)
