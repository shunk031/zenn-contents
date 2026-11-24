import { readFileSync } from 'node:fs';
import { access, cp, mkdir, readFile, rename, rm, stat, writeFile, appendFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { VSCodeControl } from './cdp.mjs';
import { extensionPins, groupSpecs } from './groups.mjs';
import { installMarketplaceExtension } from './install-extension.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const kitDir = path.resolve(here, '..');
const outputDir = path.join(kitDir, 'output');
const smokeMode = process.argv.includes('--smoke');
const autosaveOnlyMode = process.argv.includes('--autosave-only');
const allowFocusChange = process.argv.includes('--allow-focus-change');
if (smokeMode && autosaveOnlyMode) throw new Error('Capture modes cannot be combined.');
const captureOutputDir = smokeMode ? path.join(outputDir, 'smoke') : outputDir;
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');
const runtimeDir = path.join(outputDir, 'runtime');
const vscodeArchive = path.join(outputDir, 'vscode-1.101.1-darwin-arm64.zip');
const sourceDir = path.join(runtimeDir, 'sources');
const profileDir = path.join(os.tmpdir(), `vss-${process.pid}`);
const extensionsDir = path.join(runtimeDir, 'extensions');
const marketplaceCacheDir = path.join(runtimeDir, 'marketplace-cache');
const workspaceDir = path.join(runtimeDir, 'workspace');
const appPath = path.join(runtimeDir, 'Visual Studio Code.app');
const finderSource = path.join(here, 'window-id.swift');
const finderBinary = path.join(runtimeDir, 'window-id');
const launcherSource = path.join(here, 'launch-app.swift');
const launcherBinary = path.join(runtimeDir, 'launch-app');
const imageDir = path.join(captureOutputDir, 'images');
const indexPath = path.join(captureOutputDir, 'image-index.csv');
const activePortFile = path.join(profileDir, 'DevToolsActivePort');
const windowSize = '1200,800';
const customUIStyleId = 'subframe7536.custom-ui-style';
let devtoolsPort;
let frontmostBaseline;
let lastFrontmost;
let focusChangeCount = 0;
const fixtureDir = path.join(kitDir, 'fixture');
const chapters = JSON.parse(await readFile(path.join(kitDir, 'manifest', 'chapters.json'), 'utf8'));

if (process.argv.includes('--help')) {
  console.log('Usage: node ./scripts/run.mjs [--smoke | --autosave-only] [--allow-focus-change]\nRebuilds the isolated VS Code profile and captures the 72-image screenshot set. --smoke captures only 00-zero and the chapter 1 theme pair under output/smoke/. --autosave-only preserves output/images and replaces the chapter 11 autosave pair and image index entries. --allow-focus-change logs frontmost changes and continues.');
  process.exit(0);
}

if (process.platform !== 'darwin') throw new Error('This screenshot route requires macOS.');
await mkdir(outputDir, { recursive: true });
if (autosaveOnlyMode) {
  const existingLines = (await readFile(indexPath, 'utf8')).trimEnd().split('\n');
  if (existingLines.length !== 73) throw new Error(`Expected an existing 72-image index before targeted capture; found ${existingLines.length - 1} rows.`);
}
await rm(runtimeDir, { recursive: true, force: true });
await mkdir(runtimeDir, { recursive: true });
await rm(profileDir, { recursive: true, force: true });
if (!autosaveOnlyMode) await rm(imageDir, { recursive: true, force: true });
await mkdir(imageDir, { recursive: true });
await mkdir(extensionsDir, { recursive: true });
await cp(fixtureDir, workspaceDir, { recursive: true });

try {
  await access(vscodeArchive);
} catch {
  execFileSync('curl', ['-fsSL', 'https://update.code.visualstudio.com/1.101.1/darwin-arm64/stable', '-o', vscodeArchive], { stdio: 'inherit' });
}
execFileSync('ditto', ['-x', '-k', vscodeArchive, runtimeDir], { stdio: 'inherit' });
const product = JSON.parse(readFileSync(path.join(appPath, 'Contents', 'Resources', 'app', 'product.json'), 'utf8'));
if (product.version !== '1.101.1' || product.commit !== '18e3a1ec544e6907be1e944a94c496e302073435') {
  throw new Error(`Downloaded VS Code product identity did not match the pin: ${product.version} ${product.commit}`);
}
execFileSync('swiftc', ['-O', finderSource, '-o', finderBinary], { stdio: 'inherit' });
execFileSync('swiftc', ['-O', launcherSource, '-o', launcherBinary], { stdio: 'inherit' });

execFileSync('git', ['init', '--quiet', '--initial-branch=main'], { cwd: workspaceDir });
execFileSync('git', ['config', 'user.name', 'Screenshot Fixture'], { cwd: workspaceDir });
execFileSync('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: workspaceDir });
execFileSync('git', ['add', '.'], { cwd: workspaceDir });
execFileSync('git', ['commit', '--quiet', '-m', 'Create synthetic screenshot fixture'], { cwd: workspaceDir });
await appendFile(path.join(workspaceDir, 'src', 'changed.ts'), '\n// local edit\n');
await appendFile(path.join(workspaceDir, 'src', 'autosave.ts'), '\nconst trim = "base";   \n');

const fetcher = path.join(here, 'fetch-sources.mjs');
execFileSync(process.execPath, [fetcher, sourceDir], { stdio: 'inherit' });

const userSettingsPath = path.join(profileDir, 'User', 'settings.json');
await mkdir(path.dirname(userSettingsPath), { recursive: true });
let appliedSettings = {};
let windowControl;
let appChild;
const installedExtensions = new Set();
const indexRows = [];
const imageNames = new Set();

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...options }).trim();
}

