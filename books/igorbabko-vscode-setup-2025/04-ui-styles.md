---
title: "UI Styles"
---

Custom UI Style 拡張機能のスタイルシート設定を用いて、通知やクイックオープン、検索ウィジェットなどの各種 UI 要素の枠線や影を非表示にします。対応する動画のチャプターは [Styling with Custom UI Style extension (12:19)](https://www.youtube.com/watch?v=VmFOsK7IhI4&t=739s) です。

## 設定（settings.json）

```json
{
  "custom-ui-style.stylesheet": {
    ".notification-toast": "box-shadow: none !important",
    ".quick-input-widget.show-file-icons": "box-shadow: none !important",
    ".quick-input-widget": "top: 25vh !important",
    ".quick-input-list .scrollbar": "display: none",
    ".monaco-action-bar.quick-input-inline-action-bar": "display: none",
    ".editor-widget.find-widget": "box-shadow: none; border-radius: 4px",
    ".quick-input-titlebar": "background: #100B15 !important",
    ".monaco-workbench .part.editor > .content .editor-group-container > .title.title-border-bottom:after": "display: none",
    ".monaco-scrollable-element > .shadow.top": "display: none",
    ".sidebar .title-label": "padding: 0 !important",
    ".sidebar": "border: none !important",
    ".monaco-workbench .monaco-list:not(.element-focused):focus:before": "outline: none !important",
    ".monaco-list-row.focused": "outline: none !important",
    ".monaco-editor .scroll-decoration": "display: none",
    ".title-actions": "display: none !important",
    ".title.show-file-icons .label-container .monaco-icon-label.file-icon": "justify-content: center; padding: 0 !important",
    ".title .monaco-icon-label:after": "margin-right: 0"
  }
}
```

## 設定項目の説明

| セレクター | 説明 |
| --- | --- |
| `.notification-toast` | 通知トーストの影を削除します。 |
| `.quick-input-widget.show-file-icons` | ファイルアイコン付きクイック入力ポップアップの影を削除します。 |
| `.quick-input-widget` | クイック入力ポップアップをビューポート上部から 25vh の位置に配置します。 |
| `.quick-input-list .scrollbar` | クイック入力リストのスクロールバーを非表示にします。 |
| `.monaco-action-bar.quick-input-inline-action-bar` | クイック入力リスト内のインラインアクションボタンを非表示にします。 |
| `.editor-widget.find-widget` | 検索ウィジェットの影を削除し、角丸を 4px に設定します。 |
| `.quick-input-titlebar` | クイック入力のタイトルバーの背景色を `#100B15` に設定します。 |
| `.monaco-workbench ... .title.title-border-bottom:after` | エディタグループ下部のタイトルボーダー装飾を非表示にします。 |
| `.monaco-scrollable-element > .shadow.top` | 上部エッジのスクロールシャドウを非表示にします。 |
| `.sidebar .title-label` | サイドバーのタイトルラベルのパディングを削除します。 |
| `.sidebar` | サイドバーの境界線を削除します。 |
| `.monaco-workbench .monaco-list:not(.element-focused):focus:before` | フォーカスされたリストの前に描画されるフォーカスアウトラインを削除します。 |
| `.monaco-list-row.focused` | フォーカスされたリスト行のアウトラインを削除します。 |
| `.monaco-editor .scroll-decoration` | エディタのスクロール装飾シャドウを非表示にします。 |
| `.title-actions` | タイトルアクションボタンを非表示にします。 |
| `.title.show-file-icons .label-container .monaco-icon-label.file-icon` | ファイルアイコンラベルを中央揃えにし、パディングを削除します。 |
| `.title .monaco-icon-label:after` | アイコンラベル後の末尾マージンを削除します。 |

## 追加する拡張機能

本章のコミット（`.vscode/extensions.json`）での新規追加はありません。

## 変更コミット

- [`df3b12c`](https://github.com/igorbabko/vscode-setup/commit/df3b12c33dde40400e17404ebb08c5d7e6908ad4)
