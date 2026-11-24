# VS Code setup screenshot kit

This kit recreates the visual changes in the 11 chapters of `books/igorbabko-vscode-setup-2025` from a clean VS Code profile. The `2025` suffix is part of the selected book path, not a runtime date. It captures a zero state, one checkpoint after each chapter, and before/after images for 30 visual groups (72 PNGs total).

## Supported route

The canonical route is the macOS desktop build of VS Code. The runner downloads VS Code **1.101.1**, commit `18e3a1ec544e6907be1e944a94c496e302073435`, for Apple Silicon from Microsoft's update service. It keeps the app copy under ignored `output/runtime/`. The runner fixes the window at **1200 × 800** points so every capture shares a viewport. That makes each before/after pair pixel-comparable. Any fixed size works if every capture uses it. It opens the same sample project files throughout. It uses a new user-data directory and an empty extension directory. macOS VS Code needs a short user-data path for its IPC socket, so the profile uses a temporary PID-scoped folder and is removed after the run.

The runner launches only its copied app with macOS `open -g -n`. The `-g` flag requests a background launch, and `-n` requests a new process. It reads the frontmost app before and after every launch and capture, and stops if the app or PID changes. Before each capture, `window-id.swift` verifies that copied VS Code is behind another app window. Use `--allow-focus-change` only when nobody is using the Mac: it logs each frontmost transition and permits the copied VS Code window to be frontmost for window-ID capture. It sends no keyboard or mouse events to the desktop. All UI interaction goes through the app's loopback-only DevTools connection.