function frontmostApplication() {
  const [pidText, bundleId, name] = run(launcherBinary, ['--frontmost']).split('\t');
  const pid = Number(pidText);
  if (!Number.isInteger(pid) || pid < 1 || !bundleId || !name) throw new Error('Could not identify the macOS frontmost application.');
  return { pid, bundleId, name };
}

function assertFrontmostUnchanged(stage) {
  const current = frontmostApplication();
  if (!frontmostBaseline) frontmostBaseline = current;
  if (!lastFrontmost) lastFrontmost = frontmostBaseline;
  if (current.pid !== lastFrontmost.pid || current.bundleId !== lastFrontmost.bundleId) {
    const change = `Frontmost application changed ${stage}: ${lastFrontmost.name} (PID ${lastFrontmost.pid}) -> ${current.name} (PID ${current.pid}).`;
    if (!allowFocusChange) throw new Error(change);
    focusChangeCount += 1;
    console.log(`${change} Continuing because --allow-focus-change is set.`);
    lastFrontmost = current;
  }
  return current;
}

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      target[key] = deepMerge(target[key] && typeof target[key] === 'object' ? target[key] : {}, value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

function setPath(target, parts, value) {
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    if (!cursor[part] || typeof cursor[part] !== 'object' || Array.isArray(cursor[part])) cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = structuredClone(value);
}

function copyGroupSettings(sourceSettings, paths) {
  const subset = {};
  for (const parts of paths) {
    let value = sourceSettings;
    let found = true;
    for (const part of parts) {
      if (!value || typeof value !== 'object' || !(part in value)) {
        found = false;
        break;
      }
      value = value[part];
    }
    if (!found) throw new Error(`A group setting is missing from its pinned chapter source: ${parts.join(' / ')}`);
    setPath(subset, parts, value);
  }
  return subset;
}

async function writeSettings(settings) {
  appliedSettings = structuredClone(settings);
  const runtimeSettings = structuredClone(settings);
  if (installedExtensions.has(customUIStyleId)) {
    runtimeSettings['custom-ui-style.watch'] = false;
    runtimeSettings['custom-ui-style.reloadWithoutPrompting'] = false;
  }
  await writeFile(userSettingsPath, `${JSON.stringify(runtimeSettings, null, 2)}\n`, { mode: 0o600 });
  await delay(600);
}

async function writeTransientSettings(settings) {
  const nextSettings = deepMerge(structuredClone(appliedSettings), settings);
  if (installedExtensions.has(customUIStyleId)) {
    nextSettings['custom-ui-style.watch'] = false;
    nextSettings['custom-ui-style.reloadWithoutPrompting'] = false;
  }
  await writeFile(userSettingsPath, `${JSON.stringify(nextSettings, null, 2)}\n`, { mode: 0o600 });
  await delay(600);
}

function sourceFile(chapterNumber, filename) {
  return path.join(sourceDir, `ch${String(chapterNumber).padStart(2, '0')}`, filename);
}

function readChapterSettings(chapter) {
  return JSON.parse(readFileSync(sourceFile(chapter.chapter, 'settings.json'), 'utf8'));
}

async function installRecommendations(chapter) {
  const recommendationFile = JSON.parse(await readFile(sourceFile(chapter.chapter, 'extensions.json'), 'utf8'));
  for (const extension of recommendationFile.recommendations) {
    const id = extension.toLowerCase();
    const version = extensionPins.get(id);
    if (!version) throw new Error(`No pinned Marketplace version is configured for recommendation ${extension}`);
    if (installedExtensions.has(id)) continue;
    console.log(`Installing ${id}@${version} from Marketplace for chapter ${chapter.chapter}.`);
    await installMarketplaceExtension(id, version, extensionsDir, marketplaceCacheDir);
    await rm(path.join(extensionsDir, 'extensions.json'), { force: true });
    await rm(path.join(profileDir, 'CachedProfilesData', '__default__profile__', 'extensions.user.cache'), { force: true });
    installedExtensions.add(id);
  }
  if (installedExtensions.has(customUIStyleId)) await writeSettings(appliedSettings);
}

function launchArgs() {
  return [
    '--user-data-dir', profileDir,
    '--extensions-dir', extensionsDir,
    '--disable-workspace-trust',
    '--disable-telemetry',
    '--disable-updates',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--remote-debugging-port=0',
    '--window-size=' + windowSize,
    '--skip-welcome',
    workspaceDir,
  ];
}

const fixedFiles = [
    'src/styles.css',
    'src/multi-cursor.ts',
    'src/suggestions.ts',
    'src/index.html',
    'src/emmet.html',
    'src/autosave.ts',
    'src/diagnostics.ts',
    'src/changed.ts',
    'src/main.ts',
  ];

async function openFixedFiles() {
  for (const file of fixedFiles) await windowControl.openFile(file);
}

function childIsRunning(child) {
  if (!child?.pid) return false;
  try {
    process.kill(child.pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'EPERM') return true;
    if (error.code === 'ESRCH') return false;
    throw error;
  }
}

async function waitForDevToolsPort(child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (!childIsRunning(child)) throw new Error('VS Code exited before creating its DevTools port file.');
    try {
      const lines = (await readFile(activePortFile, 'utf8')).trim().split(/\r?\n/);
      const port = Number(lines[0]);
      if (Number.isInteger(port) && port > 0 && port <= 65535 && /^\/devtools\/browser\//.test(lines[1] || '')) {
        return port;
      }
    } catch {}
    await delay(250);
  }
  throw new Error(`VS Code did not create a valid DevTools port file at ${activePortFile}`);
}

