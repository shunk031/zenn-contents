---
title: "Suggestions"
---

自動補完ポップアップの自動表示を抑制し、Tab キーによる補完確定やスニペットの優先表示、Emmet 展開を設定します。補完候補の過剰な割り込みを防ぎ、必要なタイミングで確実に補完を利用できるようにします。対応する動画のチャプターは [Code completions (33:11)](https://www.youtube.com/watch?v=VmFOsK7IhI4&t=1991s) です。

## 設定（settings.json）

```json
{
  "workbench.colorCustomizations": {
    "[Aura Dracula Spirit (Soft)]": {
      "editorSuggestWidget.selectedBackground": "#3A334B"
    }
  },
  "editor.quickSuggestions": {
    "other": "off"
  },
  "editor.suggestOnTriggerCharacters": false,
  "editor.tabCompletion": "on",
  "editor.snippetSuggestions": "top",
  "emmet.triggerExpansionOnTab": true
}
```

## 解説

### 自動提案の抑制と手動呼び出し
コード入力中に自動で補完候補が頻繁に表示されるのを防ぎます。通常テキスト入力時のクイック提案を `editor.quickSuggestions.other: "off"`（既定値 `"on"`）で無効化します（コメントや文字列の既定値 `"off"` はそのまま維持されます）。また、`.` などのトリガー文字を入力した際の自動提案表示も `editor.suggestOnTriggerCharacters: false`（既定値 `true`）でオフにします。動画では、補完リストは自動表示させず、必要なときのみショートカットキーで手動表示させる方針をとっています。補完候補を手動で呼び出すショートカットキーの既定値は、macOS で `⌃Space`、Windows や Linux で `Ctrl+Space` です。

左の設定前のドット入力で開く提案ポップアップに対し、右の設定後の一覧は閉じた状態を保ちます。

| Before | After |
| --- | --- |
| ![設定前の自動提案ポップアップ](/images/igorbabko-vscode-setup-2025/ch10-automatic-suggestions-before.webp) | ![設定後の自動提案ポップアップ](/images/igorbabko-vscode-setup-2025/ch10-automatic-suggestions-after.webp) |

### Tab 補完・スニペット・Emmet 展開
提案リストを開かずに Tab キーを押すだけで一致する補完を確定できるよう `editor.tabCompletion: "on"`（既定値 `"off"`）を有効にします。

| Before | After |
| --- | --- |
| ![設定前](/images/igorbabko-vscode-setup-2025/ch10-tab-expansion-before.webp) | ![設定後](/images/igorbabko-vscode-setup-2025/ch10-tab-expansion-after.webp) |

左の設定前にテキストのまま残っていた shotloop が、右の設定後では Tab キーにより for-of ループへ展開されます。

また、提案リスト内でスニペットを常に最上位に表示する `editor.snippetSuggestions: "top"`（既定値 `"inline"`）を設定し、よく使うコード片を優先的に選べるようにします。

| Before | After |
| --- | --- |
| ![設定前](/images/igorbabko-vscode-setup-2025/ch10-tab-completion-ranking-before.webp) | ![設定後](/images/igorbabko-vscode-setup-2025/ch10-tab-completion-ranking-after.webp) |

左の設定前に通常補完 sam の下位にあった Sample card と Sample loop のスニペットが、右の設定後では通常補完より上位に並びます。

さらに、HTML 等の略称を Tab キーで展開できるよう `emmet.triggerExpansionOnTab: true`（既定値 `false`）を有効化します。

| Before | After |
| --- | --- |
| ![設定前](/images/igorbabko-vscode-setup-2025/ch10-tab-completion-emmet-before.webp) | ![設定後](/images/igorbabko-vscode-setup-2025/ch10-tab-completion-emmet-after.webp) |

左の設定前にプレーンテキストだった ul>li.item*3 が、右の設定後では Tab キーによって 3 つの li.item を含む ul 要素へ展開されます。

### 選択中補完アイテムの配色
提案リストで現在選択されている項目の背景色を紫色（`#3A334B`）に変更します。`workbench.colorCustomizations` にテーマ名 `[Aura Dracula Spirit (Soft)]` のブロックを定義し、特定テーマに限定して適用します。この設定も、第 05 章や第 09 章で追加した `workbench.colorCustomizations` の中へ併記して記述します。

| Before | After |
| --- | --- |
| ![設定前](/images/igorbabko-vscode-setup-2025/ch10-selected-suggestion-color-before.webp) | ![設定後](/images/igorbabko-vscode-setup-2025/ch10-selected-suggestion-color-after.webp) |

選択中のアクティブな候補行の背景色が、左の設定前の灰色から右の設定後では濃い紫色（#3A334B）へ変化します。

## 設定項目の一覧

| 設定 | 既定値 | 説明 |
| --- | --- | --- |
| `workbench.colorCustomizations["[Aura Dracula Spirit (Soft)]"].editorSuggestWidget.selectedBackground` | テーマ依存 | 対象カラーテーマにおける補完候補ポップアップの選択中項目の背景色を設定します。 |
| `editor.quickSuggestions.other` | `"on"` | 通常テキスト入力中の自動補完ポップアップ表示を制御します。`off` でトリガーを無効化します。 |
| `editor.suggestOnTriggerCharacters` | `true` | `.` などのトリガー文字入力時の自動提案表示を制御します。`false` で無効化します。 |
| `editor.tabCompletion` | `"off"` | Tab キーによる一致補完の挿入を制御します。`on` で有効化します。 |
| `editor.snippetSuggestions` | `"inline"` | 提案リスト内でのスニペットの表示位置を制御します。`top` で最上位に配置します。 |
| `emmet.triggerExpansionOnTab` | `false` | Tab キー押下時の Emmet 略称展開を有効化します。 |

## 注意点

自動補完ポップアップを抑制すると、文字入力中に自動で候補一覧が開かなくなります。候補一覧を表示して選択したい場合は、補完呼び出しショートカット（macOS の既定値は `⌃Space`、Windows / Linux は `Ctrl+Space`）を手動で押す必要があります。

## 本章完了時の状態

本章の設定をすべて適用すると、エディタは以下の状態になります。

![第 10 章完了時の状態](/images/igorbabko-vscode-setup-2025/ch10-checkpoint.webp)

## 追加する拡張機能

本章のコミット（`.vscode/extensions.json`）での新規追加はありません。

## 変更コミット

- [`40f6488`](https://github.com/igorbabko/vscode-setup/commit/40f648854e63745a60078d73cd741509ad854bdf)
