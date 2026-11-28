---
title: "User interface"
---

カラーテーマを適用し、アクティビティバーやステータスバー、ミニマップなどの周辺 UI を非表示にして画面を整理します。キーボードショートカット主体の操作を前提に、コードのみに集中できる最小限（= ミニマル）な作業環境を整えることが目的です。対応する動画のチャプターは [Color theme and UI (00:00)](https://www.youtube.com/watch?v=VmFOsK7IhI4&t=0s) です。

https://www.youtube.com/watch?v=VmFOsK7IhI4&t=0s

## 設定（settings.json）

```json
{
  "workbench.colorTheme": "Aura Dracula Spirit (Soft)",
  "workbench.activityBar.location": "hidden",
  "workbench.editor.showTabs": "single",
  "workbench.statusBar.visible": false,
  "workbench.startupEditor": "none",
  "workbench.tips.enabled": false,
  "editor.minimap.enabled": false,
  "breadcrumbs.enabled": false
}
```

## 解説

### カラーテーマの選択
落ち着いたトーンの配色を適用します。

- `workbench.colorTheme: "Aura Dracula Spirit (Soft)"`（既定値 `"Default Dark Modern"`）: [Aura Dracula Spirit](https://marketplace.visualstudio.com/items?itemName=josemurilloc.aura-spirit-dracula) の Soft バリアントを適用する

設定の編集はコマンドパレット（macOS では `⌘⇧P`、Windows では `Ctrl+Shift+P`）から User Settings (JSON) を開いて行います。編集した設定はファイルを保存することでエディタに反映されます。

| Before | After |
| --- | --- |
| ![Default Dark Modern テーマを適用した TypeScript ファイルの編集画面](/images/igorbabko-vscode-setup-2025/ch01-theme-before.webp) | ![Aura Dracula Spirit (Soft) テーマを適用した TypeScript ファイルの編集画面](/images/igorbabko-vscode-setup-2025/ch01-theme-after.webp) |

同じ TypeScript ファイルと Seti アイコンのまま、左の `Default Dark Modern` から右の `Aura Dracula Spirit (Soft)` へ配色が切り替わります。背景色とシンタックスハイライトのトーンの変化を確認できます。

### ワークベンチ UI の最小化
キーボードショートカットによる画面操作を前提とし、不要なナビゲーション UI を非表示にします。

- `workbench.activityBar.location: "hidden"`（既定値 `"default"`）: アクティビティバーを画面から取り除く
- `workbench.editor.showTabs: "single"`（既定値 `"multiple"`）: エディタタブを 1 つだけ表示する
- `workbench.statusBar.visible: false`（既定値 `true`）: ステータスバーを非表示にする

| Before | After |
| --- | --- |
| ![複数タブとアクティビティバー・ステータスバーが表示されたワークベンチ](/images/igorbabko-vscode-setup-2025/ch01-minimal-chrome-before.webp) | ![単一タイトルのみが残りアクティビティバーとステータスバーが非表示になったワークベンチ](/images/igorbabko-vscode-setup-2025/ch01-minimal-chrome-after.webp) |

左では複数のタブに加えて左端のアクティビティバーと下部のステータスバーが表示されていますが、右では単一のタイトル行だけが残り両方のバーが消えます。画面外周の UI が取り除かれてエディタ領域が広がる点を確認できます。

### 起動画面とエディタ補助機能の整理
ファイルを開いていないときの画面表示をシンプルにし、作業領域を広く確保します。

- `workbench.startupEditor: "none"`（既定値 `"welcomePage"`）: 起動時の「ようこそ」画面を非表示にする
- `workbench.tips.enabled: false`（既定値 `true`）: 空画面に表示されるショートカット案内などのヒントを非表示にする
- `editor.minimap.enabled: false`（既定値 `true`）: エディタ右側のコード縮小表示（ミニマップ）を非表示にする
- `breadcrumbs.enabled: false`（既定値 `true`）: 上部のパンくずリストを非表示にする

| Before | After |
| --- | --- |
| ![起動時に Welcome エディタが表示された画面](/images/igorbabko-vscode-setup-2025/ch01-startup-screen-before.webp) | ![起動時に空のワークベンチが表示された画面](/images/igorbabko-vscode-setup-2025/ch01-startup-screen-after.webp) |

左では起動直後に Welcome エディタが開きますが、右ではタブのない空のワークベンチが表示されます。

| Before | After |
| --- | --- |
| ![空のワークベンチにショートカット案内が表示された画面](/images/igorbabko-vscode-setup-2025/ch01-editor-tips-before.webp) | ![ショートカット案内が消え Open File の案内だけが残った空のワークベンチ](/images/igorbabko-vscode-setup-2025/ch01-editor-tips-after.webp) |

左の空画面に並んでいたショートカットのヒントが、右では非表示になります。汎用的な Open File の案内だけが残る点を確認できます。

| Before | After |
| --- | --- |
| ![長いファイルで右側のミニマップと上部のパンくずリストが表示されたエディタ](/images/igorbabko-vscode-setup-2025/ch01-minimap-breadcrumbs-before.webp) | ![同じ長いファイルでミニマップとパンくずリストが非表示になったエディタ](/images/igorbabko-vscode-setup-2025/ch01-minimap-breadcrumbs-after.webp) |

同じ長いファイルを開いた状態で、左にあった右端のミニマップと上部のパンくずリスト行が、右ではどちらも消えます。

## 設定項目の一覧

| 設定 | 既定値 | 説明 |
| --- | --- | --- |
| `workbench.colorTheme` | `"Default Dark Modern"` | ワークベンチとエディタのアクティブなカラーテーマを選択します。 |
| `workbench.activityBar.location` | `"default"` | アクティビティバーの表示位置を制御します。`hidden` で非表示にします。 |
| `workbench.editor.showTabs` | `"multiple"` | エディタタブの表示方法を制御します。`single` で単一のタブを表示します。 |
| `workbench.statusBar.visible` | `true` | ステータスバーの表示・非表示を切り替えます。`false` で非表示にします。 |
| `workbench.startupEditor` | `"welcomePage"` | 起動時に開くエディタを設定します。`none` で「ようこそ」画面を表示しません。 |
| `workbench.tips.enabled` | `true` | 空の起動画面に表示されるショートカット案内などのヒント表示を切り替えます。`false` で非表示にします。 |
| `editor.minimap.enabled` | `true` | エディタのミニマップ（コード縮小表示）の表示・非表示を切り替えます。`false` で非表示にします。 |
| `breadcrumbs.enabled` | `true` | エディタ上部のパンくずリスト（ファイルやシンボルの階層表示）の表示・非表示を切り替えます。`false` で非表示にします。 |

## 注意点

ステータスバーを非表示にすると、現在の [Git](https://git-scm.com/) ブランチ名やワークスペースの状態情報などが常時確認できなくなります。ステータスバーを再度表示したい場合は、設定値を `true` に戻すか、メニューバーの「View（表示）」>「Appearance（外観）」>「Status Bar（ステータスバー）」から切り替えます。

`settings.json` の編集内容は、ファイルを保存した時点でエディタに反映されます。

## 追加する拡張機能

- [Aura Spirit Dracula](https://marketplace.visualstudio.com/items?itemName=josemurilloc.aura-spirit-dracula) (`josemurilloc.aura-spirit-dracula`): カラーテーマ拡張機能

## 変更コミット

- [`02b14b5`](https://github.com/igorbabko/vscode-setup/commit/02b14b5421552f337e2d87110412e19050ab6904)