async function waitForChildExit(child, timeout) {
  const deadline = Date.now() + timeout;
  while (childIsRunning(child) && Date.now() < deadline) await delay(100);
  return !childIsRunning(child);
}

async function startApp({ clearNotifications = true } = {}) {
  if (appChild) return;
  const beforeLaunch = assertFrontmostUnchanged('before VS Code launch');
  console.log(`Frontmost before VS Code launch: ${beforeLaunch.name} (PID ${beforeLaunch.pid}).`);
  await rm(activePortFile, { force: true });
  const pidText = run(launcherBinary, [appPath, ...launchArgs()]);
  const child = { pid: Number(pidText) };
  if (!Number.isInteger(child.pid) || child.pid < 1) throw new Error('The macOS launcher did not return a VS Code process ID.');
  appChild = child;
  const afterLaunch = assertFrontmostUnchanged('after VS Code launch');
  console.log(`Frontmost after VS Code launch: ${afterLaunch.name} (PID ${afterLaunch.pid}).`);
  devtoolsPort = await waitForDevToolsPort(child);
  windowControl = new VSCodeControl(devtoolsPort, appPath);
  await windowControl.connect();
  await openFixedFiles();
  if (installedExtensions.has(customUIStyleId)) {
    await windowControl.clickNotificationAction('first time use', 'No', 250);
  }
  if (clearNotifications) await windowControl.clearNotifications();
  await delay(800);
  assertFrontmostUnchanged('after VS Code became ready');
}

async function quitApp() {
  const child = appChild;
  windowControl?.close();
  windowControl = null;
  if (childIsRunning(child)) {
    process.kill(child.pid, 'SIGTERM');
    if (!await waitForChildExit(child, 3000)) {
      process.kill(child.pid, 'SIGKILL');
      if (!await waitForChildExit(child, 3000)) {
        throw new Error(`Could not stop the VS Code process started by this run (PID ${child.pid}).`);
      }
    }
  }
  appChild = null;
  devtoolsPort = undefined;
  await rm(activePortFile, { force: true });
}

async function stopApp() {
  await quitApp();
}

let signalCleanupStarted = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (signalCleanupStarted) return;
    signalCleanupStarted = true;
    void (async () => {
      try {
        await stopApp();
        await rm(profileDir, { recursive: true, force: true });
      } catch (error) {
        console.error(`Could not clean up after ${signal}:`, error);
      }
      process.exit(128 + os.constants.signals[signal]);
    })();
  });
}

