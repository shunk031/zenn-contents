---
title: "Typography"
---

エディタのフォントファミリーやフォントサイズ、行の高さを設定し、リガチャの有効化やコメントのイタリック体描画を適用します。対応する動画のチャプターは [Typography (19:11)](https://www.youtube.com/watch?v=VmFOsK7IhI4&t=1151s) です。

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

## 設定項目の説明

| 設定 | 説明 |
| --- | --- |
| `editor.fontFamily` | エディタで使用するフォントファミリーを設定します。 |
| `editor.fontSize` | エディタのフォントサイズをピクセル単位で設定します。 |
| `editor.fontLigatures` | エディタテキストのフォントリガチャ（合字）の有効・無効を切り替えます。 |
| `editor.lineHeight` | エディタの行の高さを設定します（数値 `2.5` を指定）。 |
| `editor.tokenColorCustomizations.textMateRules` | 構文の色やスタイルをカスタマイズする TextMate トークンルールを追加します（コメントスコープをイタリック体に設定）。 |

## 追加する拡張機能

本章のコミット（`.vscode/extensions.json`）での新規追加はありません。

## 変更コミット

- [`599a705`](https://github.com/igorbabko/vscode-setup/commit/599a7054551b9ddd9ce4e390c06ffec2d4b1ce68)
