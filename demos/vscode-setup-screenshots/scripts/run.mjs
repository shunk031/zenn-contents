import { readFileSync } from 'node:fs';
import { access, copyFile, cp, mkdir, readFile, rename, rm, stat, writeFile, appendFile } from 'node:fs/promises';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { VSCodeControl, visibleGeometry } from './cdp.mjs';
import { extensionPins, groupSpecs } from './groups.mjs';
import { installMarketplaceExtension } from './install-extension.mjs';
import * as planner from './planner.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const kitDir = path.resolve(here, '..');
const outputRoot = path.join(kitDir, 'output');
const chapters = JSON.parse(await readFile(path.join(kitDir, 'manifest', 'chapters.json'), 'utf8'));
const pairRegistry = planner.createPairRegistry(chapters, groupSpecs);
const runOptions = planner.parseRunArgs(process.argv.slice(2), pairRegistry);
const smokeMode = runOptions.smoke;
const runId = runOptions.only ? `${new Date().toISOString().replaceAll(':', '').replaceAll('-', '').replaceAll('.', '')}-${process.pid}` : null;
const outputDir = runOptions.only ? path.join(outputRoot, 'subsets', runId) : smokeMode ? path.join(outputRoot, 'smoke') : outputRoot;
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');
const runtimeDir = runOptions.only ? path.join(outputDir, 'runtime') : path.join(outputRoot, 'runtime');
const vscodeArchive = path.join(outputRoot, 'vscode-1.101.1-darwin-arm64.zip');
const sourceDir = path.join(runtimeDir, 'sources');
const profileDir = path.join(os.tmpdir(), `vss-${process.pid}`);
const extensionsDir = path.join(runtimeDir, 'extensions');
const marketplaceCacheDir = path.join(outputRoot, 'runtime', 'marketplace-cache');
const workspaceDir = path.join(runtimeDir, 'workspace');
const appPath = path.join(runtimeDir, 'Visual Studio Code.app');
const appExecutable = path.join(appPath, 'Contents', 'MacOS', 'Electron');
const finderSource = path.join(here, 'window-id.swift');
const finderBinary = path.join(runtimeDir, 'window-id');
const cliPath = path.join(appPath, 'Contents', 'Resources', 'app', 'bin', 'code');
const frontmostSource = path.join(here, 'frontmost.swift');
const frontmostBinary = path.join(runtimeDir, 'frontmost');
const imageDir = path.join(outputDir, 'images');
const indexPath = path.join(outputDir, 'image-index.csv');
const activePortFile = path.join(profileDir, 'DevToolsActivePort');
const windowSize = '1200,800';
const customUIStyleId = 'subframe7536.custom-ui-style';
let devtoolsPort;
let ownerIdleSample;
const fixtureDir = path.join(kitDir, 'fixture');

if (runOptions.help) {
  console.log(`Usage: node ./scripts/run.mjs [--smoke] [--only <pair,...>]\nAvailable pairs: ${pairRegistry.map((pair) => pair.canonical).join(', ')}`);
  process.exit(0);
}

if (process.platform !== 'darwin') throw new Error('This screenshot route requires macOS.');
assertOwnerAway('run start');
await mkdir(outputDir, { recursive: true });
if (runOptions.only) await mkdir(runtimeDir, { recursive: false });
else {
  await rm(runtimeDir, { recursive: true, force: true });
  await mkdir(runtimeDir, { recursive: true });
}
await rm(profileDir, { recursive: true, force: true });
if (!runOptions.only) {
  await rm(imageDir, { recursive: true, force: true });
  await rm(indexPath, { force: true });
}
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
execFileSync('swiftc', ['-O', frontmostSource, '-o', frontmostBinary], { stdio: 'inherit' });

execFileSync('git', ['init', '--quiet', '--initial-branch=main'], { cwd: workspaceDir });
execFileSync('git', ['config', 'user.name', 'Screenshot Fixture'], { cwd: workspaceDir });
execFileSync('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: workspaceDir });
execFileSync('git', ['add', '.'], { cwd: workspaceDir });
execFileSync('git', ['commit', '--quiet', '-m', 'Create synthetic screenshot fixture'], { cwd: workspaceDir });
await appendFile(path.join(workspaceDir, 'src', 'changed.ts'), '\n// local edit\n');
await appendFile(path.join(workspaceDir, 'src', 'autosave.ts'), '\nconst trim = "base";   \n');

const fetcher = path.join(here, 'fetch-sources.mjs');
execFileSync(process.execPath, [fetcher, sourceDir], { stdio: 'inherit' });
const settingsByChapter = Object.fromEntries(chapters.map((chapter) => [chapter.chapter,
  JSON.parse(readFileSync(path.join(sourceDir, `ch${String(chapter.chapter).padStart(2, '0')}`, 'settings.json'), 'utf8'))]));
const recommendationsByChapter = Object.fromEntries(chapters.map((chapter) => [chapter.chapter,
  JSON.parse(readFileSync(path.join(sourceDir, `ch${String(chapter.chapter).padStart(2, '0')}`, 'extensions.json'), 'utf8')).recommendations]));
const settingsPlan = planner.buildChronologicalPlan(chapters, settingsByChapter, groupSpecs, pairRegistry);
const fullPlan = planner.addPairRequirements(settingsPlan, chapters, recommendationsByChapter, extensionPins);
const selectedPlan = planner.selectPlan(fullPlan, runOptions.only);
const requiredExtensions = planner.requiredExtensionsThrough(chapters, selectedPlan, recommendationsByChapter, extensionPins);
if (pairRegistry.length !== 33 || 1 + chapters.length + pairRegistry.length * 2 !== 78) {
  throw new Error(`Full capture contract changed: ${pairRegistry.length} pairs`);
}
if (runOptions.only) {
  const pairs = selectedPlan.map((pair) => ({ canonical: pair.canonical, before: pair.before, after: pair.after, requiredExtensions: pair.requiredExtensions }));
  const manifest = { runId, pairs };
  await writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

const userSettingsPath = path.join(profileDir, 'User', 'settings.json');
await mkdir(path.dirname(userSettingsPath), { recursive: true });
let appliedSettings = {};
let windowControl;
let appChild;
let targetHeight;
let activeFile;
let plannedSettings = {};
let autosaveSentinel;
let indentationSource;
let placeholderWitness;
const saveWitness = [];
const installedExtensions = new Set();
const indexRows = [];
const imageNames = new Set();
const failedPairs = [];

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...options }).trim();
}

function frontmostApplication() {
  const [pidText, bundleId, name] = run(frontmostBinary, []).split('\t');
  const pid = Number(pidText);
  if (!Number.isInteger(pid) || pid < 1 || !bundleId || !name) throw new Error('Could not identify the macOS frontmost application.');
  return { pid, bundleId, name };
}

function assertOwnerAway(stage) {
  const started = process.hrtime.bigint();
  const output = execFileSync('ioreg', ['-c', 'IOHIDSystem'], { encoding: 'utf8' });
  const finished = process.hrtime.bigint();
  const match = output.match(/"HIDIdleTime"\s*=\s*(\d+)/);
  if (!match) throw new Error('Could not read HIDIdleTime from ioreg -c IOHIDSystem.');
  const sample = { idle: BigInt(match[1]), started, finished };
  if (ownerIdleSample && sample.idle < ownerIdleSample.idle + started - ownerIdleSample.finished) {
    const time = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Tokyo', hourCycle: 'h23' });
    const error = new Error(`OWNER_RETURNED at ${time} JST before ${stage}.`);
    error.code = 'OWNER_RETURNED';
    throw error;
  }
  ownerIdleSample = sample;
}

function logFrontmost(stage) {
  const current = frontmostApplication();
  console.log(`Frontmost ${stage}: ${current.name} (PID ${current.pid}).`);
  return current;
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
  const nextSettings = planner.deepMerge(structuredClone(appliedSettings), settings);
  if (installedExtensions.has(customUIStyleId)) {
    nextSettings['custom-ui-style.watch'] = false;
    nextSettings['custom-ui-style.reloadWithoutPrompting'] = false;
  }
  await writeFile(userSettingsPath, `${JSON.stringify(nextSettings, null, 2)}\n`, { mode: 0o600 });
  await delay(600);
}