async function restartApp({ clearNotifications = true } = {}) {
  if (windowControl) {
    const restartPrompt = await windowControl.evaluate("document.body.innerText.includes('requires a restart to take effect')");
    if (restartPrompt) {
      let clicked;
      try {
        clicked = await windowControl.evaluate(`(() => {
          const button = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === 'Restart');
          if (!button) return false;
          button.click();
          return true;
        })()`);
      } catch {
        clicked = true;
      }
      if (!clicked) throw new Error('A restart prompt appeared, but its Restart button was not available.');
      windowControl.close();
      windowControl = null;
      await delay(1800);
      windowControl = new VSCodeControl(devtoolsPort, appPath);
      await windowControl.connect();
      await openFixedFiles();
      if (clearNotifications) await windowControl.clearNotifications();
      return;
    }
  }
  await quitApp();
  await startApp({ clearNotifications });
  if (clearNotifications) await windowControl.clearNotifications();
}

async function applyCustomUIStyleAndRestart() {
  await windowControl.command('Custom UI Style: Reload');
  const canceledExtensionRestart = await windowControl.clickNotificationAction('UI Style changed.', 'Cancel');
  if (!canceledExtensionRestart) {
    throw new Error('Custom UI Style did not offer its documented reload notification with a Cancel action.');
  }
  await quitApp();
  await startApp();
}

function sourceSettingsFor(chapter) {
  return readChapterSettings(chapter);
}

async function open(file) {
  await windowControl.openFile(file);
}

async function goto(line, column = 1) {
  await windowControl.gotoLine(line, column);
}

function fixtureLine(relativePath, text) {
  const contents = readFileSync(path.join(workspaceDir, relativePath), 'utf8').split(/\r?\n/);
  const index = contents.findIndex((line) => line.includes(text));
  if (index < 0) throw new Error(`Fixture text not found in ${relativePath}: ${text}`);
  return { line: index + 1, column: contents[index].indexOf(text) + 1, text: contents[index] };
}

