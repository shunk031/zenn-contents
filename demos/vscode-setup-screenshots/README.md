# VS Code setup screenshot kit

This kit recreates the visual changes in the 11 chapters of `books/igorbabko-vscode-setup-2025` from a clean VS Code profile. The `2025` suffix is part of the selected book path, not a runtime date. It captures a zero state, one checkpoint after each chapter, and before/after images for 30 visual groups (72 PNGs total).

## Supported route

The canonical route is the macOS desktop build of VS Code. The runner downloads VS Code **1.101.1**, commit `18e3a1ec544e6907be1e944a94c496e302073435`, for Apple Silicon from Microsoft's update service. It keeps the app copy under ignored `output/runtime/`. The runner fixes the window at **1200 × 800** points so every capture shares a viewport. That makes each before/after pair pixel-comparable. Any fixed size works if every capture uses it. It opens the same sample project files throughout. It uses a new user-data directory and an empty extension directory. macOS VS Code needs a short user-data path for its IPC socket, so the profile uses a temporary PID-scoped folder and is removed after the run. It captures the VS Code window by its Core Graphics window ID and drives interactive groups through a loopback-only Chromium DevTools connection. The zero state uses VS Code's default macOS editor font stack, which starts with Menlo.

The DevTools endpoint uses an ephemeral port recorded in the isolated profile's `DevToolsActivePort` file. The runner attaches only to the matching app-copy URL and signals only its spawned PID on shutdown.

## Numeric choices