async function assertThemeReady() {
  if (!/Aura Dracula Spirit/i.test(appliedSettings['workbench.colorTheme'] || '')) return;
  const overrides = appliedSettings['workbench.colorCustomizations'] || {};
  const value = overrides['[Aura Dracula Spirit (Soft)]']?.['sideBar.background'] || '#14111B';
  const expected = value.replace(/^#(..)(..)(..)$/, (_, r, g, b) => `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)})`);
  const actual = await windowControl.waitFor("getComputedStyle(document.querySelector('.sidebar')).backgroundColor", (color) => color === expected);
  if (actual !== expected) throw new Error(`Aura theme did not become ready: expected sidebar ${expected}, found ${actual}`);
}

function sourceFile(chapterNumber, filename) {
  return path.join(sourceDir, `ch${String(chapterNumber).padStart(2, '0')}`, filename);
}

function readChapterSettings(chapter) {
  return settingsByChapter[chapter.chapter];
}

async function installRecommendations(chapter) {
  const recommendationFile = JSON.parse(await readFile(sourceFile(chapter.chapter, 'extensions.json'), 'utf8'));
  const packages = [];
  for (const extension of recommendationFile.recommendations) {
    const id = extension.toLowerCase();
    const version = extensionPins.get(id);
    if (!version) throw new Error(`No pinned Marketplace version is configured for recommendation ${extension}`);
    if (installedExtensions.has(id)) continue;
    console.log(`Installing ${id}@${version} from Marketplace for chapter ${chapter.chapter}.`);
    packages.push([id, await installMarketplaceExtension(id, version, marketplaceCacheDir)]);
    installedExtensions.add(id);
  }
  if (packages.length) {
    await quitApp();
    for (const [id, vsix] of packages) {
      const args = ['--user-data-dir', profileDir, '--extensions-dir', extensionsDir, '--install-extension', vsix, '--force'];
      execFileSync(cliPath, args, { stdio: 'inherit', env: { ...process.env, VSCODE_IPC_HOOK_CLI: '' } });
      if (appCopyRunning()) throw new Error('Extension CLI unexpectedly left a VS Code process using the kit profile running.');
      const installed = JSON.parse(await readFile(path.join(extensionsDir, `${id}-${extensionPins.get(id)}`, 'package.json'), 'utf8'));
      const identity = `${installed.publisher}.${installed.name}`.toLowerCase();
      if (identity !== id || installed.version !== extensionPins.get(id)) throw new Error(`Isolated extension install identity mismatch for ${id}.`);
    }
  }
  if (installedExtensions.has(customUIStyleId)) await writeSettings(appliedSettings);
}

async function installRequiredExtensions() {
  const packages = [];
  for (const { id, version } of requiredExtensions) {
    packages.push([id, await installMarketplaceExtension(id, version, marketplaceCacheDir)]);
  }
  for (const [id, vsix] of packages) {
    const args = ['--user-data-dir', profileDir, '--extensions-dir', extensionsDir, '--install-extension', vsix, '--force'];
    execFileSync(cliPath, args, { stdio: 'inherit', env: { ...process.env, VSCODE_IPC_HOOK_CLI: '' } });
    const installed = JSON.parse(await readFile(path.join(extensionsDir, `${id}-${extensionPins.get(id)}`, 'package.json'), 'utf8'));
    if (`${installed.publisher}.${installed.name}`.toLowerCase() !== id || installed.version !== extensionPins.get(id)) {
      throw new Error(`Isolated extension install identity mismatch for ${id}.`);
    }
    installedExtensions.add(id);
  }
}

function launchArgs() {
  return [
    '--user-data-dir', profileDir,
    '--extensions-dir', extensionsDir,
    '--disable-workspace-trust',
    '--disable-telemetry',
    '--disable-updates',
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
  for (const file of fixedFiles) await open(file);
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

function appCopyRunning() {
  return execFileSync('/bin/ps', ['-axo', 'command='], { encoding: 'utf8' }).split('\n').some((line) => line.includes(appExecutable) && line.includes(`--user-data-dir ${profileDir}`));
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
  assertOwnerAway('VS Code launch');
  logFrontmost('before VS Code launch');
  await rm(activePortFile, { force: true });
  const child = spawn(appExecutable, launchArgs(), { detached: true, stdio: 'ignore' });
  child.unref();
  appChild = child;
  devtoolsPort = await waitForDevToolsPort(child);
  windowControl = new VSCodeControl(devtoolsPort, appPath);
  await windowControl.connect();
  await openFixedFiles();
  await assertThemeReady();
  if (installedExtensions.has(customUIStyleId)) {
    await windowControl.clickNotificationAction('first time use', 'No', 250);
  }
  if (clearNotifications) await windowControl.clearNotifications();
  await delay(800); const height = await windowControl.evaluate('innerHeight');
  targetHeight ??= height;
  if (height !== targetHeight) {
    const { windowId: id, bounds: b } = await windowControl.send('Browser.getWindowForTarget');
    await windowControl.send('Browser.setWindowBounds',{windowId:id,bounds:{...b,height:b.height+targetHeight-height}});
    await windowControl.waitFor(`innerHeight===${targetHeight}`);
  }
  logFrontmost('after VS Code became ready');
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

let signalCleanupStarted = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (signalCleanupStarted) return;
    signalCleanupStarted = true;
    void (async () => {
      try {
        await quitApp();
        await rm(profileDir, { recursive: true, force: true });
      } catch (error) {
        console.error(`Could not clean up after ${signal}:`, error);
      }
      process.exit(128 + os.constants.signals[signal]);
    })();
  });
}

async function restartApp({ clearNotifications = true } = {}) {
  assertOwnerAway('VS Code restart');
  await quitApp();
  await startApp({ clearNotifications });
}

async function applyCustomUIStyleAndRestart() {
  assertOwnerAway('Custom UI Style restart');
  await windowControl.command('Custom UI Style: Reload');
  const canceledExtensionRestart = await windowControl.clickNotificationAction('UI Style changed.', 'Cancel');
  if (!canceledExtensionRestart) {
    throw new Error('Custom UI Style did not offer its documented reload notification with a Cancel action.');
  }
  await quitApp();
  await startApp();
}

async function open(file, line, column = 1) {
  const absolutePath = path.join(workspaceDir, file);
  const sourceLines = (await readFile(absolutePath, 'utf8')).split(/\r?\n/);
  const expectedLine = sourceLines[(line || 1) - 1]?.replaceAll('\t', '    ').replace(/\s+/g, ' ').trim();
  if (expectedLine === undefined) throw new Error(`Requested line ${line} is outside ${file}.`);
  const args = ['--user-data-dir', profileDir, '--extensions-dir', extensionsDir];
  args.push('--goto', `${absolutePath}:${line || 1}:${column}`);
  execFileSync(cliPath, args, { stdio: 'ignore', env: { ...process.env, VSCODE_IPC_HOOK_CLI: '' } });
  const processCommand = execFileSync('/bin/ps', ['-ww', '-p', String(appChild.pid), '-o', 'command='], { encoding: 'utf8' });
  if (!processCommand.includes(path.join(appPath, 'Contents', 'MacOS', 'Electron')) || !processCommand.includes(`--user-data-dir ${profileDir}`)) throw new Error('The VS Code CLI did not preserve the isolated kit process identity.');
  const title = path.basename(file);
  const state = await windowControl.waitFor(`(() => { const title=document.querySelector('.editor-group-container>.title .title-label')?.textContent||document.title, editor=document.querySelector('.monaco-editor.focused')||document.activeElement.closest?.('.monaco-editor'), lines=[...document.querySelectorAll('.monaco-editor .view-line')], norm=s=>(s||'').replace(/\\u00a0/g,' ').replace(/\\s+/g,' ').trim(), row=lines.find(n=>norm(n.innerText)===${JSON.stringify(expectedLine)}), cursor=document.querySelector('.monaco-editor .cursors-layer .cursor'), r=cursor?.getBoundingClientRect(), rr=row?.getBoundingClientRect(), x=r&&r.x+r.width/2; return {title,focused:!!editor,row:!!row,cursor:!!r&&r.width>0&&r.height>0,cursorY:!!r&&!!rr&&Math.abs((r.y+r.height/2)-(rr.y+rr.height/2))<10,cursorX:!!rr&&x>=rr.left-2&&x<=rr.right+12}; })()`, (value) => value.title.includes(title) && value.focused && value.row && value.cursor && value.cursorY && value.cursorX);
  if (!state.row || !state.cursor || !state.cursorY || !state.cursorX) throw new Error(`Editor open barrier failed for ${file}:${line}:${column}: ${JSON.stringify(state)}`);
  activeFile = file;
}

async function goto(line, column = 1) {
  if (!activeFile) throw new Error('Cannot position the editor before opening a fixture file.');
  await open(activeFile, line, column);
}

function fixtureLine(relativePath, text, exactTrimmed = false) {
  const contents = readFileSync(path.join(workspaceDir, relativePath), 'utf8').split(/\r?\n/);
  const index = contents.findIndex((line) => exactTrimmed ? line.trim() === text : line.includes(text));
  if (index < 0) throw new Error(`Fixture text not found in ${relativePath}: ${text}`);
  return { line: index + 1, column: contents[index].indexOf(text) + 1, text: contents[index] };
}

async function resetEditorBuffer(relativePath) {
  const pristine = await readFile(path.join(fixtureDir, relativePath)), target = path.join(workspaceDir, relativePath);
  await writeFile(target, pristine); await open(relativePath); await windowControl.command('File: Revert File');
  const dialog = await windowControl.evaluate("document.querySelector('.monaco-dialog-box')?.innerText||''");
  if (dialog) { if (!/revert/i.test(dialog)) throw new Error(`Unexpected fixture reset dialog: ${dialog}`); await windowControl.key('Enter', 'Enter'); }
  if (!(await readFile(target)).equals(pristine) || !Buffer.from(await copyEditorBuffer()).equals(pristine)) throw new Error(`Could not restore pristine fixture bytes in the editor and workspace for ${relativePath}`);
}

async function copyEditorBuffer() {
  await windowControl.key('A', 'KeyA', 4); await windowControl.key('C', 'KeyC', 4); await delay(100);
  return execFileSync('pbpaste', [], { encoding: 'utf8' }).replaceAll('\r\n', '\n');
}
function selectedText(){return windowControl.evaluate("document.querySelector('.focused .selected-text').textContent")}

async function replaceToken(relativePath, token, replacement) {
  const target = fixtureLine(relativePath, token, true);
  await goto(target.line, target.column + token.length);
  for (let index = 0; index < token.length; index += 1) await windowControl.key('Backspace', 'Backspace');
  await windowControl.type(replacement);
  await windowControl.key('Escape', 'Escape');
}

const evidenceTargets = {
  theme: '.monaco-workbench', 'minimal-chrome': '.monaco-workbench', 'editor-aids': '.monaco-workbench',
  'sidebar-placement': '.monaco-workbench', 'explorer-icons': '.explorer-folders-view', 'tree-layout': '.explorer-folders-view',
  'operation-confirmations': '.monaco-workbench', 'window-chrome': '.monaco-workbench', 'cursor-appearance': '.monaco-editor',
  'font-metrics': '.monaco-editor .view-lines', overlays: '.quick-input-widget', 'save-and-diff': '.monaco-editor',
  'automatic-suggestions': '.monaco-workbench', 'recommendation-notifications': '.monaco-workbench',
  'explorer-decorations': '.explorer-folders-view', 'title-spacing': '.editor-group-container>.title .title-label',
  'surface-boundaries': '.monaco-workbench', 'multi-cursor': '.monaco-editor', 'cursor-colors': '.monaco-editor',
  'code-style': '.monaco-editor .view-lines', 'code-decorations': '.monaco-editor', 'editor-hints': '.monaco-editor',
  'line-numbers-and-indent': '.monaco-editor', 'folding-and-guides': '.monaco-editor', 'scrollbars-and-ruler': '.monaco-editor',
  'marker-colors': '.monaco-editor', 'tab-completion': '.suggest-widget',
  'selected-suggestion-color': '.suggest-widget', 'sidebar-and-title': '.monaco-workbench', 'find-widget': '.editor-widget.find-widget',
  autosave: '.editor-group-container>.title',
};

async function measureGroup(key, imageName, override) {
  const selector = override || evidenceTargets[key] || '.monaco-workbench';
  assertOwnerAway(`evidence ${imageName}`);
  await windowControl.waitForPaint();
  const observed = await windowControl.evaluate(`(() => {
    const visible = (node) => {
      if (!node) return false;
      for (let n = node; n instanceof Element; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
      }
      const v = { width: innerWidth, height: innerHeight };
      const rects = [node, ...node.querySelectorAll('*')].map((item) => item.getBoundingClientRect());
      return rects.some((r) => r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < v.width && r.top < v.height);
    };
    const rect = (n) => { const r=n.getBoundingClientRect(); return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
    const activeEditor=document.querySelector('.monaco-editor.focused');
    const targets=[...document.querySelectorAll(${JSON.stringify(selector)})];
    const scoped=${key === 'tab-completion' || key === 'selected-suggestion-color'};
    const e=targets.find(n=>visible(n)&&(!scoped||activeEditor&&(activeEditor.contains(n)||n.closest('.monaco-editor')===activeEditor)));
    if(!e) return null;
    const box=rect(e), viewport={width:innerWidth,height:innerHeight}, sidebar=document.querySelector('.sidebar');
    const ancestors=[]; for(let n=e;n instanceof Element;n=n.parentElement) ancestors.push(getComputedStyle(n));
    const visibility={display:ancestors.some(s=>s.display==='none')?'none':'block',visibility:ancestors.some(s=>s.visibility==='hidden')?'hidden':'visible',opacity:ancestors.reduce((value,s)=>value*Number(s.opacity||1),1),rects:[e,...e.querySelectorAll('*')].map(rect),viewport};
    const widgets=[...document.querySelectorAll('.suggest-widget')];
    const activeWidgets=widgets.filter(n=>activeEditor&&(activeEditor.contains(n)||n.closest('.monaco-editor')===activeEditor));
    const activeWidget=activeWidgets.find(visible);
    const rows=[...(activeWidget?.querySelectorAll('.monaco-list-row')||[])];
    const identify=(n)=>n.querySelector('.label-name,.monaco-highlighted-label')?.textContent.trim()||n.innerText.trim().split('\\n')[0];
    const rowData=(n)=>{
      const r=n.getBoundingClientRect();
      return {label:identify(n),detail:n.innerText.trim(),snippet:!!n.querySelector('.codicon-symbol-snippet'),visible:visible(n),
        inViewport:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight};
    };
    const selected=rows.find(n=>n.matches('.focused,.selected,[aria-selected="true"]'));
    const comment=[...document.querySelectorAll('.monaco-editor .view-line')].find(n=>n.innerText.includes('Sample comment'));
    const row=[...document.querySelectorAll('.explorer-folders-view .monaco-list-row')].find(n=>n.innerText.includes('changed.ts'));
    const tree=[...document.querySelectorAll('.explorer-folders-view .monaco-list-row')].filter(visible).map(n=>{
      const icon=n.querySelector('.monaco-icon-label,.file-icon,.folder-icon'), i=icon&&getComputedStyle(icon,'::before');
      const guides=[...n.querySelectorAll('.monaco-tl-indent .indent-guide')].map(g=>[getComputedStyle(g).borderLeftColor,getComputedStyle(g).backgroundColor]);
      return [n.innerText.trim(),n.className,icon?.className,i?.backgroundImage,i?.content,guides];
    });
    const cursors=[...document.querySelectorAll('.monaco-editor.focused .cursors-layer .cursor')].filter(visible), cursorStyle=cursors.map(n=>{
      const s=getComputedStyle(n), r=rect(n);
      const glyph=[...document.querySelectorAll('.monaco-editor.focused .view-line span')].find(g=>{
        const b=g.getBoundingClientRect(); return b.width>0&&b.height>0&&b.right>r.left&&b.left<r.right&&b.bottom>r.top&&b.top<r.bottom;
      });
      return {
        color:s.color,background:s.backgroundColor,backgroundImage:s.backgroundImage,text:glyph?.textContent||'',rect:r,
        glyphColor:glyph&&getComputedStyle(glyph).color,
      };
    });
    const chrome=['.part.activitybar','.part.statusbar','.tabs-container','.breadcrumbs-control','.minimap'].map(q=>[q,[...document.querySelectorAll(q)].some(visible)]);
    const lines=[...document.querySelectorAll('.monaco-editor .view-line')], ink=(n)=>{
      if(!n)return null; const walker=document.createTreeWalker(n,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()){const index=walker.currentNode.textContent.search(/\\S/);if(index>=0){const range=document.createRange();range.setStart(walker.currentNode,index);range.setEnd(walker.currentNode,index+1);const r=range.getBoundingClientRect();return {x:r.x,width:r.width};}}
      return null;
    };
    const line=(text)=>lines.find(n=>n.innerText.replace(/\u00a0/g,' ').includes(text));
    const base=ink(line('export function')), one=ink(line('const heading'));
    const nested=ink(lines.find(n=>n.innerText.includes('return')&&n.innerText.includes('heading')));
    const commentSpan=comment?.querySelector('span')||comment;
    const editor=activeEditor||document.querySelector('.monaco-editor'), scroll=editor?.querySelector('.monaco-scrollable-element');
    const title=document.querySelector('.editor-group-container>.title'), fileTitle=document.querySelector('.title .monaco-icon-label.file-icon');
    const titleText=document.querySelector('.editor-group-container>.title .title-label .label-name');
    const titleTextRange=titleText?(()=>{const range=document.createRange();range.selectNodeContents(titleText);return {width:range.getBoundingClientRect().width};})():null;
    const titleContainer=fileTitle?.closest('.label-container');
    const titleState=fileTitle?{bar:visible(title)?rect(title):null,containerWidth:titleContainer?.clientWidth||0,
      marginLeft:getComputedStyle(fileTitle).marginLeft,marginRight:getComputedStyle(fileTitle).marginRight,
      text:titleText?.textContent.trim(),textRect:titleTextRange}:null;
    const sidebarBox=visible(sidebar)?rect(sidebar):null;
    const sidebarPatch=sidebarBox?{left:sidebarBox.left+8,right:sidebarBox.left+32,top:sidebarBox.bottom-40,bottom:sidebarBox.bottom-16}:null;
    const findWidget=document.querySelector('.editor-widget.find-widget');
    const findInput=findWidget?.querySelector('input');
    const findState=findWidget?{
      rect:rect(findWidget),query:findInput?.value??null,shadow:getComputedStyle(findWidget).boxShadow,
      toggles:[...findWidget.querySelectorAll('button,[role="button"]')].map(n=>[
        n.getAttribute('aria-pressed'),n.getAttribute('aria-checked'),n.getAttribute('aria-label'),n.getAttribute('title')])
    }:null;
    const dirty=[...document.querySelectorAll('.editor-group-container>.title .codicon-close-dirty')].filter(visible);
    const folding=[...document.querySelectorAll('.monaco-editor .codicon-folding-expanded,.monaco-editor .codicon-folding-collapsed')].filter(visible);
    const swatches=[...document.querySelectorAll('.monaco-editor .colorpicker-color-decoration')].filter(visible);
    const lights=[...document.querySelectorAll('.monaco-editor .lightbulb-glyph,.monaco-editor .lightBulbWidget,.monaco-editor .codicon-lightbulb,.monaco-editor .codicon-lightbulb-autofix')].filter(visible);
    const signatures=[...document.querySelectorAll('.parameter-hints-widget')].filter(visible);
    const sliders=[...document.querySelectorAll('.monaco-editor .scrollbar .slider')].filter(visible);
    const toast=[...document.querySelectorAll('.notifications-toasts .notification-toast')].filter(visible).map(n=>n.innerText);
    const dialogs=[...document.querySelectorAll('.monaco-dialog-box,.monaco-dialog-modal-block,[aria-modal="true"]')].filter(visible).map(n=>n.innerText);
    const editorStyle=getComputedStyle(editor), style=getComputedStyle(e), commentStyle=commentSpan?['fontStyle','fontFeatureSettings','color'].map(k=>getComputedStyle(commentSpan)[k]):[];
    const guides=[...document.querySelectorAll('.monaco-editor .indent-guide')].filter(visible).length;
    const whitespace=[...document.querySelectorAll('.monaco-editor .view-line .whitespace')].filter(visible).length;
    return {
      box,
      viewport,
      visibility,
      metric: {
        lineNumbers: [...document.querySelectorAll('.monaco-editor .line-numbers')].slice(0, 4).map((node) => node.innerText.trim()),
        editorBg: editorStyle.backgroundColor,
        editorColor: editorStyle.color,
        devicePixelRatio,
        y: box.top,
        textX: e.firstChild ? (() => { const range = document.createRange(); range.selectNodeContents(e); return range.getBoundingClientRect().x; })() : box.left,
        width: box.width,
        padding: style.paddingLeft,
        shadow: style.boxShadow,
        font: getComputedStyle(lines[0]?.querySelector('span') || e).font,
        lineHeight: getComputedStyle(lines[0] || e).lineHeight,
        dirty: dirty.length,
        chrome,
        sidebarRect: sidebarBox,
        sidebarPatch,
        sidebar: getComputedStyle(sidebar || e).backgroundColor,
        tree,
        toast,
        dialogs,
        suggestVisible: !!activeWidget && visible(activeWidget),
        suggestWidgetCount: activeWidgets.filter(visible).length,
        selectedSuggestion: selected ? identify(selected) : null,
        selectedBg: selected && getComputedStyle(selected).backgroundColor,
        selectedRect: selected ? rect(selected) : null,
        rows: rows.map(rowData),
        cursorStyle,
        cursors: cursors.length,
        sliders: sliders.length,
        scroll: [scroll?.scrollTop, scroll?.scrollHeight, scroll?.clientHeight, scroll?.scrollLeft, scroll?.scrollWidth, scroll?.clientWidth],
        squiggles: document.querySelectorAll('.monaco-editor .squiggly-error').length,
        badges: document.querySelectorAll('.explorer-folders-view .monaco-list-row .badge,.explorer-folders-view .monaco-list-row .monaco-count-badge').length,
        gitColor: row ? getComputedStyle(row.querySelector('.label-name') || row).color : '',
        focus: getComputedStyle(document.querySelector('.explorer-folders-view .monaco-list-row.focused') || e).outlineColor,
        justify: getComputedStyle(title || e).justifyContent,
        decoration: getComputedStyle(document.querySelector('.monaco-editor .scroll-decoration') || e).display,
        sticky: [...document.querySelectorAll('.monaco-editor .sticky-widget')].filter(visible).length,
        swatches: swatches.length,
        lightbulb: lights.length,
        signature: signatures.length,
        folding: folding.length,
        guides,
        whitespace,
        comment: commentStyle,
        indent: [base, one, nested].slice(1).map((point) => base && point ? Math.round((point.x - base.x) / base.width) : null),
        title: titleState?.marginLeft || '0px',
        titleState,
        findState,
      },
    };
  })()`);
  if (!observed || !visibleGeometry(observed.visibility)) {
    throw new Error(`No painted DOM target for ${key}: ${selector}`);
  }
  const fullPath=path.join(outputDir,'evidence',`${imageName.replace(/\.png$/,'')}.full.png`);
  await mkdir(path.dirname(fullPath),{recursive:true});
  await writeFile(fullPath,await windowControl.captureFullScreenshot());
  await writeFile(`${fullPath}.json`,JSON.stringify({box:observed.box,viewport:observed.viewport,visibility:observed.visibility,metric:observed.metric},null,2));
  return {metric:observed.metric,box:observed.box,viewport:observed.viewport,fullPath};
}
async function completionState(expectedLine) {
  return windowControl.evaluate(`(() => {
    const visible=(node)=>{
      if(!node)return false;
      for(let item=node;item instanceof Element;item=item.parentElement){
        const style=getComputedStyle(item);
        if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;
      }
      const rects=[node,...node.querySelectorAll('*')].map(item=>item.getBoundingClientRect());
      return rects.some(r=>r.width>0&&r.height>0&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight);
    };
    const editor=document.querySelector('.monaco-editor.focused');
    const candidates=[...document.querySelectorAll('.suggest-widget')].filter(node=>editor&&(editor.contains(node)||node.closest('.monaco-editor')===editor));
    const widgets=candidates.filter(visible);
    const widget=widgets[0];
    const rows=[...(widget?.querySelectorAll('.monaco-list-row')||[])].map(node=>({
      label:node.querySelector('.label-name,.monaco-highlighted-label')?.textContent.trim()||node.innerText.trim().split('\\n')[0],
      detail:node.innerText.trim(),
      snippet:!!node.querySelector('.codicon-symbol-snippet'),
      visible:visible(node),
      inViewport:(()=>{const r=node.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})(),
    }));
    const active=document.activeElement;
    const selected=[...(widget?.querySelectorAll('.monaco-list-row')||[])].find(node=>node.matches('.focused,.selected,[aria-selected="true"]'));
    const label=(node)=>node?.querySelector('.label-name,.monaco-highlighted-label')?.textContent.trim()||node?.innerText.trim().split('\\n')[0]||null;
    const cursor=editor?.querySelector('.cursors-layer .cursor'), caretLine=[...editor.querySelectorAll('.view-line')].find(node=>node.innerText.trim()===${JSON.stringify(expectedLine)});
    const caretRange=caretLine&&document.createRange(); if(caretRange) caretRange.selectNodeContents(caretLine);
    const caretRect=caretRange?.getBoundingClientRect(), cursorRect=cursor?.getBoundingClientRect();
    const caret=caretRect&&cursorRect?{line:caretLine.innerText.trim(),atEnd:Math.abs(cursorRect.x+cursorRect.width/2-caretRect.right)<16}:null;
    return {
      widgetCount:widgets.length,
      visible:visible(widget),
      editorIdentity:editor?.closest('.editor-group-container')?.querySelector('.title-label .label-name')?.textContent.trim()||null,
      editorFocused:!!editor&&editor.contains(active),
      activeElement:active?.className||active?.tagName||null,
      caret,
      rows,
      selected:label(selected),
      loading:rows.some(row=>/loading|no suggestions/i.test(row.detail)),
    };
  })()`);
}
async function saveCompletionDiagnostics(filename) {
  const diagnostics = await windowControl.evaluate(`(() => {
    const visible=(node)=>{
      if(!node)return false;
      for(let item=node;item instanceof Element;item=item.parentElement){
        const style=getComputedStyle(item);
        if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;
      }
      const rects=[node,...node.querySelectorAll('*')].map(item=>item.getBoundingClientRect());
      return rects.some(r=>r.width>0&&r.height>0&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight);
    };
    const editor=document.querySelector('.monaco-editor.focused'), active=document.activeElement;
    return [...document.querySelectorAll('.suggest-widget')].map(widget=>({
      visible:visible(widget),
      editorIdentity:widget.closest('.editor-group-container')?.querySelector('.title-label')?.textContent.trim()||null,
      activeEditor:!!editor&&(editor.contains(widget)||widget.closest('.monaco-editor')===editor),
      caret:(()=>{const r=editor?.querySelector('.cursors-layer .cursor')?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;})(),
      activeElement:active?.className||active?.tagName||null,
      rows:[...widget.querySelectorAll('.monaco-list-row')].filter(visible).map(row=>({
        label:row.querySelector('.label-name,.monaco-highlighted-label')?.textContent.trim()||row.innerText.trim(),
        detail:row.innerText.trim(),snippet:!!row.querySelector('.codicon-symbol-snippet'),
      })),
    }));
  })()`);
  const directory = path.join(outputDir, 'evidence');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${filename}.completion-diagnostic.json`), JSON.stringify({ activeFile, diagnostics }, null, 2));
}
async function waitForCompletion(labels, filename, expectedLine) {
  const deadline = Date.now() + 25_000;
  let retryAt = Date.now() + 1000, last, previous, stable = 0;
  while (Date.now() < deadline) {
    last = await completionState(expectedLine);
    const ready = last.widgetCount === 1 && last.visible && last.editorFocused && !last.loading
      && last.editorIdentity === path.basename(activeFile) && last.caret?.line === expectedLine && last.caret.atEnd
      && last.rows.every((row) => row.visible && row.inViewport)
      && labels.every((label) => last.rows.some((row) => row.label === label));
    if (ready) {
      await windowControl.waitForPaint();
      const painted = await completionState(expectedLine);
      const identity = JSON.stringify(painted.rows.map(({ label, detail, snippet }) => [label, detail, snippet]));
      if (painted.widgetCount === 1 && painted.visible && painted.editorFocused && !painted.loading
        && painted.editorIdentity === path.basename(activeFile) && painted.caret?.line === expectedLine && painted.caret.atEnd
        && painted.rows.every((row) => row.visible && row.inViewport) && labels.every((label) => painted.rows.some((row) => row.label === label))
        && identity === previous) stable += 1;
      else stable = 0;
      previous = identity;
      if (stable >= 1) return painted;
    } else {
      previous = undefined;
      stable = 0;
    }
    if(labels[0]==='sampleNames'&&Date.now()>=retryAt&&!last.rows.some(r=>r.label==='sampleNames')){
      await windowControl.key('Escape','Escape');await windowControl.key(' ','Space',2);retryAt=Date.now()+1000;
    }
    await delay(100);
  }
  await saveCompletionDiagnostics(filename);
  throw new Error(`Active-editor completion did not stabilize with ${labels.join(', ')}: ${JSON.stringify(last)}`);
}
async function assertNoActiveCompletion(filename) {
  const state = await completionState();
  if (!state.widgetCount) return;
  await saveCompletionDiagnostics(filename);
  throw new Error(`An active completion remained open before the explicit gesture: ${JSON.stringify(state)}`);
}
function pixelDimensions(file) {
  const png=readFileSync(file);
  if (!png.subarray(1,4).equals(Buffer.from('PNG'))) throw new Error(`Evidence is not a PNG: ${file}`);
  return {width:png.readUInt32BE(16),height:png.readUInt32BE(20)};
}
async function compareRegion(before, after, region, label) {
  if (before.viewport.width !== after.viewport.width || before.viewport.height !== after.viewport.height) {
    throw new Error(`${label} viewport changed between pair sides`);
  }
  const dimensions = [pixelDimensions(before.fullPath), pixelDimensions(after.fullPath)];
  const paths = [before, after].map((state) => path.join(path.dirname(state.fullPath), `${path.basename(state.fullPath, '.full.png')}.${label}.png`));
  for (let index = 0; index < 2; index += 1) {
    const image = dimensions[index];
    const x = Math.round(region.left / before.viewport.width * image.width);
    const y = Math.round(region.top / before.viewport.height * image.height);
    const width = Math.max(1, Math.min(image.width - x, Math.round((region.right - region.left) / before.viewport.width * image.width)));
    const height = Math.max(1, Math.min(image.height - y, Math.round((region.bottom - region.top) / before.viewport.height * image.height)));
    execFileSync('magick', [
      [before, after][index].fullPath,
      '-crop', `${width}x${height}+${x}+${y}`,
      '+repage',
      paths[index],
    ], { stdio: 'ignore' });
  }
  const result = spawnSync('magick', ['compare', '-metric', 'AE', paths[0], paths[1], 'null:'], { encoding: 'utf8' });
  if (result.status !== 0 && result.status !== 1) throw new Error(`ImageMagick ${label} comparison failed: ${result.stderr || result.error}`);
  return { changed: Number((result.stderr || result.stdout).trim().split(/\s+/)[0]) > 0, paths };
}
async function compareEvidence(group, before, after) {
  const boxes=[before,after].map((state)=>({
    left:state.box.left/state.viewport.width,top:state.box.top/state.viewport.height,
    right:state.box.right/state.viewport.width,bottom:state.box.bottom/state.viewport.height,
  }));
  const padding=group==='find-widget'?24:2;
  const rect={left:Math.max(0,Math.min(...boxes.map(b=>b.left))-padding/before.viewport.width),
    top:Math.max(0,Math.min(...boxes.map(b=>b.top))-padding/before.viewport.height),
    right:Math.min(1,Math.max(...boxes.map(b=>b.right))+padding/before.viewport.width),
    bottom:Math.min(1,Math.max(...boxes.map(b=>b.bottom))+padding/before.viewport.height)};
  const sizes=[pixelDimensions(before.fullPath),pixelDimensions(after.fullPath)];
  const width=Math.max(1,...sizes.map(s=>Math.round((rect.right-rect.left)*s.width)));
  const height=Math.max(1,...sizes.map(s=>Math.round((rect.bottom-rect.top)*s.height)));
  const paths=[before,after].map(state=>path.join(path.dirname(state.fullPath),`${path.basename(state.fullPath,'.full.png')}.crop.png`));
  for(let i=0;i<2;i++){
    const {width:iw,height:ih}=sizes[i],x=Math.round(rect.left*iw),y=Math.round(rect.top*ih);
    const w=Math.max(1,Math.min(iw-x,Math.round((rect.right-rect.left)*iw))),h=Math.max(1,Math.min(ih-y,Math.round((rect.bottom-rect.top)*ih)));
    execFileSync('magick',[ [before,after][i].fullPath,'-crop',`${w}x${h}+${x}+${y}`,'+repage','-resize',`${width}x${height}!`,paths[i]],{stdio:'ignore'});
  }
  const result=spawnSync('magick',['compare','-metric','AE',paths[0],paths[1],'null:'],{encoding:'utf8'});
  if(result.status!==0&&result.status!==1) throw new Error(`ImageMagick pixel comparison failed: ${result.stderr||result.error}`);
  const changed=Number((result.stderr||result.stdout).trim().split(/\s+/)[0])>0;
  return {changed,paths};
}
async function setPairDescription(group, before, after, rows) {
  const {metric:a}=before,{metric:b}=after,{changed}=await compareEvidence(group,before,after);
  if(!changed) throw new Error(`${group} target crop contains no changed pixels.`);
  const same=(x,y)=>JSON.stringify(x)===JSON.stringify(y), fail=(message)=>{throw new Error(message);};
  if(group==='theme'&&a.editorBg===b.editorBg&&a.editorColor===b.editorColor) fail('Editor palette did not change.');
  if(group==='minimal-chrome'&&same(a.chrome,b.chrome)) fail('Workbench chrome visibility did not change.');
  if(group==='editor-aids'&&same(a.chrome.filter(([s])=>s.includes('breadcrumbs')||s.includes('minimap')),b.chrome.filter(([s])=>s.includes('breadcrumbs')||s.includes('minimap')))) fail('Breadcrumb or minimap visibility did not change.');
  if(group==='sidebar-placement'&&a.sidebarRect?.left===b.sidebarRect?.left) fail('Explorer sidebar did not change sides.');
  if(group==='explorer-icons'&&same(a.tree,b.tree)) fail('Explorer icons or disclosure arrows did not change.');
  if(group==='tree-layout'&&(same(a.tree,b.tree)||!a.guides||b.guides)) fail('Visible Explorer indent guides did not disappear.');
  if(group==='operation-confirmations'&&(!a.dialogs.some(t=>/move/i.test(t))||b.dialogs.length||same(a.tree,b.tree))) fail('Move dialog or resulting Explorer tree did not change.');
  if(group==='explorer-decorations'&&a.gitColor===b.gitColor&&a.badges===b.badges) fail('Git color or Explorer badge did not change.');
  if(group==='window-chrome'&&a.devicePixelRatio===b.devicePixelRatio&&a.w===b.w) fail('The workbench zoom geometry did not change.');
  if(group==='title-spacing'&&(a.pad!=='20px'||b.pad!=='60px'||b.textX<=a.textX)) fail(`Title spacing did not move the title ink: ${JSON.stringify([a.pad,b.pad,a.textX,b.textX])}`);
  if(group==='overlays'&&a.y===b.y&&a.shadow===b.shadow) fail('Command Palette position and shadow did not change.');
  if(group==='surface-boundaries'&&a.focus===b.focus&&a.justify===b.justify&&a.decoration===b.decoration) fail('Focused outline, title alignment, and editor surface boundary did not change.');
  if(group==='cursor-appearance'&&same(a.cursorStyle,b.cursorStyle)) fail('Editor cursor shape or color did not change.');
  if(group==='multi-cursor'&&(a.cursors!==3||b.cursors!==1)) fail(`Option-click cursors were ${a.cursors} before and ${b.cursors} after; expected 3 then 1.`);
  if(group==='cursor-colors'){
    const beforeCursor=a.cursorStyle[0],afterCursor=b.cursorStyle[0];
    if(!beforeCursor||!afterCursor||!beforeCursor.text.includes('M')||!afterCursor.text.includes('M')
      ||beforeCursor.color!=='rgb(93, 136, 0)'||afterCursor.color!=='rgb(0, 0, 0)'
      ||beforeCursor.backgroundImage!==afterCursor.backgroundImage
      ||JSON.stringify(beforeCursor.rect)!==JSON.stringify(afterCursor.rect)) {
      fail(`The same M glyph did not change to black under the unchanged block cursor: ${JSON.stringify([beforeCursor,afterCursor])}`);
    }
  }
  if(group==='font-metrics'&&a.font===b.font&&a.lineHeight===b.lineHeight) fail('Rendered font size and line spacing did not change.');
  if(group==='code-style'&&a.comment[0]===b.comment[0]) fail('The visible Sample comment did not change font style.');
  if(group==='code-decorations'&&(!a.sticky||b.sticky||!a.swatches||b.swatches)) fail(`Sticky header or color swatches did not change: ${a.sticky}/${a.swatches} -> ${b.sticky}/${b.swatches}.`);
  if(group==='editor-hints'&&(!a.signature||!a.lightbulb||b.signature||b.lightbulb)) fail('Signature help and code-action lightbulb did not change.');
  if(group==='save-and-diff'&&(!saveWitness[0]?.includes('   ')||saveWitness[1]?.includes('   ')||!saveWitness[1]?.endsWith('\n'))) fail('Saving did not trim trailing spaces and add the final newline.');
  if(group==='line-numbers-and-indent'&&(a.indent.join(',')!=='4,12'||b.indent.join(',')!=='2,6'||same(a.lineNumbers,b.lineNumbers))) fail(`Rendered indent or relative line numbers did not change: ${JSON.stringify([a.indent,a.lineNumbers,b.indent,b.lineNumbers])}.`);
  if(group==='folding-and-guides'&&(!a.folding||b.folding||!a.guides||b.guides||!a.whitespace||b.whitespace)) fail('Folding controls, guides, or whitespace markers did not disappear.');
  if(group==='scrollbars-and-ruler'&&(a.sliders<2||b.sliders||a.scroll[0]!==b.scroll[0]||a.scroll[3]!==b.scroll[3]||a.scroll[1]<=a.scroll[2]||a.scroll[4]<=a.scroll[5])) fail('Scrollbars did not disappear while both axes remained overflowed.');
  if(group==='marker-colors'&&(!a.squiggles||a.squiggles!==b.squiggles)) fail('The diagnostic squiggle was not preserved for marker-color comparison.');
  if(group==='automatic-suggestions'&&(!a.suggestVisible||b.suggestVisible)) fail('Automatic suggestion visibility did not change.');
  if(group==='tab-completion'){
    const required=['sampleNames','Sample loop','Sample card'];
    const rank=(metric)=>required.map((label)=>metric.rows.findIndex((row)=>row.label===label));
    const beforeRank=rank(a),afterRank=rank(b);
    const identities=(metric)=>metric.rows.map(({label,snippet})=>[label,snippet]);
    const snippets=['Sample loop','Sample card'].map((label)=>a.rows.find((row)=>row.label===label)?.snippet);
    if(a.suggestWidgetCount!==1||b.suggestWidgetCount!==1||!same(identities(a),identities(b))
      ||a.rows.find((row)=>row.label==='sampleNames')?.snippet||snippets.some((isSnippet)=>!isSnippet)
      ||beforeRank.some((index)=>index<0)||afterRank.some((index)=>index<0)
      ||!(beforeRank[0]<beforeRank[1]&&beforeRank[0]<beforeRank[2])
      ||!(afterRank[1]<afterRank[0]&&afterRank[2]<afterRank[0])) {
      fail(`The same ordinary completion and two snippets did not reorder: ${JSON.stringify([beforeRank,afterRank,a.rows,b.rows])}`);
    }
  }
  if(group==='selected-suggestion-color'&&(a.suggestWidgetCount!==1||b.suggestWidgetCount!==1||a.selectedSuggestion!=='active'||a.selectedSuggestion!==b.selectedSuggestion
    ||a.selectedBg!=='rgb(77, 77, 77)'||b.selectedBg!=='rgb(58, 51, 75)'||same(a.selectedRect,b.selectedRect)===false)) {
    fail(`The named active completion did not receive the selected-row color: ${JSON.stringify([a.selectedSuggestion,a.selectedBg,b.selectedSuggestion,b.selectedBg])}`);
  }
  if(group==='sidebar-and-title'){
    const beforeTitle=a.titleState,afterTitle=b.titleState;
    if(a.sidebar!=='rgb(20, 17, 27)'||b.sidebar!=='rgb(25, 21, 33)'
      ||beforeTitle?.marginLeft!=='0px'||beforeTitle?.marginRight!=='0px'
      ||afterTitle?.marginLeft!=='60px'||afterTitle?.marginRight!=='60px'
      ||beforeTitle?.text!==afterTitle?.text||beforeTitle?.text!==path.basename(activeFile)
      ||beforeTitle.textRect.width>beforeTitle.containerWidth
      ||afterTitle.textRect.width<=afterTitle.containerWidth-120) {
      fail(`The long title did not cross the available-width boundary after symmetric margins: ${JSON.stringify([beforeTitle,afterTitle])}`);
    }
  }
  if(group==='autosave'&&(a.dirty<1||b.dirty!==0||!autosaveSentinel)) fail(`Single-title dirty action did not clear: ${a.dirty} -> ${b.dirty}.`);
  if(group==='recommendation-notifications'&&(!a.toast.some(text=>/recommend/i.test(text))||b.toast.length)) fail('The Python recommendation toast did not disappear.');
  for(const row of rows) row.description=`${row.file.endsWith('before.png')?'Before':'After'} ${group}: ${groupSpecs[group].description}`;
}
async function runInteraction(name, phase, chapterSettings) {
  if (!name) return;
  switch (name) {
    case 'title-spacing':
      await open('src/main.ts');
      break;
    case 'sidebar-title':
      await open('src/completion-settings-preview-for-the-vscode-editor-workbench-ui.ts');
      break;
    case 'explorer-decorations':
      await open('src/changed.ts');
      await windowControl.command('File: Reveal Active File in Explorer');
      break;
    case 'cursor-focus':
      await open('src/main.ts');
      await goto(8, 12);
      break;
    case 'cursor-colors': {
      const target = fixtureLine('src/cursor-color.ts', 'MMMM');
      await open('src/cursor-color.ts', target.line, target.column);
      break;
    }
    case 'editor-top':
      await open('src/main.ts');
      await goto(1, 1);
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
      if (points.length !== 3) throw new Error(`Expected three fixture color matches, found ${points.length}.`);
      await windowControl.click(points[0].x, points[0].y);
      for (const point of points.slice(1)) await windowControl.click(point.x, point.y, 1);
      break;
    }
    case 'find-widget':
      await open('src/main.ts');
      await windowControl.command('Find with Arguments');
      await windowControl.waitFor("!!document.querySelector('.editor-widget.find-widget input')", Boolean, 10_000, 'Find widget input visible');
      await windowControl.type('vss-find-no-match-9zq');
      await windowControl.waitFor("document.querySelector('.editor-widget.find-widget input')?.value==='vss-find-no-match-9zq'", Boolean, 10_000, 'Find query entered');
      if (await readFile(path.join(workspaceDir, activeFile), 'utf8').then((text) => text.includes('vss-find-no-match-9zq'))) {
        throw new Error('The fixed Find query unexpectedly occurs in the fixture file.');
      }
      await windowControl.moveToText('Format a name.');
      await windowControl.waitForPaint();
      break;
    case 'command-palette':
      await open('src/main.ts');
      await windowControl.key('Escape', 'Escape');
      await windowControl.key('P', 'KeyP', 12);
      await delay(400);
      break;
    case 'automatic-suggestions':
      await open('src/suggestions.ts');
      {
        const target=fixtureLine('src/suggestions.ts','sample',true);
        await goto(target.line,target.text.length+1);
      }
      await windowControl.type('.');
      if(phase==='before') await windowControl.waitFor("!!document.querySelector('.suggest-widget')?.getBoundingClientRect().height");
      else await delay(1100);
      break;
    case 'tab-completion':
      await open('src/snippet-suggestions.ts');
      {
        const prefix = fixtureLine('src/snippet-suggestions.ts', 'sam', true);
        await goto(prefix.line, prefix.column + 'sam'.length);
      }
      try {
        await windowControl.waitFor("(()=>{const e=document.querySelector('.monaco-editor.focused');return e?.contains(document.activeElement)&&e.innerText.includes('sam')})()");
      }
      catch (error) { await saveCompletionDiagnostics('tab-completion-editor-focus'); throw error; }
      await assertNoActiveCompletion('tab-completion-before-trigger');
      await windowControl.command('TypeScript: Restart TS Server');
      await windowControl.key(' ', 'Space', 2);
      await waitForCompletion(['sampleNames', 'Sample loop', 'Sample card'], 'tab-completion', 'sam');
      break;
    case 'tab-expansion': {
      const file = 'src/snippet-suggestions.ts';
      await resetEditorBuffer(file);
      await replaceToken(file, 'sam', 'shotloop');
      await windowControl.key('Escape', 'Escape');
      if (appliedSettings['editor.tabFocusMode'] === true) throw new Error('Tab expansion fixture has editor.tabFocusMode enabled.');
      await assertNoActiveCompletion('tab-expansion-before-tab');
      await windowControl.key('Tab', 'Tab');
      await windowControl.waitForPaint();
      if (!await windowControl.evaluate("!!document.querySelector('.monaco-editor.focused')?.contains(document.activeElement)")) throw new Error('Tab lost editor focus.');
      placeholderWitness = null;
      if (phase === 'after') placeholderWitness = await selectedText();
      break;
    }
    case 'emmet-expansion': {
      const file = 'src/emmet.html';
      await resetEditorBuffer(file);
      const target = fixtureLine(file, 'ul>li.item*3', true);
      await goto(target.line, target.column + 'ul>li.item*3'.length);
      await windowControl.key('Escape', 'Escape');
      if (appliedSettings['editor.tabFocusMode'] === true) throw new Error('Emmet fixture has editor.tabFocusMode enabled.');
      await assertNoActiveCompletion('emmet-expansion-before-tab');
      await windowControl.key('Tab', 'Tab');
      await windowControl.waitForPaint();
      if (!await windowControl.evaluate("!!document.querySelector('.monaco-editor.focused')?.contains(document.activeElement)")) throw new Error('Tab lost editor focus.');
      break;
    }
    case 'selected-suggestion': {
      await open('src/suggestions.ts');
      const target = fixtureLine('src/suggestions.ts', 'sample', true);
      await goto(target.line, target.text.length + 1);
      await windowControl.type('.');
      await assertNoActiveCompletion('selected-suggestion-before-trigger');
      await windowControl.key(' ', 'Space', 2);
      let state = await waitForCompletion(['active'], 'selected-suggestion-color', 'sample.');
      for (let index = 0; index <= state.rows.length && state.selected !== 'active'; index += 1) {
        await windowControl.key('ArrowDown', 'ArrowDown');
        state = await completionState('sample.');
      }
      if (state.selected !== 'active') throw new Error(`Could not select the active member completion: ${JSON.stringify(state)}`);
      break;
    }
    case 'autosave':
      if (phase === 'before') {
        await open('src/autosave.ts');
        const target = fixtureLine('src/autosave.ts', 'const trim = "base";', true);
        autosaveSentinel = `vss-autosave-${Date.now()}`;
        if ((await readFile(path.join(workspaceDir, 'src', 'autosave.ts'), 'utf8')).includes(autosaveSentinel)) throw new Error('Autosave sentinel already exists on disk.');
        await goto(target.line, target.text.length + 1);
        await windowControl.type(` // ${autosaveSentinel}`);
        await windowControl.waitForPainted('.editor-group-container>.title .codicon-close-dirty');
      }
      if (phase === 'after') {
        const editedFile = path.join(workspaceDir, 'src', 'autosave.ts');
        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
          const state = await windowControl.notificationState();
          if (state.toasts.length) throw new Error(`Autosave surfaced a notification: ${JSON.stringify(state)}`);
          if ((await readFile(editedFile, 'utf8')).includes(autosaveSentinel) && !await windowControl.elementPainted('.editor-group-container>.title .codicon-close-dirty')) return true;
          await delay(250);
        }
        throw new Error(`Autosave did not persist ${autosaveSentinel} and clear the dirty state within 10 seconds.`);
      }
      break;
    case 'operation-confirmations': {
      const file = path.join(workspaceDir, 'src', 'delete-me.txt'), movedFile = path.join(workspaceDir, 'src', 'components', 'delete-me.txt');
      const original = await readFile(path.join(fixtureDir, 'src', 'delete-me.txt'));
      if (phase === 'before' && ((await readFile(file)).compare(original) !== 0 || await access(movedFile).then(() => true, () => false))) throw new Error('Operation source or destination was not reset before the confirmation capture.');
      await open('src/delete-me.txt');
      await windowControl.command('File: Reveal Active File in Explorer');
      await windowControl.command('View: Focus Explorer');
      await windowControl.dragExplorerFileToFolder('delete-me.txt', 'components');
      if (phase === 'before') {
        await windowControl.assertExpectedOperationConfirmation();
        if ((await readFile(file)).compare(original) !== 0 || await access(movedFile).then(() => true, () => false)) throw new Error('The pending move confirmation changed the fixture file.');
      }
      else {
        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
          if ((await readFile(movedFile).catch(() => Buffer.alloc(0))).compare(original) === 0 && !await access(file).then(() => true, () => false)) break;
          await delay(250);
        }
        if ((await readFile(movedFile).catch(() => Buffer.alloc(0))).compare(original) !== 0 || await access(file).then(() => true, () => false)) throw new Error('Explorer drop did not move the exact fixture file within 10 seconds.');
        await windowControl.command('File: Reveal Active File in Explorer');
        await windowControl.waitFor("[...document.querySelectorAll('.explorer-folders-view .monaco-list-row')].some((row) => row.innerText.includes('delete-me.txt'))");
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
    case 'code-style': {
      await open('src/code-style.ts');
      const target = fixtureLine('src/code-style.ts', 'export { f };');
      await goto(target.line, target.text.length + 1);
      break;
    }
    case 'code-decorations': {
      await open('src/nested-styles.css');
      {
        const target = fixtureLine('src/nested-styles.css', '.card-36');
        await goto(target.line, target.text.indexOf('#9b87f5') + 1);
      }
      if(phase==='before'){
        await windowControl.waitForPainted('.monaco-editor .sticky-widget');
        await windowControl.waitForPainted('.monaco-editor .colorpicker-color-decoration');
      }else{
        await windowControl.waitForPainted('.monaco-editor .sticky-widget',false);
        await windowControl.waitForPainted('.monaco-editor .colorpicker-color-decoration',false);
      }
      break;
    }
    case 'editor-hints': {
      await open('src/editor-hints.ts');
      {
        const target = fixtureLine('src/editor-hints.ts', 'formatLabel(greeting');
        await goto(target.line, target.text.indexOf('greeting') + 2);
      }
      if (phase === 'before') {
        await windowControl.command('Trigger Parameter Hints');
        await windowControl.waitForPainted('.parameter-hints-widget');
        await windowControl.waitForPainted('.lightbulb-glyph,.lightBulbWidget,.codicon-lightbulb-autofix');
      } else {
        await delay(700);
        await windowControl.waitForPainted('.parameter-hints-widget',false);
        await windowControl.waitForPainted('.lightbulb-glyph,.lightBulbWidget,.codicon-lightbulb-autofix',false);
      }
      break;
    }
    case 'indentation-tabs': {
      await open('src/indentation.ts');
      const source = readFileSync(path.join(workspaceDir, 'src', 'indentation.ts'));
      if (!/^\tconst heading/m.test(source.toString()) || !/^\t\t\treturn/m.test(source.toString())) throw new Error('Indentation fixture no longer has literal one- and three-tab lines.');
      if (phase === 'before') indentationSource = source;
      else if (!indentationSource?.equals(source)) throw new Error('Indentation fixture bytes changed between pair sides.');
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
      const target = fixtureLine('src/surface-scroll.ts', 'surface line 41');
      await goto(target.line, target.text.length + 1);
      await windowControl.moveToSelector('.monaco-editor .scrollbar.vertical');
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
      saveWitness[phase==='before'?0:1]=await readFile(file,'utf8');
      break;
    }
    default:
      throw new Error(`Unknown UI interaction: ${name}`);
  }
}
async function resetInteraction(name) {
  if(name==='automatic-suggestions'){
    await windowControl.key('Escape','Escape');await windowControl.key('Backspace','Backspace');
  }else if(name==='selected-suggestion'){
    await windowControl.key('Escape','Escape'); await resetEditorBuffer('src/suggestions.ts');
  }else if(name==='operation-confirmations'){
    await windowControl.key('Escape','Escape');await windowControl.assertNoModalOrToast();
    await rm(path.join(workspaceDir,'src/components/delete-me.txt'),{force:true});
    await writeFile(path.join(workspaceDir,'src/delete-me.txt'),await readFile(path.join(fixtureDir,'src/delete-me.txt')));
  }else if(name==='recommendations') await windowControl.clearNotifications();
  else if(name==='save-diff') await writeFile(path.join(workspaceDir,'src/save-state.ts'),await readFile(path.join(fixtureDir,'src/save-state.ts')));
  else if(!['autosave','surface-boundaries','code-style','code-decorations','indentation-tabs','folding-and-guides','scrollbars-and-ruler','marker-colors'].includes(name)) await windowControl.key('Escape','Escape');
  await open('src/main.ts');
  await goto(1, 1);
}
function imageFilename(name) {
  if (imageNames.has(name)) throw new Error(`Duplicate screenshot name: ${name}`);
  imageNames.add(name);
  return path.join(imageDir, name);
}
async function capture(name, chapter, group, description, captureState = 'none', deferAcceptance = false) {
  assertOwnerAway(`capture ${name}`);
  logFrontmost(`before capture ${name}`);
  if (captureState === 'operation-confirmation') await windowControl.assertExpectedOperationConfirmation();
  else if (captureState === 'recommendation-toast') await windowControl.assertExpectedRecommendationToast();
  else await windowControl.assertNoModalOrToast();
  await windowControl.waitForPaint();
  const destination = imageFilename(name);
  const captureDestination = `${destination}.${process.pid}.capture.png`;
  await rm(captureDestination, { force: true });
  if (!childIsRunning(appChild)) throw new Error('Refusing to capture without the VS Code process started by this run.');
  const finderArgs = [appPath, String(appChild.pid)];
  const [windowId, width, height] = run(finderBinary, finderArgs).split(/\s+/);
  if (width !== '1200' || height !== '800') {
    throw new Error(`Expected a 1200x800 point window, found ${width}x${height}`);
  }
  logFrontmost(`immediately before capture ${name}`);
  const captureStartedAt = Date.now();
  execFileSync('screencapture', ['-x', '-l', windowId, captureDestination], { stdio: 'inherit' });
  const image = await readFile(captureDestination);
  const imageInfo = await stat(captureDestination);
  if (imageInfo.size < pngSignature.length || !image.subarray(0, pngSignature.length).equals(pngSignature) || imageInfo.mtimeMs < captureStartedAt) {
    throw new Error(`The capture was not a fresh PNG: ${captureDestination}`);
  }
  const dimensions = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', captureDestination], { encoding: 'utf8' });
  if (!dimensions.includes('pixelWidth:') || !dimensions.includes('pixelHeight:')) throw new Error(`Unable to verify screenshot dimensions: ${destination}`);
  const afterCapture = logFrontmost(`immediately after capture ${name}`);
  const [afterWindowId] = run(finderBinary, finderArgs).split(/\s+/);
  if (afterWindowId !== windowId) throw new Error(`Capture ${name} changed the VS Code window identity.`);
  console.log(`Captured ${name}; frontmost is ${afterCapture.name} (PID ${afterCapture.pid}).`);
  const row = { chapter, group, file: path.relative(outputDir, destination), description };
  if (deferAcceptance) row.pendingCapture = captureDestination;
  else {
    await rename(captureDestination, destination);
    indexRows.push(row);
    await persistIndex();
  }
  return row;
}
async function acceptCaptures(rows) {
  for (const row of rows) {
    if (row.pendingCapture) {
      await rename(row.pendingCapture, path.join(outputDir, row.file));
      delete row.pendingCapture;
    }
    indexRows.push(row);
  }
  await persistIndex();
}