async function runInteraction(name, phase, chapterSettings) {
  if (!name) return;
  switch (name) {
    case 'cursor-focus':
      await open('src/main.ts');
      await goto(8, 12);
      break;
    case 'editor-top':
      await open('src/main.ts');
      await goto(1, 1);
      break;
    case 'code-lens':
      await open('src/main.ts');
      await goto(5, 1);
      await delay(1800);
      break;
    case 'surface-boundaries':
      await open('src/surface-scroll.ts');
      await goto(34, 1);
      await windowControl.clickExplorerFile('surface-scroll.ts');
      await windowControl.moveToSelector('.sidebar .title');
      await delay(400);
      break;
    case 'tree-layout':
      await open('src/components/common/Button/index.ts');
      await windowControl.command('File: Reveal Active File in Explorer');
      break;
    case 'multi-cursor': {
      await open('src/multi-cursor.ts');
      await goto(1, 1);
      const points = await windowControl.moveToText('color');
      const chosen = points.slice(0, 3);
      // Keep the gesture fixed so the screenshot exposes the modifier setting's effect.
      for (const point of chosen) await windowControl.click(point.x, point.y, 1);
      break;
    }
    case 'find-widget':
      await open('src/main.ts');
      await windowControl.key('F', 'KeyF', 4);
      await delay(400);
      break;
    case 'command-palette':
      await open('src/main.ts');
      await windowControl.key('Escape', 'Escape');
      await windowControl.key('P', 'KeyP', 12);
      await delay(400);
      break;
    case 'overview-ruler-search':
      await open('src/main.ts');
      await windowControl.key('F', 'KeyF', 4);
      await delay(250);
      await windowControl.type('formatName');
      await delay(500);
      break;
    case 'hover': {
      await open('src/main.ts');
      const [point] = await windowControl.moveToText('formatName');
      await windowControl.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
      await delay(1100);
      break;
    }
    case 'automatic-suggestions':
      await open('src/suggestions.ts');
      await windowControl.key('ArrowDown', 'ArrowDown', 4);
      await windowControl.key('End', 'End');
      await windowControl.type('.');
      await delay(1100);
      break;
    case 'tab-completion':
      await open('src/snippet-suggestions.ts');
      {
        const prefix = fixtureLine('src/snippet-suggestions.ts', 'sam');
        await goto(prefix.line, prefix.column + 'sam'.length);
      }
      await windowControl.key('Space', 'Space', 2);
      await delay(500);
      {
        const suggestionState = await windowControl.evaluate(`(() => {
          const widget = document.querySelector('.suggest-widget');
          const rows = [...document.querySelectorAll('.suggest-widget .monaco-list-row')].map((row) => row.innerText);
          return { visible: !!widget?.getBoundingClientRect().height, rows };
        })()`);
        if (!suggestionState.visible || !suggestionState.rows.some((row) => /sample/i.test(row))) {
          throw new Error(`The snippet suggestion example did not open with the fixture snippets: ${JSON.stringify(suggestionState)}`);
        }
      }
      break;
    case 'selected-suggestion':
      await open('src/suggestions.ts');
      await goto(7, 7);
      await windowControl.type('.');
      await delay(500);
      let suggestionVisible = await windowControl.evaluate("!!document.querySelector('.suggest-widget')?.getBoundingClientRect().height");
      if (!suggestionVisible) {
        await windowControl.key('Space', 'Space', 2);
        await delay(500);
        suggestionVisible = await windowControl.evaluate("!!document.querySelector('.suggest-widget')?.getBoundingClientRect().height");
      }
      if (!suggestionVisible) throw new Error('The selected-suggestion example did not open the completion widget.');
      await windowControl.key('ArrowDown', 'ArrowDown');
      await delay(500);
      const selectedSuggestion = await windowControl.evaluate("!!document.querySelector('.suggest-widget .monaco-list-row.focused, .suggest-widget .monaco-list-row.selected, .suggest-widget .monaco-list-row[aria-selected=\"true\"]')");
      if (!selectedSuggestion) throw new Error('The completion widget has no visibly selected item.');
      break;
    case 'autosave':
      await open('src/autosave.ts');
      await windowControl.key('ArrowDown', 'ArrowDown', 4);
      await windowControl.key('End', 'End');
      await windowControl.type(' // edit');
      if (phase === 'after') {
        const editedFile = path.join(workspaceDir, 'src', 'autosave.ts');
        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
          if ((await readFile(editedFile, 'utf8')).includes('// edit')) {
            await delay(250);
            return true;
          }
          await delay(250);
        }
        return false;
      }
      break;
    case 'operation-confirmations': {
      const file = path.join(workspaceDir, 'src', 'delete-me.txt');
      await writeFile(file, await readFile(path.join(fixtureDir, 'src', 'delete-me.txt')));
      await open('src/delete-me.txt');
      await windowControl.command('File: Reveal Active File in Explorer');
      await windowControl.dragExplorerFileToFolder('delete-me.txt', 'components');
      await delay(700);
      if (phase === 'after') {
        const movedFile = path.join(workspaceDir, 'src', 'components', 'delete-me.txt');
        try {
          await access(movedFile);
          await rename(movedFile, file);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
        await delay(500);
        await open('src/delete-me.txt');
      }
      break;
    }
    case 'recommendations': {
      const vscodeDir = path.join(workspaceDir, '.vscode');
      await mkdir(vscodeDir, { recursive: true });
      await writeFile(path.join(vscodeDir, 'extensions.json'), `${JSON.stringify({ recommendations: ['ms-python.python'] }, null, 2)}\n`);
      if (phase === 'before') await restartApp({ clearNotifications: false });
      await open('src/sample.py');
      await delay(1600);
      break;
    }
    case 'code-style':
      await open('src/code-style.ts');
      await goto(1, 1);
      break;
    case 'code-decorations': {
      await open('src/nested-styles.css');
      {
        const target = fixtureLine('src/nested-styles.css', '.card-36');
        await goto(target.line, target.text.indexOf('#9b87f5') + 1);
      }
      await delay(600);
      break;
    }
    case 'editor-hints': {
      await open('src/editor-hints.ts');
      {
        const target = fixtureLine('src/editor-hints.ts', 'formatLabel(42');
        await goto(target.line, target.text.indexOf('42') + 1);
      }
      if (phase === 'before') await windowControl.command('Trigger Parameter Hints');
      await delay(700);
      break;
    }
    case 'indentation-tabs': {
      await open('src/indentation.ts');
      const target = fixtureLine('src/indentation.ts', 'return `${heading}:');
      await goto(target.line, 1);
      break;
    }
    case 'folding-and-guides': {
      await open('src/indentation.ts');
      const target = fixtureLine('src/indentation.ts', 'return `${heading}:');
      await goto(target.line, 1);
      await windowControl.key('End', 'End', 8);
      await windowControl.moveToSelector('.monaco-editor .glyph-margin');
      await delay(400);
      break;
    }
    case 'scrollbars-and-ruler': {
      await open('src/surface-scroll.ts');
      const target = fixtureLine('src/surface-scroll.ts', 'surface line 40');
      await goto(target.line, target.column);
      break;
    }
    case 'marker-colors': {
      await open('src/diagnostics.ts');
      await goto(1, 35);
      await delay(1200);
      break;
    }
    case 'save-diff': {
      const file = path.join(workspaceDir, 'src', 'save-state.ts');
      await writeFile(file, 'const saved = "changed";   ');
      await open('src/save-state.ts');
      await goto(1, 1);
      await windowControl.key('End', 'End');
      await windowControl.key('S', 'KeyS', 4);
      await delay(600);
      break;
    }
    default:
      throw new Error(`Unknown UI interaction: ${name}`);
  }
}

