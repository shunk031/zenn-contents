---
title: "Typography"
---

エディタのフォントに Dank Mono を指定し、サイズや行間を調整するとともに、リガチャの有効化やコメントのイタリック体描画を設定します。コードの可読性を大幅に向上させ、タイポグラフィ全体を整えます。対応する動画のチャプターは [Typography (19:11)](https://www.youtube.com/watch?v=VmFOsK7IhI4&t=1151s) です。

https://www.youtube.com/watch?v=VmFOsK7IhI4&t=1151s

## 設定（settings.json）

```json
{
  "editor.fontFamily": "Dank Mono",
  "editor.fontSize": 14,
  "editor.fontLigatures": true,
  "editor.lineHeight": 2.5,
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "comment",
        "settings": {
          "fontStyle": "italic"
        }
      }
    ]
  }
}
```

## 解説

### フォントファミリーと行の高さ
UI 全体とフォントを統一し、行間を広げて読みやすいレイアウトに整えます。

| 設定 | 値 | 既定値 | 効果 |
| --- | --- | --- | --- |
| `editor.fontFamily` | `"Dank Mono"` | — | エディタのフォントファミリーを変更する |
| `editor.fontSize` | `14` | — | 文字サイズを 14 ピクセルに設定する |
| `editor.lineHeight` | `2.5` | `0`、自動計算 | 行の高さを広げ、コードの行ごとの区切りを明瞭にする |

Dank Mono は有料フォントのため、本節ではスクリーンショットを省略しています。

### リガチャとコメントのイタリック体表示
演算子などの記号を見やすく結合表示し、コードとコメントを視覚的に区別しやすくします。

| 設定 | 値 | 既定値 | 効果 |
| --- | --- | --- | --- |
| `editor.fontLigatures` | `true` | `false` | フォントリガチャ（合字）を有効にする |
| `editor.tokenColorCustomizations.textMateRules` | `scope: "comment"`, `fontStyle: "italic"` | — | コメントをイタリック体で表示する |

## 設定項目の一覧

| 設定 | 既定値 | 説明 |
| --- | --- | --- |
| `editor.fontFamily` | OS・環境依存（例: Hack Nerd Font Mono / Menlo 等） | エディタで使用するフォントファミリーを設定します。 |
| `editor.fontSize` | `12`（macOS）/ `14`（Windows / Linux） | エディタのフォントサイズをピクセル単位で設定します。 |
| `editor.fontLigatures` | `false` | フォントリガチャ（合字）の有効・無効を切り替えます。 |
| `editor.lineHeight` | `0`（自動計算） | エディタの行の高さを設定します（数値 `2.5` で行間を拡大）。 |
| `editor.tokenColorCustomizations.textMateRules` | `{}` | 構文のスタイルをカスタマイズする TextMate トークンルールを設定します（コメントをイタリック体に設定）。 |

## 注意点

Dank Mono フォントがシステムにインストールされていない場合、フォントの指定やリガチャ（合字）の結合表示は正しく機能しません。事前にフォントを OS にインストールしておく必要があります。

## 本章完了時の状態

Dank Mono は有料フォントのため、本節ではスクリーンショットを省略しています。

## 追加する拡張機能

本章のコミット（`.vscode/extensions.json`）での新規追加はありません。

## 変更コミット

- [`599a705`](https://github.com/igorbabko/vscode-setup/commit/599a7054551b9ddd9ce4e390c06ffec2d4b1ce68)