- The manifest has **11** source chapters and **30** visual groups. The `chapter` values in `scripts/groups.mjs` mirror the manifest. The **72** images are one zero state, 11 checkpoints, and two images per group.
- VS Code **1.101.1** and its commit are fixed app pins. The extension versions in the table are fixed Marketplace pins. Pinning keeps screenshot inputs stable as releases move forward.
- The runner has no image-scale setting. I measured `output/images/00-zero.png` and `output/smoke/images/00-zero.png` with `sips`. Both were **2624 × 1824** pixels on this Mac. The runner checks that `sips` reports dimensions, not that every display produces these pixel dimensions.
- `--remote-debugging-port=0` asks Chromium to choose an available port and record it in the isolated profile. The runner accepts only nonzero ports from **1** through **65535**. RFC 6335 defines the port namespace and reserves port 0.
- DevTools discovery uses a **30,000 ms** deadline. Connection and request timeouts are **10,000 ms**. Shutdown waits **3,000 ms** after each signal. Port and process polling intervals are **250 ms** and **100 ms**. These are fixed operational bounds, not measured performance limits. Their exact durations only need to stay consistent across captures.
- The `delay()` values are **150**, **200**, **250**, **350**, **400**, **450**, **500**, **600**, **700**, **800**, **1,100**, **1,200**, **1,600**, and **1,800 ms**. They were not individually measured. They are UI-settling pauses kept fixed for repeatable before/after actions. Node timers use milliseconds ([Node.js timers](https://nodejs.org/api/timers.html)).
- `goto()` positions target examples in the fixed fixture files. Editor coordinates start at line **1**, column **1**. The multi-cursor example uses the first **3** `color` matches because the fixture has three occurrences. Mouse hit points use visible rectangle centers. The **6 × 3** coordinate nudge moves away from the drag start. It was not measured and only needs to stay fixed for the same attempted gesture.
- Input constants follow the documented protocol. Modifier masks are **0** for none, **1** for Alt, **2** for Ctrl, **4** for Meta/Command, **8** for Shift, and **12** for Meta plus Shift. Mouse button masks are **0** for released and **1** for left. `clickCount: 1` means one click. The key-code map uses Microsoft's virtual-key values.
- Request IDs initialize at **0**. Each send increments first, so the first ID is **1** and pending IDs stay distinct. JavaScript arrays and strings use zero-based offsets. JSON uses **2**-space formatting for readability. Chapter names use two-digit padding (`ch01`) for sorting. Fetched JSON has mode `0o600`, so only the runner's user can read it.
- Other integer literals are structural checks or indexes. The `-1` index selects the last settings-path segment; exact-one checks reject ambiguous DevTools targets, and positive checks require visible content or dimensions. `process.argv[2]` selects the first argument after Node and the script. `process.exit(0)` reports success for `--help`.

The kit requires an Apple Silicon Mac, Node.js from `mise.toml`, Swift, Swift Compiler, Git, and network access to Microsoft's update service, the pinned source repository, and the Marketplace. The terminal app that runs the kit needs **Screen & System Audio Recording** permission. Enable it in System Settings > Privacy & Security; see [Apple's guide](https://support.apple.com/guide/mac-help/mchl592e5686/mac). The runner uses `screencapture` to capture the VS Code window. Window lookup uses AppKit and Core Graphics window metadata, not Accessibility APIs, so no Accessibility permission is needed. Docker and Linux are **not yet supported**.

## Pinned extensions

| Extension                          |  Version | Used from     |
| ---------------------------------- | -------: | ------------- |
| `josemurilloc.aura-spirit-dracula` | `0.1.10` | Chapter 1     |
| `pkief.material-icon-theme`        | `5.40.0` | Chapter 2     |
| `subframe7536.custom-ui-style`     |  `0.7.2` | Chapters 3–11 |

The runner fetches each chapter's `.vscode/settings.json` and `.vscode/extensions.json` from its pinned `igorbabko/vscode-setup` commit at run time. That source repository has no license file, so the kit does not copy its settings or recommendation files into this repository. Fetched files and installed extensions stay under ignored `output/`; they are not committed. Unexpected recommendations stop the run instead of silently installing an unpinned extension.

Custom UI Style changes files inside the VS Code app bundle. To keep the installed app untouched, the runner copies the pinned app into ignored `output/runtime/` and launches that disposable copy.

## Run

From the repository root:

```sh
mise install
lefthook install
node ./demos/vscode-setup-screenshots/scripts/run.mjs
```

Or run `node ./scripts/run.mjs` from this directory. The runner builds a fresh isolated profile and fetches all 11 pinned source snapshots. It installs each chapter's recommended extensions as that chapter is reached. It applies groups cumulatively, captures the screenshots, and writes `output/image-index.csv`. The index has one English description per image. All runtime files, app copies, fetched settings, extension files, and PNGs are ignored.

For a launch, attach, and capture smoke check without replacing the full image set, run `node ./scripts/run.mjs --smoke`. It captures `00-zero` and the chapter 1 theme pair under ignored `output/smoke/`.

To reshoot only the chapter 11 autosave pair while preserving the other PNGs, run `node ./scripts/run.mjs --autosave-only`. This mode requires the existing 72-image index. It applies chapters cumulatively through the chapter 11 `sidebar-and-title` group, then replaces the autosave images and the two multi-cursor index descriptions. Chapter 11 sets `files.autoSave` to `afterDelay` and leaves `files.autoSaveDelay` unset, so VS Code uses its default delay. The after capture waits for the edited fixture file to appear on disk; if that does not happen before the existing 10-second timeout, both autosave rows are marked inconclusive.

The run needs a visible, logged-in macOS desktop for VS Code window capture. The terminal app that launches the kit also needs the Screen & System Audio Recording permission described above. The app is started with workspace-trust prompts, telemetry, and update checks disabled. Unexpected dialogs and toasts stop capture. The fixture uses neutral names and a synthetic Git identity. App copies, fetched sources, extensions, and screenshots remain under ignored `output/`.

## Visual limits

The runner captures the expected recommendation toast only in the before image for that pair. It creates a runtime-only recommendation for `ms-python.python`, opens the Python fixture, then removes the recommendation. The operation-confirmation pair attempts to move a fixture file into `components`. In VS Code 1.101.1, the CDP drag does not trigger the confirmation or move the file, so the pair is indexed as inconclusive. `editor.multiCursorModifier` changes which key creates extra cursors, not how cursors look, so both images are indexed as inconclusive. The kit uses the same Option-click gesture in both captures. The chapter's `Dank Mono` family is not bundled; font rendering falls back to macOS's available fonts.

The fixture includes focused examples for color decorations, diagnostics, whitespace trimming, surface scrolling, and ligature operators. `autosave`, `surface-boundaries`, `multi-cursor`, `cursor-colors`, `code-style`, `marker-colors`, and `selected-suggestion-color` also remain inconclusive in this VS Code build. Each reason is recorded in `output/image-index.csv`.

## Kit layout

- `manifest/chapters.json`: commit pins, source paths, and visual group keys. It contains no settings values.
- `fixture/`: fixed sample project and open files.
- `scripts/fetch-sources.mjs`: fetches commit-pinned settings and extension recommendations.
- `scripts/run.mjs`: prepares the fresh profile, applies the cumulative settings groups, drives interactive examples, captures all images, and writes the index.
- `scripts/groups.mjs`: maps each visual group key to its setting paths and UI interaction.
- `scripts/cdp.mjs`: controls the editor and checks for unexpected dialogs or toasts, with narrow assertions for the two intentional before states.
- `scripts/window-id.swift`: finds the window owned by the disposable VS Code process for window-only capture.
- `output/`: ignored run artifacts.

## References

- [VS Code command-line interface](https://code.visualstudio.com/docs/configure/command-line)
- [VS Code workspace trust](https://code.visualstudio.com/docs/editing/workspaces/workspace-trust)
- [VS Code settings](https://code.visualstudio.com/docs/configure/settings)
- [VS Code workbench UI](https://code.visualstudio.com/docs/editing/getting-started/userinterface)
- [VS Code extension testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Microsoft VS Code 1.101.1 download](https://update.code.visualstudio.com/1.101.1/darwin-arm64/stable)
- [Chromium DevTools HTTP handler source](https://chromium.googlesource.com/chromium/src/+/HEAD/content/browser/devtools/devtools_http_handler.cc)
- [Chrome DevTools Protocol Input domain](https://chromedevtools.github.io/devtools-protocol/tot/Input/)
- [Microsoft virtual-key codes](https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes)
- [RFC 6335: Port Number Procedures](https://www.rfc-editor.org/rfc/rfc6335.html)
- [Node.js timers](https://nodejs.org/api/timers.html)
- [Node.js process arguments and exit status](https://nodejs.org/api/process.html#processargv)
- [Custom UI Style](https://github.com/subframe7536/vscode-custom-ui-style#readme)