The runner does not send open requests to a running VS Code instance. The pinned launch handler [focuses the app on a second-instance request](https://github.com/microsoft/vscode/blob/1.101.1/src/vs/platform/launch/electron-main/launchMainService.ts#L710-L735).
Chromium starts with `--disable-backgrounding-occluded-windows`, `--disable-renderer-backgrounding`, and `--disable-background-timer-throttling` so covered windows keep rendering. Before capture, it waits for two renderer frames, saves a new PNG, checks its signature and modification time, then moves it into the output set. Keep the window on the logged-in desktop and do not minimize it. The zero state uses the macOS font stack starting with Menlo.

At run start and before each VS Code launch, restart, or capture, the runner reads `HIDIdleTime` with `ioreg -c IOHIDSystem`. It compares the counter with the previous value plus elapsed monotonic time. A decrease means keyboard or mouse input occurred, so the run aborts and quits only its own VS Code PID. This uses no idle-time threshold.

The DevTools endpoint uses an ephemeral port recorded in the isolated profile's `DevToolsActivePort` file. The runner attaches only to the matching app-copy URL and signals only its spawned PID on shutdown.

## Numeric choices

- The manifest has **11** source chapters and **30** visual groups. The `chapter` values in `scripts/groups.mjs` mirror the manifest. The **72** images are one zero state, 11 checkpoints, and two images per group.
- VS Code **1.101.1** and its commit are fixed app pins. The extension versions in the table are fixed Marketplace pins. Pinning keeps screenshot inputs stable as releases move forward.
- The runner has no image-scale setting. I measured `output/images/00-zero.png` and `output/smoke/images/00-zero.png` with `sips`. Both were **2624 × 1824** pixels on this Mac. The runner checks that `sips` reports dimensions, not that every display produces these pixel dimensions.
- `--remote-debugging-port=0` asks Chromium to choose an available port and record it in the isolated profile. The runner accepts only nonzero ports from **1** through **65535**. RFC 6335 defines the port namespace and reserves port 0.
- App-process and DevTools discovery use a **30,000 ms** deadline. Connection and request timeouts are **10,000 ms**. Shutdown waits **3,000 ms** after each signal. Port and process polling intervals are **250 ms** and **100 ms**. These are fixed operational bounds, not measured performance limits. Their exact durations only need to stay consistent across captures.
- The `delay()` values are **150**, **200**, **250**, **350**, **400**, **450**, **500**, **600**, **700**, **800**, **1,100**, **1,200**, **1,600**, and **1,800 ms**. They were not individually measured. They are UI-settling pauses kept fixed for repeatable before/after actions. Node timers use milliseconds ([Node.js timers](https://nodejs.org/api/timers.html)).
- `goto()` positions target examples in the fixed fixture files. Editor coordinates start at line **1**, column **1**. The multi-cursor example uses the first **3** `color` matches because the fixture has three occurrences. Mouse hit points use visible rectangle centers. The **6 × 3** coordinate nudge moves away from the drag start. It was not measured and only needs to stay fixed for the same attempted gesture.
- Input constants follow the documented protocol. Modifier masks are **0** for none, **1** for Alt, **2** for Ctrl, **4** for Meta/Command, **8** for Shift, and **12** for Meta plus Shift. Mouse button masks are **0** for released and **1** for left. `clickCount: 1` means one click. The key-code map uses Microsoft's virtual-key values.
- Request IDs initialize at **0**. Each send increments first, so the first ID is **1** and pending IDs stay distinct. JavaScript arrays and strings use zero-based offsets. JSON uses **2**-space formatting for readability. Chapter names use two-digit padding (`ch01`) for sorting. Fetched JSON has mode `0o600`, so only the runner's user can read it.
- Other integer literals are structural checks or indexes. The `-1` index selects the last settings-path segment; exact-one checks reject ambiguous DevTools targets, and positive checks require visible content or dimensions. `process.argv[2]` selects the first argument after Node and the script. `process.exit(0)` reports success for `--help`.
- The runner uses `128 + os.constants.signals[signal]` when interrupted. This follows the shell convention for signal exit status; Node exposes the platform's signal numbers in [`os.constants.signals`](https://nodejs.org/api/os.html#os_signal_constants).
- The extension installer checks byte offsets zero and one for gzip's `1f 8b` signature. Those bytes identify the package wrapper observed in the Marketplace response; [RFC 1952 defines the signature](https://www.rfc-editor.org/rfc/rfc1952.html).
- The three Chromium backgrounding switches are fixed because the VS Code window is deliberately occluded during capture. Chromium's switch source documents each effect, and Electron documents background throttling. Two `requestAnimationFrame` callbacks let the renderer finish the visible state before capture.

The kit requires an Apple Silicon Mac, Node.js from `mise.toml`, Swift, Swift Compiler, Git, and network access to Microsoft's update service, the pinned source repository, and the Marketplace. The terminal app that runs the kit needs **Screen & System Audio Recording** permission. Enable it in System Settings > Privacy & Security; see [Apple's guide](https://support.apple.com/guide/mac-help/mchl592e5686/mac). The runner uses `screencapture` to capture the VS Code window. Window lookup uses AppKit and Core Graphics window metadata, not Accessibility APIs, so no Accessibility permission is needed. Docker and Linux are **not yet supported**.

## Pinned extensions

| Extension                          |  Version | Used from     |
| ---------------------------------- | -------: | ------------- |
| `josemurilloc.aura-spirit-dracula` | `0.1.10` | Chapter 1     |
| `pkief.material-icon-theme`        | `5.40.0` | Chapter 2     |
| `subframe7536.custom-ui-style`     |  `0.7.2` | Chapters 3–11 |

The runner fetches each chapter's `.vscode/settings.json` and `.vscode/extensions.json` from its pinned `igorbabko/vscode-setup` commit at run time. That source repository has no license file, so the kit does not copy its settings or recommendation files into this repository. Fetched files and installed extensions stay under ignored `output/`; they are not committed. Unexpected recommendations stop the run instead of silently installing an unpinned extension.

Custom UI Style changes VS Code's bundled workbench CSS and JavaScript files. Its [official README](https://github.com/subframe7536/vscode-custom-ui-style#readme) says to apply settings with `Custom UI Style: Reload` from the Command Palette. The extension then offers a reload or app restart.

The runner issues that command through its DevTools connection after each Custom UI Style group. It cancels the extension's restart action and restarts only the VS Code PID it launched. The pinned extension's macOS restart helper quits the app by its global name. Before the extension starts, the isolated profile sets `custom-ui-style.watch` and `custom-ui-style.reloadWithoutPrompting` to `false`. This prevents settings writes from triggering unattended patch or restart operations. These runner-only safety settings are not copied into the source snapshots.

The runner copies the pinned app into ignored `output/runtime/` and applies Custom UI Style only to that disposable copy. It never opens or patches the VS Code app under `/Applications`.

Extensions are fetched from the versioned Visual Studio Marketplace package endpoint. The runner extracts each package's `extension/` directory into the isolated extensions folder instead of invoking VS Code's command-line installer while its window is open. This follows the extraction and folder naming used by the [pinned VS Code 1.101.1 extension manager](https://github.com/microsoft/vscode/blob/1.101.1/src/vs/platform/extensionManagement/node/extensionManagementService.ts#L615-L659). Before restarting, the runner clears only VS Code's generated extension list and scan cache so it discovers the newly added versioned folders. The downloaded packages and extracted extension files stay under ignored `output/runtime/`.

## Run

From the repository root:

```sh
mise install
lefthook install
node ./demos/vscode-setup-screenshots/scripts/run.mjs
```

Or run `node ./scripts/run.mjs` from this directory. The runner builds a fresh isolated profile and fetches all 11 pinned source snapshots. It installs each chapter's recommended extensions as that chapter is reached. It applies groups cumulatively, captures the screenshots, and writes `output/image-index.csv`. The index has one English description per image. All runtime files, app copies, fetched settings, extension files, and PNGs are ignored.

For a launch, attach, and capture smoke check without replacing the full image set, run `node ./scripts/run.mjs --smoke`. It captures `00-zero` and the chapter 1 theme pair under ignored `output/smoke/`. Append `--allow-focus-change` only when nobody is using the Mac; the runner then logs each frontmost transition and continues.

To reshoot only the chapter 11 autosave pair while preserving the other PNGs, run `node ./scripts/run.mjs --autosave-only`. This mode requires the existing 72-image index. It applies chapters cumulatively through the chapter 11 `sidebar-and-title` group, then replaces the autosave images and the two multi-cursor index descriptions. Chapter 11 sets `files.autoSave` to `afterDelay` but leaves `files.autoSaveDelay` unset. VS Code's documented default delay is 1,000 ms ([Auto Save documentation](https://code.visualstudio.com/docs/editing/codebasics)). The 10-second capture timeout is ten times that delay. Despite this margin, the edited fixture stayed dirty, so both autosave rows are inconclusive.

The run needs a visible, logged-in macOS desktop for VS Code window capture. The terminal app that launches the kit also needs the Screen & System Audio Recording permission described above. The app is started with workspace-trust prompts, telemetry, and update checks disabled. Unexpected dialogs and toasts stop capture. The fixture uses neutral names and a synthetic Git identity. App copies, fetched sources, extensions, and screenshots remain under ignored `output/`.

## Visual limits

The runner captures the expected recommendation toast only in the before image for that pair. It creates a runtime-only recommendation for `ms-python.python`, opens the Python fixture, then removes the recommendation. The operation-confirmation pair attempts to move a fixture file into `components`. In VS Code 1.101.1, the CDP drag does not trigger the confirmation or move the file, so the pair is indexed as inconclusive. `editor.multiCursorModifier` changes which key creates extra cursors, not how cursors look, so both images are indexed as inconclusive. The kit uses the same Option-click gesture in both captures. The chapter's `Dank Mono` family is not bundled; font rendering falls back to macOS's available fonts.

The fixture includes focused examples for nested sticky scroll, color decorations, signature help, and a TypeScript quick fix. It also covers tab indentation, selected whitespace, surface scrolling, and snippet suggestions. In this VS Code build, the tab-completion widget shows word completions rather than snippet items.

`output/image-index.csv` records each inconclusive pair and its reason. Current groups include `autosave`, `operation-confirmations`, `explorer-decorations`, `title-spacing`, `surface-boundaries`, `cursor-appearance`, and `multi-cursor`. It also lists `cursor-colors`, `code-style`, `marker-colors`, `tab-completion`, `selected-suggestion-color`, and `sidebar-and-title`.

## Kit layout

- `manifest/chapters.json` and `fixture/`: chapter commit pins, source paths, visual group keys, and the fixed sample project; the manifest contains no settings values.
- `scripts/fetch-sources.mjs` and `scripts/install-extension.mjs`: fetch the pinned settings and Marketplace packages, then extract extension files into the isolated runtime.
- `scripts/run.mjs`, `scripts/groups.mjs`, and `scripts/cdp.mjs`: prepare the fresh profile, apply cumulative settings, drive UI examples, capture images, write the index, and check expected UI state.
- `scripts/launch-app.swift` and `scripts/window-id.swift`: launch the disposable copy with `open -g -n`, identify its PID, read the frontmost app, and find its window ID.
- `output/`: ignored run artifacts.

## References

- macOS `open(1)` manual documents the `-g` and `-n` flags.
- Apple [window-list API](https://developer.apple.com/documentation/coregraphics/cgwindowlistcopywindowinfo%28_%3A_%3A%29?language=_5).
- Chromium [background switches](https://chromium.googlesource.com/chromium/src/+/e7826db76aa66d4727cb28afa9e3a722901ca5fc/content/public/common/content_switches.cc).
- Electron [background throttling](https://www.electronjs.org/docs/latest/api/browser-window#backgroundthrottling).
- Chrome DevTools Protocol [Input domain](https://chromedevtools.github.io/devtools-protocol/tot/Input/).