async function resetInteraction(name, phase) {
  if (!name) return;
  switch (name) {
    case 'automatic-suggestions':
      await windowControl.key('Escape', 'Escape');
      await windowControl.key('Backspace', 'Backspace');
      break;
    case 'tab-completion':
      await windowControl.key('Escape', 'Escape');
      break;
    case 'selected-suggestion':
      await windowControl.key('Escape', 'Escape');
      await windowControl.key('Z', 'KeyZ', 4);
      break;
    case 'find-widget':
    case 'overview-ruler-search':
    case 'hover':
    case 'command-palette':
    case 'editor-hints':
      await windowControl.key('Escape', 'Escape');
      break;
    case 'multi-cursor':
      await windowControl.key('Escape', 'Escape');
      break;
    case 'operation-confirmations':
      await windowControl.key('Escape', 'Escape');
      await rm(path.join(workspaceDir, 'src', 'components', 'delete-me.txt'), { force: true });
      await writeFile(path.join(workspaceDir, 'src', 'delete-me.txt'), await readFile(path.join(fixtureDir, 'src', 'delete-me.txt')));
      await delay(400);
      break;
    case 'recommendations':
      await windowControl.clearNotifications();
      break;
    case 'surface-boundaries':
    case 'code-style':
    case 'code-decorations':
    case 'indentation-tabs':
    case 'folding-and-guides':
    case 'scrollbars-and-ruler':
    case 'marker-colors':
      break;
    case 'save-diff':
      await writeFile(path.join(workspaceDir, 'src', 'save-state.ts'), await readFile(path.join(fixtureDir, 'src', 'save-state.ts')));
      break;
    case 'autosave':
      await windowControl.key('Escape', 'Escape');
      if (phase === 'before') await windowControl.key('Z', 'KeyZ', 4);
      await writeFile(path.join(workspaceDir, 'src', 'autosave.ts'), await readFile(path.join(fixtureDir, 'src', 'autosave.ts')));
      break;
    default:
      break;
  }
  await open('src/main.ts');
  await goto(1, 1);
  await delay(250);
}

function imageFilename(name) {
  if (imageNames.has(name)) throw new Error(`Duplicate screenshot name: ${name}`);
  imageNames.add(name);
  return path.join(imageDir, name);
}

async function capture(name, chapter, group, description, captureState = 'none') {
  assertFrontmostUnchanged(`before capture ${name}`);
  if (captureState === 'operation-confirmation') await windowControl.assertExpectedOperationConfirmation();
  else if (captureState === 'recommendation-toast') await windowControl.assertExpectedRecommendationToast();
  else await windowControl.assertNoModalOrToast();
  await windowControl.waitForPaint();
  const destination = imageFilename(name);
  const captureDestination = `${destination}.${process.pid}.capture.png`;
  await rm(captureDestination, { force: true });
  if (!childIsRunning(appChild)) throw new Error('Refusing to capture without the VS Code process started by this run.');
  const finderArgs = [appPath, String(appChild.pid)];
  if (allowFocusChange) finderArgs.push('--allow-frontmost');
  const [windowId, width, height, windowOrder, otherWindowOrder] = run(finderBinary, finderArgs).split(/\s+/);
  if (width !== '1200' || height !== '800') {
    throw new Error(`Expected a 1200x800 point window, found ${width}x${height}`);
  }
  const beforeCapture = assertFrontmostUnchanged(`immediately before capture ${name}`);
  console.log(`Frontmost before capture ${name}: ${beforeCapture.name} (PID ${beforeCapture.pid}).`);
  const captureStartedAt = Date.now();
  execFileSync('screencapture', ['-x', '-l', windowId, captureDestination], { stdio: 'inherit' });
  const image = await readFile(captureDestination);
  const imageInfo = await stat(captureDestination);
  if (imageInfo.size < pngSignature.length || !image.subarray(0, pngSignature.length).equals(pngSignature) || imageInfo.mtimeMs < captureStartedAt) {
    throw new Error(`The capture was not a fresh PNG: ${captureDestination}`);
  }
  const dimensions = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', captureDestination], { encoding: 'utf8' });
  if (!dimensions.includes('pixelWidth:') || !dimensions.includes('pixelHeight:')) throw new Error(`Unable to verify screenshot dimensions: ${destination}`);
  await rename(captureDestination, destination);
  const afterCapture = assertFrontmostUnchanged(`immediately after capture ${name}`);
  const [afterWindowId, , , afterWindowOrder, afterOtherWindowOrder] = run(finderBinary, finderArgs).split(/\s+/);
  if (beforeCapture.pid !== afterCapture.pid || afterWindowId !== windowId
      || (!allowFocusChange && (Number(windowOrder) <= Number(otherWindowOrder)
        || Number(afterWindowOrder) <= Number(afterOtherWindowOrder)))) {
    throw new Error(`Capture ${name} did not preserve window identity or frontmost application.`);
  }
  console.log(`Captured ${name}; frontmost remains ${afterCapture.name} (PID ${afterCapture.pid}).`);
  indexRows.push({ chapter, group, file: path.relative(outputDir, destination), description });
}

