---
title: "Misc"
---

エディタタブのアイコン余白やサイドバー背景色を調整し、ファイルの自動保存や自動更新の抑制などを設定してセットアップを仕上げます。対応する動画のチャプターは [Final changes (36:54)](https://www.youtube.com/watch?v=VmFOsK7IhI4&t=2214s) です。

## 設定（settings.json）

```json
{
  "custom-ui-style.stylesheet": {
    ".title .monaco-icon-label.file-icon": "margin: 0 60px"
  },
  "workbench.colorCustomizations": {
    "[Aura Dracula Spirit (Soft)]": {
      "sideBar.background": "#191521"
    }
  },
  "files.autoSave": "afterDelay",
  "update.mode": "none",
  "extensions.ignoreRecommendations": true
}
```

## 設定項目の説明

| 設定 | 説明 |
| --- | --- |
| `custom-ui-style.stylesheet[".title .monaco-icon-label.file-icon"]` | エディタタブ内のファイルアイコンラベルの左右マージンを設定します。 |
| `workbench.colorCustomizations["[Aura Dracula Spirit (Soft)]"].sideBar.background` | 対象テーマ適用時のサイドバーの背景色を設定します。 |
| `files.autoSave` | ファイルの自動保存を制御します。`afterDelay` で指定時間の経過後に自動保存します。 |
| `update.mode` | VS Code の自動更新モードを設定します（コミットでは `none` を指定。※現在の公式ドキュメントでは説明未確認）。 |
| `extensions.ignoreRecommendations` | 拡張機能のおすすめ通知の表示を制御します。`true` で通知を抑制します。 |

## 追加する拡張機能

本章のコミット（`.vscode/extensions.json`）での新規追加はありません。

## 変更コミット

- [`da275c0`](https://github.com/igorbabko/vscode-setup/commit/da275c09488fec3b53f2541ad8d482dca51b499b)
