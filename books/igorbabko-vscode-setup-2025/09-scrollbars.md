---
title: "Scrollbars"
---

エディタの水平・垂直スクロールバーを非表示にし、概要ルーラー（Overview Ruler）の境界線やカーソル表示、各種マーカー色をすべて透明化します。エディタの右端をすっきりと整理し、コード表示領域のノイズを完全に排除します。対応する動画のチャプターは [Scrollbars (30:51)](https://www.youtube.com/watch?v=VmFOsK7IhI4&t=1851s) です。

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

## 解説

### スクロールバーと概要ルーラー枠線の非表示
エディタの水平スクロールバー（`editor.scrollbar.horizontal: "hidden"`、既定値 `"auto"`）を非表示にします。あわせて垂直スクロールバー（`editor.scrollbar.vertical: "hidden"`、既定値 `"auto"`）も非表示にします。さらに、概要ルーラー（Overview Ruler）周囲の境界線（`editor.overviewRulerBorder: false`、既定値 `true`）を非表示にします。概要ルーラー内のカーソル位置マーカー（`editor.hideCursorInOverviewRuler: true`、既定値 `false`）も非表示にし、エディタ右端の境界線をなくします。

### 概要ルーラーマーカー色の透明化
概要ルーラーには、エラーや警告、検索一致、単語ハイライト、Git の変更行などの位置を示すマーカーが描画されます。マーカーが消えるとエラー位置を俯瞰できなくなります。動画ではエラーへのジャンプをショートカットで行い、エラー総数はタイトル横で確認できるため、この非表示化を受け入れています。VS Code の診断ジャンプショートカットの既定値は、次の問題へ移動が `F8`、前の問題へ移動が `Shift+F8` です。

これらのマーカーを非表示にするため、テーマカラーカスタマイズ `workbench.colorCustomizations` を使います。`workbench.colorCustomizations` は、第 05 章でカーソル色を設定したオブジェクトと同じ設定項目です。第 05 章で設定した `editorCursor.background` を残したまま、本章の 13 種類の `editorOverviewRuler.*` を同じオブジェクト内に追加します。概要ルーラーに関連する 13 種類のカラー設定すべてに透明色 `#0000` を指定し、マーカーを透明化して非表示にしています。

## 設定項目の一覧

| 設定 | 既定値 | 説明 |
| --- | --- | --- |
| `workbench.colorCustomizations["editorOverviewRuler.wordHighlightStrongForeground"]` | テーマ依存 | 概要ルーラー上の強力な単語ハイライト色を設定します。透明（`#0000`）でマークを非表示にします。 |
| `workbench.colorCustomizations["editorOverviewRuler.selectionHighlightForeground"]` | テーマ依存 | 概要ルーラー上の選択ハイライト色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations["editorOverviewRuler.rangeHighlightForeground"]` | テーマ依存 | 概要ルーラー上の範囲ハイライト色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations["editorOverviewRuler.wordHighlightForeground"]` | テーマ依存 | 概要ルーラー上の単語ハイライト色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations["editorOverviewRuler.bracketMatchForeground"]` | テーマ依存 | 概要ルーラー上の括弧一致マーカー色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations["editorOverviewRuler.findMatchForeground"]` | テーマ依存 | 概要ルーラー上の検索一致マーカー色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations["editorOverviewRuler.modifiedForeground"]` | テーマ依存 | 概要ルーラー上の変更行マーカー色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations["editorOverviewRuler.deletedForeground"]` | テーマ依存 | 概要ルーラー上の削除行マーカー色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations["editorOverviewRuler.warningForeground"]` | テーマ依存 | 概要ルーラー上の警告マーカー色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations["editorOverviewRuler.addedForeground"]` | テーマ依存 | 概要ルーラー上の追加行マーカー色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations["editorOverviewRuler.errorForeground"]` | テーマ依存 | 概要ルーラー上のエラーマーカー色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations["editorOverviewRuler.infoForeground"]` | テーマ依存 | 概要ルーラー上の情報マーカー色を設定します。透明でマークを非表示にします。 |
| `workbench.colorCustomizations["editorOverviewRuler.border"]` | テーマ依存 | 概要ルーラー周囲の境界線色を設定します。透明で境界線を非表示にします。 |
| `editor.scrollbar.horizontal` | `"auto"` | 水平スクロールバーの表示を制御します。`hidden` で非表示にします。 |
| `editor.scrollbar.vertical` | `"auto"` | 垂直スクロールバーの表示を制御します。`hidden` で非表示にします。 |
| `editor.overviewRulerBorder` | `true` | 概要ルーラー周囲の境界線の表示・非表示を切り替えます。`false` で非表示にします。 |
| `editor.hideCursorInOverviewRuler` | `false` | 概要ルーラー内のカーソル位置マーカーを非表示にします。`true` で非表示にします。 |

## 注意点

スクロールバーや概要ルーラーマーカーをすべて非表示にすると、ファイル全体における現在のスクロール位置や、エラー・警告・検索一致の発生場所を画面右端で視覚的に把握できなくなります。エラーや警告を確認する場合は、問題パネルや診断へのジャンプショートカット（`F8` または `Shift+F8`）を利用する必要があります。

## 追加する拡張機能

本章のコミット（`.vscode/extensions.json`）での新規追加はありません。

## 変更コミット

- [`5a393af`](https://github.com/igorbabko/vscode-setup/commit/5a393afafeb6457af47de69cda510252bdb36fb4)