async function capturePair(chapter, groupKey, currentSettings) {
  const spec = groupSpecs[groupKey];
  const beforeName = `ch${String(chapter.chapter).padStart(2, '0')}-${groupKey}-before.png`;
  const afterName = `ch${String(chapter.chapter).padStart(2, '0')}-${groupKey}-after.png`;
  if (spec.previewSettings) await writeTransientSettings(spec.previewSettings);
  await runInteraction(spec.interaction, 'before', appliedSettings);
  let operationInconclusiveReason = '';
  if (groupKey === 'operation-confirmations') {
    const state = await windowControl.notificationState();
    if (!/move|drag/i.test(state.dialogs.join('\n'))) {
      operationInconclusiveReason = 'Inconclusive: the CDP Explorer drag did not trigger a move confirmation in VS Code 1.101.1.';
    }
  }
  const beforeText = groupKey === 'operation-confirmations'
    ? operationInconclusiveReason || 'Before operation-confirmations, dragging the fixture file into components opens a confirmation dialog.'
    : groupKey === 'recommendation-notifications'
      ? 'Before recommendation-notifications, opening the Python fixture shows an extension recommendation toast.'
      : spec.inconclusiveReason || `The sample project editor and Explorer show the cumulative state before ${groupKey} is applied.`;
  const beforeCaptureState = groupKey === 'operation-confirmations'
    ? operationInconclusiveReason ? 'none' : 'operation-confirmation'
    : groupKey === 'recommendation-notifications'
      ? 'recommendation-toast'
      : 'none';
  await capture(beforeName, chapter.chapter, groupKey, beforeText, beforeCaptureState);
  await resetInteraction(spec.interaction, 'before');
  if (spec.previewSettings) await writeSettings(appliedSettings);

  const groupSettings = copyGroupSettings(currentSettings, spec.settings);
  const nextSettings = deepMerge(structuredClone(appliedSettings), groupSettings);
  await writeSettings(nextSettings);
  if (spec.settings.some(([first]) => first.startsWith('custom-ui-style.'))) {
    await applyCustomUIStyleAndRestart();
  } else if (spec.restart) await restartApp();
  if (spec.previewSettings) await writeTransientSettings(spec.previewSettings);
  const interactionResult = await runInteraction(spec.interaction, 'after', currentSettings);
  const autosaveInconclusiveReason = groupKey === 'autosave' && interactionResult === false
    ? 'Inconclusive: with files.autoSave set to afterDelay and files.autoSaveDelay unset, VS Code kept the edited fixture dirty through the 10-second wait.'
    : '';
  if (autosaveInconclusiveReason) {
    const beforeRow = indexRows.find((row) => row.chapter === chapter.chapter
      && row.group === groupKey
      && row.file === path.relative(outputDir, path.join(imageDir, beforeName)));
    if (beforeRow) beforeRow.description = autosaveInconclusiveReason;
  }
  const afterText = operationInconclusiveReason || spec.inconclusiveReason || autosaveInconclusiveReason || `After ${groupKey} is applied, ${spec.description}`;
  await capture(afterName, chapter.chapter, groupKey, afterText);
  await resetInteraction(spec.interaction, 'after');
  if (spec.previewSettings) await writeSettings(appliedSettings);

  if (groupKey === 'recommendation-notifications') {
    await rm(path.join(workspaceDir, '.vscode', 'extensions.json'), { force: true });
  }

  if (spec.interaction === 'autosave') {
    await writeFile(path.join(workspaceDir, 'src', 'autosave.ts'), await readFile(path.join(fixtureDir, 'src', 'autosave.ts')));
  }
  return appliedSettings;
}