async function applyPairSettings(settings, spec, { initial = false } = {}) {
  const previous = structuredClone(appliedSettings);
  if (JSON.stringify(previous) === JSON.stringify(settings)) return;
  await writeSettings(settings);
  if (initial || !appChild) return;
  const oldStyle = previous['custom-ui-style.stylesheet'];
  const newStyle = settings['custom-ui-style.stylesheet'];
  const styleChanged = JSON.stringify(oldStyle) !== JSON.stringify(newStyle);
  const windowChanged = [...new Set([...Object.keys(previous), ...Object.keys(settings)])]
    .filter((key) => key.startsWith('window.'))
    .some((key) => JSON.stringify(previous[key]) !== JSON.stringify(settings[key]));
  if (styleChanged && installedExtensions.has(customUIStyleId)) await applyCustomUIStyleAndRestart();
  else if (spec.restart || windowChanged) await restartApp();
  else await assertThemeReady();
}

async function compareMean(pathname) {
  const value = execFileSync('magick', [pathname, '-colorspace', 'Gray', '-format', '%[fx:mean*255]', 'info:'], { encoding: 'utf8' });
  const mean = Number(value);
  if (!Number.isFinite(mean)) throw new Error(`Could not measure grayscale pixels in ${pathname}`);
  return mean;
}
async function recordPairFailure(descriptor, names, error, cleanup) {
  if (error.code === 'OWNER_RETURNED') throw error;
  let message = String(error.message || error).replace(/\s+/g, ' ').trim();
  try {
    await cleanup();
  } catch (failure) {
    message += `; cleanup: ${failure.message}`;
  }
  if (JSON.stringify(appliedSettings) !== JSON.stringify(descriptor.after)) {
    await applyPairSettings(descriptor.after, descriptor.spec);
  }
  if (descriptor.spec.previewSettings) await writeSettings(descriptor.after);
  const failedDir = path.join(outputDir, 'failed');
  await mkdir(failedDir, { recursive: true });
  for (const name of names) {
    const staged = `${path.join(imageDir, name)}.${process.pid}.capture.png`;
    const image = path.join(imageDir, name);
    const failed = path.join(failedDir, name);
    const source = await access(staged).then(() => staged, () => access(image).then(() => image, () => null));
    if (source) {
      await rename(source, failed);
      indexRows.push({ chapter: descriptor.chapter, group: descriptor.groupKey, file: path.relative(outputDir, failed), description: `failed: ${message}` });
    }
  }
  failedPairs.push(`${descriptor.canonical}: ${message}`);
  await persistIndex();
  console.error(`Failed pair ${descriptor.canonical}: ${message}`);
  if (runOptions.only) throw new Error(`Selected pair failed: ${descriptor.canonical}: ${message}`);
}
async function captureExtraPair(descriptor) {
  const { chapter, groupKey, kind, spec } = descriptor;
  const names = [`${descriptor.filename}-before.png`, `${descriptor.filename}-after.png`];
  const beforeSettings = descriptor.before;
  const afterSettings = descriptor.after;
  const interaction = kind === 'find' ? 'find-widget' : `${kind}-expansion`;
  const selector = kind === 'find' ? '.editor-widget.find-widget' : '.monaco-editor .view-lines';
  const evidenceKey = kind === 'find' ? 'find-widget' : 'tab-completion';
  const rows = [];
  const states = [];
  try {
    await applyPairSettings(beforeSettings, spec);
    if (spec.previewSettings) await writeTransientSettings(spec.previewSettings);
    for (const [index, phase] of ['before', 'after'].entries()) {
      if (index === 1) {
        await applyPairSettings(afterSettings, spec);
        if (spec.previewSettings) await writeTransientSettings(spec.previewSettings);
      }
      await runInteraction(interaction, phase, appliedSettings);
      const state = await measureGroup(evidenceKey, names[index], selector);
      const description = phase === 'before' ? `Before ${kind} expansion is enabled.` : `After ${kind} expansion is enabled.`;
      const row = await capture(names[index], chapter, groupKey, description, 'none', true);
      states.push(state);
      rows.push(row);
      if (kind !== 'find') {
        const fullText = await copyEditorBuffer();
        const pristine = (await readFile(path.join(fixtureDir, kind === 'tab' ? 'src/snippet-suggestions.ts' : 'src/emmet.html'), 'utf8')).replaceAll('\r\n', '\n');
        if (kind === 'tab') {
          const replacement = phase === 'before' ? 'shotloop' : 'for (const item of items) {\n  \n}';
          const expected = normalizeEditorText(pristine.replace(/^sam$/m, replacement));
          if (normalizeEditorText(fullText) !== expected) throw new Error(`Tab expansion did not preserve the exact expected fixture text: ${fullText}`);
          if(phase==='after'&&placeholderWitness!=='items')throw Error('Sample loop placeholder not selected.');
          row.description = phase === 'before'
            ? 'The Tab key leaves shotloop as literal text while completion is off.'
            : 'The Tab key expands shotloop into the Sample loop body.';
        } else {
          if (phase === 'before') {
            if (normalizeEditorText(fullText) !== normalizeEditorText(pristine)) {
              throw new Error(`Emmet off did not preserve the abbreviation and surrounding HTML: ${fullText}`);
            }
          } else {
            const list = fullText.match(/<ul>\s*[\s\S]*?<\/ul>/)?.[0] || '';
            const items = [...list.matchAll(/<li class="item"><\/li>/g)];
            if (!list.startsWith('<ul>') || !list.endsWith('</ul>') || items.length !== 3
              || fullText.includes('ul>li.item*3') || !fullText.includes('<title>Emmet sample</title>')) {
              throw new Error(`Emmet did not expand the abbreviation into three list items: ${fullText}`);
            }
          }
          row.description = phase === 'before'
            ? 'The Tab key leaves ul>li.item*3 as literal HTML text.'
            : 'The Tab key expands the abbreviation into three li.item elements.';
        }
      }
      if (index === 0 && kind !== 'find') await resetEditorBuffer(kind === 'tab' ? 'src/snippet-suggestions.ts' : 'src/emmet.html');
    }
    const [before, after] = states;
    const broadPixels = await compareEvidence(evidenceKey, before, after);
    if (!broadPixels.changed) throw new Error(`${kind} editor crop contains no changed pixels.`);
    if (kind === 'find') {
      const a = before.metric.findState;
      const b = after.metric.findState;
      if (!a || !b || a.query !== 'vss-find-no-match-9zq' || a.query !== b.query
        || JSON.stringify(a.toggles) !== JSON.stringify(b.toggles)
        || JSON.stringify(a.rect) !== JSON.stringify(b.rect)
        || !a.shadow.includes('0px 0px 8px 2px') || b.shadow !== 'none') {
        throw new Error(`Find query, geometry, toggles, or shadow transition did not match: ${JSON.stringify([a, b])}`);
      }
      const viewport = before.viewport;
      const regions = planner.findShadowRegions(a.rect, a.shadow, viewport);
      const shadow = await compareRegion(before, after, regions.shadow, 'find-shadow-exterior');
      const control = await compareRegion(before, after, regions.control, 'find-shadow-control');
      const [beforeMean, afterMean] = await Promise.all([compareMean(shadow.paths[0]), compareMean(shadow.paths[1])]);
      const [controlBefore, controlAfter] = await Promise.all([compareMean(control.paths[0]), compareMean(control.paths[1])]);
      if (!shadow.changed || afterMean <= beforeMean || control.changed || Math.abs(controlBefore - controlAfter) > 0.01) {
        throw new Error('The lower exterior shadow band did not lighten against its unchanged control.');
      }
      rows[0].description = 'The same no-match Find widget has its default lower exterior shadow.';
      rows[1].description = 'The same no-match Find widget has no lower exterior shadow.';
    }
    if (kind !== 'find') await resetEditorBuffer(kind === 'tab' ? 'src/snippet-suggestions.ts' : 'src/emmet.html');
    await resetInteraction(interaction, 'after');
    if (spec.previewSettings) await writeSettings(afterSettings);
    await acceptCaptures(rows);
  } catch (error) {
    await recordPairFailure(descriptor, names, error, async () => {
      if (kind === 'find') await resetInteraction(interaction, 'failed');
      else await resetEditorBuffer(kind === 'tab' ? 'src/snippet-suggestions.ts' : 'src/emmet.html');
    });
  }
}
function normalizeEditorText(text) { return text.replace(/\r\n/g, '\n').split('\n').map(s => s.trim()).join('\n'); }
async function capturePair(chapter, groupKey, currentSettings) {
  const descriptor = fullPlan.find((pair) => pair.chapter === chapter.chapter && pair.groupKey === groupKey && pair.kind === 'group');
  const spec = descriptor.spec;
  const tag = descriptor.filename;
  const beforeName = `${tag}-before.png`;
  const afterName = `${tag}-after.png`;
  const pairFiles = [beforeName, afterName];
  const beforeSettings = descriptor.before;
  const afterSettings = descriptor.after;
  const rows = [];
  try {
    await applyPairSettings(beforeSettings, spec);
    if (spec.previewSettings) await writeTransientSettings(spec.previewSettings);
    await runInteraction(spec.interaction, 'before', beforeSettings);
    const before = await measureGroup(groupKey, beforeName);
    const beforeState = groupKey === 'operation-confirmations' ? 'operation-confirmation' : groupKey === 'recommendation-notifications' ? 'recommendation-toast' : 'none';
    const beforeRow = await capture(beforeName, chapter.chapter, groupKey, `Before: ${spec.description}.`, beforeState, true);
    rows.push(beforeRow);
    if (groupKey !== 'autosave') await resetInteraction(spec.interaction, 'before');
    if (spec.previewSettings) await writeSettings(beforeSettings);
    await applyPairSettings(afterSettings, spec);
    if (spec.previewSettings) await writeTransientSettings(spec.previewSettings);
    await runInteraction(spec.interaction, 'after', appliedSettings);
    const after = await measureGroup(groupKey, afterName);
    const afterRow = await capture(afterName, chapter.chapter, groupKey, `After the setting change, ${spec.description}.`, 'none', true);
    rows.push(afterRow);
    await setPairDescription(groupKey, before, after, rows);
    if (groupKey === 'cursor-colors') {
      const cursor = before.metric.cursorStyle[0].rect;
      const glyphPixels = await compareRegion(before, after, cursor, 'cursor-glyph');
      const control = { left: cursor.right - 3, right: cursor.right - 1, top: cursor.top + 1, bottom: cursor.top + 3 };
      const gradientPixels = await compareRegion(before, after, control, 'cursor-gradient-control');
      if (!glyphPixels.changed || gradientPixels.changed || before.metric.cursorStyle[0].glyphColor !== after.metric.cursorStyle[0].glyphColor) {
        throw new Error('The cursor glyph did not change while its gradient-only pixels and underlying token remained unchanged.');
      }
    }
    if (groupKey === 'selected-suggestion-color') {
      const rect = before.metric.selectedRect;
      const patch = { left: rect.left + rect.width * 0.72, right: rect.left + rect.width * 0.82, top: rect.top + rect.height * 0.35, bottom: rect.top + rect.height * 0.65 };
      if (!(await compareRegion(before, after, patch, 'selected-row-fill')).changed) throw new Error('The selected row background patch did not change.');
    }
    if (groupKey === 'sidebar-and-title') {
      if (!(await compareRegion(before, after, before.metric.titleState.bar, 'title-margin-effect')).changed) throw new Error('The title crop did not show truncation.');
      if (!(await compareRegion(before, after, before.metric.sidebarPatch, 'sidebar-color')).changed) throw new Error('The blank sidebar color patch contains no changed pixels.');
      beforeRow.description = 'Before the title margin change, the long filename fits and the Explorer uses #14111B.';
      afterRow.description = 'After the title margin change, the long filename is clipped and the Explorer uses #191521.';
    }
    if (groupKey === 'cursor-colors') {
      beforeRow.description = 'The M under the focused block cursor is green while the cursor gradient remains visible.';
      afterRow.description = 'The same M under the focused block cursor is black with the same cursor gradient.';
    }
    if (groupKey === 'tab-completion') {
      beforeRow.description = 'The ordinary sampleNames completion ranks ahead of both fixture snippets.';
      afterRow.description = 'Both fixture snippets rank ahead of the same sampleNames completion.';
    }
    if (groupKey === 'selected-suggestion-color') {
      beforeRow.description = 'The selected active completion row uses the theme background #4D4D4D.';
      afterRow.description = 'The same selected active completion row uses #3A334B.';
    }
    if (groupKey === 'autosave') {
      beforeRow.description = `Before auto save, ${autosaveSentinel} is in the dirty buffer and absent from disk.`;
      afterRow.description = `After auto save, ${autosaveSentinel} is on disk and the dirty indicator cleared.`;
    }
    if (groupKey !== 'autosave') await resetInteraction(spec.interaction, 'after');
    if (spec.previewSettings) await writeSettings(afterSettings);
    if (groupKey === 'recommendation-notifications') await rm(path.join(workspaceDir, '.vscode', 'extensions.json'), { force: true });
    await acceptCaptures(rows);
  } catch (error) {
    await recordPairFailure(descriptor, pairFiles, error, async () => {
      if (groupKey !== 'autosave') await resetInteraction(spec.interaction, 'failed');
      if (groupKey === 'recommendation-notifications') await rm(path.join(workspaceDir, '.vscode', 'extensions.json'), { force: true });
    });
  }
  return appliedSettings;
}

