# VS Code setup screenshot kit

Recreates 11 chapters of `books/igorbabko-vscode-setup-2025`. A full run captures the zero state, 11 checkpoints, and 33 before/after pairs: 78 images.

## Route

The runner uses pinned VS Code **1.101.1** (commit `18e3a1ec544e6907be1e944a94c496e302073435`) in a disposable copy under `output/runtime/`.
It creates an isolated profile and extension directory, uses a **1200 × 800** point window, and never patches `/Applications/Visual Studio Code.app`.

Run only while the Mac is unused. VS Code takes keyboard focus; the idle-time guard aborts on keyboard or mouse input and quits only the kit's PID.
Keep the window visible. The terminal needs **Screen & System Audio Recording** permission; see [Apple's guide](https://support.apple.com/guide/mac-help/mchl592e5686/mac).
Requirements: Apple Silicon, Node.js from `mise.toml`, Swift, Git, and network access to the pinned source and Marketplace.

## Run

From the repository root:

```sh
mise install
lefthook install
node ./demos/vscode-setup-screenshots/scripts/run.mjs
```

Full output is indexed in `output/image-index.csv`; runtime data, images, and evidence stay under ignored `output/`.

### Targeted pair retakes

From the repository root, change to the kit directory and use `--only <canonical,...>`. Argument order does not change execution order.

```sh
cd demos/vscode-setup-screenshots
node scripts/run.mjs --only ch05-cursor-colors,ch10-tab-completion,ch10-selected-suggestion-color,ch11-sidebar-and-title,ch10-tab-expansion,ch10-emmet-expansion,ch04-overlays-find
```

Seven pairs produce 14 images in `output/subsets/<run-id>/`; its manifest records full before/after settings and pins. The isolated runtime reuses the pinned Marketplace cache.
Subset runs leave full outputs intact and do not promote images into the full index.

`--help` lists all 33 names. Unknown, empty, or duplicate names and `--only` with `--smoke` fail before cleanup or launch. Failed pairs and missing images exit non-zero.