function csv(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

const groupCount = chapters.reduce((count, chapter) => count + chapter.groups.length, 0);
if (groupCount !== 30) throw new Error(`Expected 30 visual groups; found ${groupCount}`);
const manifestGroupKeys = chapters.flatMap((chapter) => chapter.groups);
for (const key of manifestGroupKeys) {
  if (!groupSpecs[key]) throw new Error(`No script mapping exists for manifest group ${key}`);
}

for (const chapter of chapters) {
  const sourceSettings = readChapterSettings(chapter);
  const recommendations = JSON.parse(readFileSync(sourceFile(chapter.chapter, 'extensions.json'), 'utf8')).recommendations;
  for (const id of recommendations) {
    if (!extensionPins.has(id.toLowerCase())) throw new Error(`No extension version pin exists for ${id}`);
  }
  for (const groupKey of chapter.groups) {
    const spec = groupSpecs[groupKey];
    if (spec.chapter !== chapter.chapter) throw new Error(`Group ${groupKey} is assigned to the wrong chapter`);
    copyGroupSettings(sourceSettings, spec.settings);
  }
}

try {
  frontmostBaseline = frontmostApplication();
  console.log(`Frontmost application before the run: ${frontmostBaseline.name} (PID ${frontmostBaseline.pid}).`);
  await startApp();
  if (autosaveOnlyMode) {
    for (const chapter of chapters) {
      await installRecommendations(chapter);
      await restartApp();
      await windowControl.clearNotifications();
      const currentSettings = sourceSettingsFor(chapter);
      if (chapter.chapter < 11) {
        await writeSettings(currentSettings);
        await restartApp();
        continue;
      }

      const priorGroup = groupSpecs['sidebar-and-title'];
      const nextSettings = deepMerge(structuredClone(appliedSettings), copyGroupSettings(currentSettings, priorGroup.settings));
      await writeSettings(nextSettings);
      if (priorGroup.restart) await restartApp();
      await capturePair(chapter, 'autosave', currentSettings);
      break;
    }
  } else {
    await capture('00-zero.png', 0, 'zero', 'A fresh profile opens the fixed sample project with no user-installed extensions.');

    const selectedChapters = smokeMode ? chapters.slice(0, 1) : chapters;
    for (const chapter of selectedChapters) {
      await installRecommendations(chapter);
      await restartApp();
      await windowControl.clearNotifications();

      const currentSettings = sourceSettingsFor(chapter);
      const selectedGroups = smokeMode ? chapter.groups.slice(0, 1) : chapter.groups;
      for (const groupKey of selectedGroups) {
        await capturePair(chapter, groupKey, currentSettings);
      }

      if (smokeMode) continue;
      await writeSettings(currentSettings);
      await restartApp();
      await windowControl.key('Escape', 'Escape');
      await open('src/main.ts');
      await delay(600);
      const checkpointName = `ch${String(chapter.chapter).padStart(2, '0')}-checkpoint.png`;
      await capture(checkpointName, chapter.chapter, 'checkpoint', `After chapter ${chapter.chapter}, its cumulative settings are shown in the fixed sample project.`);
    }
  }
} finally {
  await stopApp();
  await rm(profileDir, { recursive: true, force: true });
}

const expectedImageCount = smokeMode ? 3 : autosaveOnlyMode ? 2 : 72;
if (indexRows.length !== expectedImageCount || imageNames.size !== expectedImageCount) {
  throw new Error(`Expected ${expectedImageCount} screenshots; captured ${imageNames.size}`);
}
const rowLine = (row) => [row.chapter, row.group, row.file, row.description].map(csv).join(',');
if (autosaveOnlyMode) {
  const existingLines = (await readFile(indexPath, 'utf8')).trimEnd().split('\n');
  if (existingLines.length !== 73) throw new Error(`Expected an existing 72-image index before targeted capture; found ${existingLines.length - 1} rows.`);
  let autosaveInserted = false;
  let multiCursorInserted = false;
  const mergedLines = [existingLines[0]];
  for (const line of existingLines.slice(1)) {
    if (line.startsWith('"11","autosave",')) {
      if (!autosaveInserted) mergedLines.push(...indexRows.map(rowLine));
      autosaveInserted = true;
      continue;
    }
    if (line.startsWith('"5","multi-cursor",')) {
      if (!multiCursorInserted) {
        for (const side of ['before', 'after']) {
          mergedLines.push(rowLine({
            chapter: 5,
            group: 'multi-cursor',
            file: `images/ch05-multi-cursor-${side}.png`,
            description: groupSpecs['multi-cursor'].inconclusiveReason,
          }));
        }
        multiCursorInserted = true;
      }
      continue;
    }
    mergedLines.push(line);
  }
  if (!autosaveInserted || !multiCursorInserted || mergedLines.length !== 73) {
    throw new Error('Could not merge the targeted autosave and multi-cursor index rows into the existing 72-image index.');
  }
  await writeFile(indexPath, mergedLines.join('\n') + '\n');
} else {
  await writeFile(indexPath, [
    ['chapter', 'group', 'file', 'description'].map(csv).join(','),
    ...indexRows.map(rowLine),
  ].join('\n') + '\n');
}
console.log(`Captured ${imageNames.size} PNGs. Image index: ${indexPath}`);
console.log(`Observed ${focusChangeCount} frontmost application change(s).`);
