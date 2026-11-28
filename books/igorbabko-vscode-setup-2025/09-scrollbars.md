---
title: "Scrollbars"
---

エディタの水平・垂直スクロールバーを非表示にし、概要ルーラー（Overview Ruler）の境界線やカーソル表示、各種マーカー色をすべて透明化します。エディタの右端をすっきりと整理し、コード表示領域のノイズを完全に排除します。対応する動画のチャプターは [Scrollbars (30:51)](https://www.youtube.com/watch?v=VmFOsK7IhI4&t=1851s) です。

https://www.youtube.com/watch?v=VmFOsK7IhI4&t=1851s

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

| Before | After |
| --- | --- |
| ![水平・垂直スクロールバーが表示されたエディタ](/images/igorbabko-vscode-setup-2025/ch09-scrollbars-before.webp) | ![水平・垂直スクロールバーが非表示になったエディタ](/images/igorbabko-vscode-setup-2025/ch09-scrollbars-after.webp) |

左では右端の垂直スクロールバーと下部の水平スクロールバーが表示されていますが、右ではどちらも非表示になります。

| Before | After |
| --- | --- |
| ![シアン色の概要ルーラー境界線が表示されたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-ruler-border-before.webp) | ![シアン色の概要ルーラー境界線が消えたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-ruler-border-after.webp) |

概要ルーラーを 3 倍に拡大して比較しています。左で見えていたシアン色のルーラー境界線が、右では消えます。

| Before | After |
| --- | --- |
| ![シアン色の境界線とカーソル位置マーカーが表示されたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-cursor-marker-before.webp) | ![シアン色の境界線を保ったままカーソル位置マーカーだけが消えたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-cursor-marker-after.webp) |

変化を見やすくするためシアン色のルーラー境界線を残した状態で、左にあったカーソル位置マーカーが右では消えます。

### 概要ルーラーマーカー色の透明化
概要ルーラーには、エラーや警告、検索一致、単語ハイライト、Git の変更行などの位置を示すマーカーが描画されます。マーカーが消えるとエラー位置を俯瞰できなくなります。動画ではエラーへのジャンプをショートカットで行い、エラー総数はタイトル横で確認できるため、この非表示化を受け入れています。VS Code の診断ジャンプショートカットの既定値は、次の問題へ移動が `F8`、前の問題へ移動が `Shift+F8` です。

これらのマーカーを非表示にするため、テーマカラーカスタマイズ `workbench.colorCustomizations` を使います。`workbench.colorCustomizations` は、第 05 章でカーソル色を設定したオブジェクトと同じ設定項目です。第 05 章で設定した `editorCursor.background` を残したまま、本章の 13 種類の `editorOverviewRuler.*` を同じオブジェクト内に追加します。概要ルーラーに関連する 13 種類のカラー設定すべてに透明色 `#0000` を指定し、マーカーを透明化して非表示にしています。

| Before | After |
| --- | --- |
| ![読み取り出現箇所マーカーがピンク色で可視化されたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-word-highlight-before.webp) | ![読み取り出現箇所マーカーが透明化されて消えたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-word-highlight-after.webp) |

左の読み取り出現箇所マーカーが右では消えます。この比較と続く 5 組の比較に表示しているピンク色は、実際のマーカーを見やすく確認するための一時的な可視化色であり、推奨設定ではありません。

| Before | After |
| --- | --- |
| ![書き込み出現箇所マーカーがピンク色で可視化されたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-word-highlight-strong-before.webp) | ![書き込み出現箇所マーカーが透明化されて消えたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-word-highlight-strong-after.webp) |

左の書き込み出現箇所マーカーが右では消えます（ピンク色は可視化用の一時色です）。

| Before | After |
| --- | --- |
| ![選択文字列と一致する複数マーカーがピンク色で可視化されたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-selection-highlight-before.webp) | ![選択文字列の一致マーカーが透明化されて消えたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-selection-highlight-after.webp) |

左に表示されていた選択文字列と一致する複数箇所のマーカーが、右ではすべて消えます（ピンク色は可視化用の一時色です）。

| Before | After |
| --- | --- |
| ![Go to Symbol in Editor の範囲マーカーがピンク色で可視化されたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-range-highlight-before.webp) | ![Go to Symbol in Editor の範囲マーカーが透明化されて消えたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-range-highlight-after.webp) |

左に表示されていた Go to Symbol in Editor ピッカーの範囲マーカーが、右では透明になって消えます（ピンク色はマーカーを確認するための一時色です）。

| Before | After |
| --- | --- |
| ![対応括弧のマーカーがピンク色で可視化されたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-bracket-match-before.webp) | ![対応括弧のマーカーが透明化されて消えたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-bracket-match-after.webp) |

左にあった対応括弧のマーカーが右では消えます（ピンク色は可視化用の一時色です）。

| Before | After |
| --- | --- |
| ![検索一致マーカーがピンク色で可視化されたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-find-match-before.webp) | ![検索一致マーカーが透明化されて消えたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-find-match-after.webp) |

左に表示されていた検索一致マーカーが右では消えます（ピンク色は可視化用の一時色です）。

| Before | After |
| --- | --- |
| ![右端に黄色のバーと赤色のバーが表示されたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-git-diff-markers-before.webp) | ![黄色のバーが消え、赤色のバーが残ったルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-git-diff-markers-after.webp) |

左の右端に表示されていた黄色と赤色のバーのうち、右では黄色の Git マーカーが消え、赤色のエラーマーカーは残ります。この赤色のエラーマーカーは、続く比較（`editorOverviewRuler.errorForeground`）で非表示になります。なお、この比較では確認のため `scm.diffDecorations` を一時的に `all` へ戻しており、第 7 章の設定を適用した状態では Git マーカーはすでに非表示です。

| Before | After |
| --- | --- |
| ![エラー・警告・情報の診断マーカーが色分け表示されたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-diagnostic-markers-before.webp) | ![エラー・警告・情報の診断マーカーが透明化されて消えたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-diagnostic-markers-after.webp) |

左ではタスクマッチャーによるエラー・警告・情報の各マーカーが別々の色で表示されていますが、右ではすべて消えます。

| Before | After |
| --- | --- |
| ![editor.overviewRulerBorder を有効にしたままシアン色の境界線が表示されたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-ruler-border-color-before.webp) | ![editor.overviewRulerBorder を有効にしたまま境界線色が透明化されたルーラー拡大](/images/igorbabko-vscode-setup-2025/ch09-ruler-border-color-after.webp) |

`editor.overviewRulerBorder` を `true` に保った状態で、左のシアン色の境界線が右では透明色によって見えなくなります。

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