function csv(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}
function rowLine(row) { return [row.chapter, row.group, row.file, row.description].map(csv).join(','); }

async function persistIndex() {
  await writeFile(indexPath,[['chapter','group','file','description'].map(csv).join(','),...indexRows.map(rowLine)].join('\n')+'\n');
}

async function applyChapterSnapshot(settings) {
  await writeSettings(settings);
  if(installedExtensions.has(customUIStyleId)&&Object.keys(settings).some(key=>key.startsWith('custom-ui-style.'))) await applyCustomUIStyleAndRestart();
  else await restartApp();
  plannedSettings=structuredClone(settings);
}

try {
  logFrontmost('before the run');
  if (runOptions.only) {
    await installRequiredExtensions();
    await writeSettings(selectedPlan[0].before);
    await startApp();
    for (const descriptor of selectedPlan) {
      const chapter = chapters.find((item) => item.chapter === descriptor.chapter);
      if (descriptor.kind === 'group') await capturePair(chapter, descriptor.groupKey, settingsByChapter[descriptor.chapter]);
      else await captureExtraPair(descriptor);
    }
  } else {
    await startApp();
    await capture('00-zero.png', 0, 'zero', 'A fresh profile opens the fixed sample project with no user-installed extensions.');
    for (const chapter of chapters) {
      await installRecommendations(chapter);
      await restartApp();
      const currentSettings = readChapterSettings(chapter);
      if (smokeMode) {
        if (chapter.chapter <= 2 || chapter.chapter === 4) {
          await applyChapterSnapshot(currentSettings);
          continue;
        }
        if (chapter.chapter === 3) {
          await capturePair(chapter, 'window-chrome', currentSettings);
          await applyChapterSnapshot(currentSettings);
          continue;
        }
        if (chapter.chapter === 5) {
          const cursor = groupSpecs['cursor-appearance'];
          const next = planner.deepMerge(structuredClone(plannedSettings), planner.copyGroupSettings(currentSettings, cursor.settings));
          await writeSettings(next);
          await applyCustomUIStyleAndRestart();
          plannedSettings = structuredClone(next);
          await capturePair(chapter, 'multi-cursor', currentSettings);
          break;
        }
        continue;
      }
      for (const groupKey of chapter.groups) {
        await capturePair(chapter, groupKey, currentSettings);
        const extras = fullPlan.filter((pair) => pair.chapter === chapter.chapter && pair.groupKey === groupKey && pair.kind !== 'group');
        for (const descriptor of extras) await captureExtraPair(descriptor);
      }
      await applyChapterSnapshot(currentSettings);
      await windowControl.key('Escape', 'Escape');
      await open('src/main.ts');
      const checkpoint = `ch${String(chapter.chapter).padStart(2, '0')}-checkpoint.png`;
      await capture(checkpoint, chapter.chapter, 'checkpoint', `After chapter ${chapter.chapter}, its cumulative settings are shown in the fixed sample project.`);
    }
  }
} finally {
  await quitApp(); if (runOptions.only) await copyFile(path.join(fixtureDir, 'src/emmet.html'), path.join(workspaceDir, 'src/emmet.html'));
  await rm(profileDir,{recursive:true,force:true});
}

const expectedImageCount = runOptions.only ? selectedPlan.length * 2 : smokeMode ? 5 : 78;
if(!failedPairs.length&&indexRows.length!==expectedImageCount) throw new Error(`Expected ${expectedImageCount} image-index rows; recorded ${indexRows.length}`);
for(const row of indexRows) await access(path.join(outputDir,row.file));
if(!runOptions.only&&!smokeMode&&!failedPairs.length&&!indexRows.some(row=>row.file.endsWith('ch11-checkpoint.png'))) throw new Error('Missing chapter 11 checkpoint.');
await persistIndex();
console.log(`Captured ${indexRows.filter((row) => !row.description.startsWith('failed:')).length} PNGs; failed pairs: ${failedPairs.length}. Image index: ${indexPath}`);
if (failedPairs.length) { console.error(failedPairs.join('\n')); process.exitCode = 1; }
