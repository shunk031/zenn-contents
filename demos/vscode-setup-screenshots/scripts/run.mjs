import { readFileSync } from 'node:fs';
import { access, cp, mkdir, readFile, rename, rm, stat, writeFile, appendFile } from 'node:fs/promises';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { VSCodeControl, visibleGeometry } from './cdp.mjs';
import { extensionPins, groupSpecs } from './groups.mjs';
import { installMarketplaceExtension } from './install-extension.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const kitDir = path.resolve(here, '..');
const outputDir = path.join(kitDir, 'output');
const smokeMode = process.argv.includes('--smoke');
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
const appExecutable = path.join(appPath, 'Contents', 'MacOS', 'Electron');
const finderSource = path.join(here, 'window-id.swift');
const finderBinary = path.join(runtimeDir, 'window-id');
const cliPath = path.join(appPath, 'Contents', 'Resources', 'app', 'bin', 'code');
const frontmostSource = path.join(here, 'frontmost.swift');
const frontmostBinary = path.join(runtimeDir, 'frontmost');
const imageDir = path.join(captureOutputDir, 'images');
const indexPath = path.join(captureOutputDir, 'image-index.csv');
const activePortFile = path.join(profileDir, 'DevToolsActivePort');
const windowSize = '1200,800';
const customUIStyleId = 'subframe7536.custom-ui-style';
let devtoolsPort;
let ownerIdleSample;
const fixtureDir = path.join(kitDir, 'fixture');
const chapters = JSON.parse(await readFile(path.join(kitDir, 'manifest', 'chapters.json'), 'utf8'));

if (process.argv.includes('--help')) {
  console.log('Usage: node ./scripts/run.mjs [--smoke]\nRebuilds the isolated VS Code profile and captures the screenshot set. --smoke checks zoom crop calibration and multi-cursor. Run only while nobody is using the Mac.');
  process.exit(0);
}

if (process.platform !== 'darwin') throw new Error('This screenshot route requires macOS.');
assertOwnerAway('run start');
await mkdir(outputDir, { recursive: true });
await rm(runtimeDir, { recursive: true, force: true });
await mkdir(runtimeDir, { recursive: true });
await rm(profileDir, { recursive: true, force: true });
await rm(imageDir, { recursive: true, force: true });
await rm(indexPath, { force: true });
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

const userSettingsPath = path.join(profileDir, 'User', 'settings.json');
await mkdir(path.dirname(userSettingsPath), { recursive: true });
let appliedSettings = {};
let windowControl;
let appChild;
let activeFile;
let plannedSettings = {};
let autosaveSentinel;
let indentationSource;
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
  return JSON.parse(readFileSync(sourceFile(chapter.chapter, 'settings.json'), 'utf8'));
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
      execFileSync(cliPath, ['--user-data-dir', profileDir, '--extensions-dir', extensionsDir, '--install-extension', vsix, '--force'], { stdio: 'inherit', env: { ...process.env, VSCODE_IPC_HOOK_CLI: '' } });
      if (appCopyRunning()) throw new Error('Extension CLI unexpectedly left a VS Code process using the kit profile running.');
      const installed = JSON.parse(await readFile(path.join(extensionsDir, `${id}-${extensionPins.get(id)}`, 'package.json'), 'utf8'));
      if (`${installed.publisher}.${installed.name}`.toLowerCase() !== id || installed.version !== extensionPins.get(id)) throw new Error(`Isolated extension install identity mismatch for ${id}.`);
    }
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
  await delay(800);
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
    const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(visible);
    if(!e) return null;
    const box=rect(e), viewport={width:innerWidth,height:innerHeight}, sidebar=document.querySelector('.sidebar');
    const ancestors=[]; for(let n=e;n instanceof Element;n=n.parentElement) ancestors.push(getComputedStyle(n));
    const visibility={display:ancestors.some(s=>s.display==='none')?'none':'block',visibility:ancestors.some(s=>s.visibility==='hidden')?'hidden':'visible',opacity:ancestors.reduce((value,s)=>value*Number(s.opacity||1),1),rects:[e,...e.querySelectorAll('*')].map(rect),viewport};
    const rows=[...document.querySelectorAll('.suggest-widget .monaco-list-row')], selected=rows.find(n=>n.matches('.focused,.selected,[aria-selected="true"]'));
    const comment=[...document.querySelectorAll('.monaco-editor .view-line')].find(n=>n.innerText.includes('Sample comment'));
    const row=[...document.querySelectorAll('.explorer-folders-view .monaco-list-row')].find(n=>n.innerText.includes('changed.ts'));
    const tree=[...document.querySelectorAll('.explorer-folders-view .monaco-list-row')].filter(visible).map(n=>{
      const icon=n.querySelector('.monaco-icon-label,.file-icon,.folder-icon'), i=icon&&getComputedStyle(icon,'::before');
      const guides=[...n.querySelectorAll('.monaco-tl-indent .indent-guide')].map(g=>[getComputedStyle(g).borderLeftColor,getComputedStyle(g).backgroundColor]);
      return [n.innerText.trim(),n.className,icon?.className,i?.backgroundImage,i?.content,guides];
    });
    const cursors=[...document.querySelectorAll('.cursors-layer .cursor')].filter(visible), cursorStyle=cursors.map(n=>{
      const s=getComputedStyle(n), r=rect(n), glyph=[...document.querySelectorAll('.monaco-editor .view-line span')].find(g=>{
        const b=g.getBoundingClientRect(); return b.width>0&&b.height>0&&b.right>r.left&&b.left<r.right&&b.bottom>r.top&&b.top<r.bottom;
      });
      return [s.color,s.backgroundColor,r.width,r.height,s.borderLeft,glyph&&getComputedStyle(glyph).color];
    });
    const chrome=['.part.activitybar','.part.statusbar','.tabs-container','.breadcrumbs-control','.minimap'].map(q=>[q,[...document.querySelectorAll(q)].some(visible)]);
    const lines=[...document.querySelectorAll('.monaco-editor .view-line')], ink=(n)=>{
      if(!n)return null; const walker=document.createTreeWalker(n,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()){const index=walker.currentNode.textContent.search(/\S/);if(index>=0){const range=document.createRange();range.setStart(walker.currentNode,index);range.setEnd(walker.currentNode,index+1);const r=range.getBoundingClientRect();return {x:r.x,width:r.width};}}
      return null;
    };
    const line=(text)=>lines.find(n=>n.innerText.replace(/\u00a0/g,' ').includes(text));
    const base=ink(line('export function')), one=ink(line('const heading'));
    const nested=ink(lines.find(n=>n.innerText.includes('return')&&n.innerText.includes('heading')));
    const commentSpan=comment?.querySelector('span')||comment;
    const editor=document.querySelector('.monaco-editor'), scroll=editor?.querySelector('.monaco-scrollable-element');
    const title=document.querySelector('.editor-group-container>.title'), fileTitle=document.querySelector('.title .monaco-icon-label.file-icon');
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
    return {box,viewport,visibility,metric:{text:e.innerText?.slice(0,240),editorText:document.querySelector('.monaco-editor .view-lines')?.innerText||'',lineNumbers:[...document.querySelectorAll('.monaco-editor .line-numbers')].slice(0,4).map(n=>n.innerText.trim()),editorBg:editorStyle.backgroundColor,editorColor:editorStyle.color,devicePixelRatio,y:box.top,textX:e.firstChild?(()=>{const r=document.createRange();r.selectNodeContents(e);return r.getBoundingClientRect().x;})():box.left,w:box.width,pad:style.paddingLeft,shadow:style.boxShadow,font:getComputedStyle(lines[0]?.querySelector('span')||e).font,lineHeight:getComputedStyle(lines[0]||e).lineHeight,dirty:dirty.length,chrome,sidebarRect:visible(sidebar)?rect(sidebar):null,sidebar:getComputedStyle(sidebar||e).backgroundColor,tree,toast,dialogs,suggestVisible:visible(document.querySelector('.suggest-widget')),selectedSuggestion:selected?.innerText.trim(),selectedBg:selected&&getComputedStyle(selected).backgroundColor,cursorStyle,cursors:cursors.length,sliders:sliders.length,scroll:[scroll?.scrollTop,scroll?.scrollHeight,scroll?.clientHeight,scroll?.scrollLeft,scroll?.scrollWidth,scroll?.clientWidth],squiggles:document.querySelectorAll('.monaco-editor .squiggly-error').length,badges:document.querySelectorAll('.explorer-folders-view .monaco-list-row .badge,.explorer-folders-view .monaco-list-row .monaco-count-badge').length,gitColor:row?getComputedStyle(row.querySelector('.label-name')||row).color:'',focus:getComputedStyle(document.querySelector('.explorer-folders-view .monaco-list-row.focused')||e).outlineColor,justify:getComputedStyle(title||e).justifyContent,decoration:getComputedStyle(document.querySelector('.monaco-editor .scroll-decoration')||e).display,sticky:[...document.querySelectorAll('.monaco-editor .sticky-widget')].filter(visible).length,swatches:swatches.length,lightbulb:lights.length,signature:signatures.length,folding:folding.length,guides,whitespace,comment:commentStyle,indent:[base,one,nested].slice(1).map(p=>base&&p?Math.round((p.x-base.x)/base.width):null),title:getComputedStyle(fileTitle||e).marginLeft,rows:rows.map(n=>n.innerText.trim()),snippets:rows.filter(n=>n.querySelector('.codicon-symbol-snippet')).map(n=>n.innerText.trim())}};
  })()`);
  if (!observed || !visibleGeometry(observed.visibility)) {
    throw new Error(`No painted DOM target for ${key}: ${selector}`);
  }
  const fullPath=path.join(captureOutputDir,'evidence',`${imageName.replace(/\.png$/,'')}.full.png`);
  await mkdir(path.dirname(fullPath),{recursive:true});
  await writeFile(fullPath,await windowControl.captureFullScreenshot());
  await writeFile(`${fullPath}.json`,JSON.stringify({box:observed.box,viewport:observed.viewport,visibility:observed.visibility,metric:observed.metric},null,2));
  return {metric:observed.metric,box:observed.box,viewport:observed.viewport,fullPath};
}

function pixelDimensions(file) {
  const png=readFileSync(file);
  if (!png.subarray(1,4).equals(Buffer.from('PNG'))) throw new Error(`Evidence is not a PNG: ${file}`);
  return {width:png.readUInt32BE(16),height:png.readUInt32BE(20)};
}

async function compareEvidence(group, before, after) {
  const boxes=[before,after].map((state)=>({
    left:state.box.left/state.viewport.width,top:state.box.top/state.viewport.height,
    right:state.box.right/state.viewport.width,bottom:state.box.bottom/state.viewport.height,
  }));
  const padding=group==='find-widget'?16:2;
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
  if(group==='cursor-colors'&&same(a.cursorStyle.map(x=>x[5]),b.cursorStyle.map(x=>x[5]))) fail('Glyph foreground under the block cursor did not change.');
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
    const rank=(m)=>[m.rows.findIndex(row=>m.snippets.some(s=>s.includes(row))),m.rows.findIndex(row=>!m.snippets.some(s=>s.includes(row)))];
    const ar=rank(a),br=rank(b);
    if(!a.rows.some(row=>row.includes('sampleNames'))||a.snippets.length<2||b.snippets.length<2||ar[0]<ar[1]||br[0]>br[1]) fail(`Completion providers or ranking were incomplete: ${JSON.stringify([ar,br,a.rows,a.snippets,b.rows,b.snippets])}`);
  }
  if(group==='selected-suggestion-color'&&(!a.selectedSuggestion||a.selectedSuggestion!==b.selectedSuggestion||a.selectedBg===b.selectedBg)) fail('The selected completion color did not change for the same item.');
  if(group==='sidebar-and-title'&&(a.sidebar!=='rgb(20, 17, 27)'||b.sidebar!=='rgb(25, 21, 33)'||a.title===b.title)) fail('Final sidebar color and title spacing did not both change.');
  if(group==='autosave'&&(a.dirty<1||b.dirty!==0||!autosaveSentinel)) fail(`Single-title dirty action did not clear: ${a.dirty} -> ${b.dirty}.`);
  if(group==='recommendation-notifications'&&(!a.toast.some(text=>/recommend/i.test(text))||b.toast.length)) fail('The Python recommendation toast did not disappear.');
  for(const row of rows) row.description=`${row.file.endsWith('before.png')?'Before':'After'} ${group}: ${groupSpecs[group].description}`;
}

async function runInteraction(name, phase, chapterSettings) {
  if (!name) return;
  switch (name) {
    case 'title-spacing':
    case 'sidebar-title':
      await open('src/main.ts');
      break;
    case 'explorer-decorations':
      await open('src/changed.ts');
      await windowControl.command('File: Reveal Active File in Explorer');
      break;
    case 'cursor-focus':
      await open('src/main.ts');
      await goto(8, 12);
      break;
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
      await windowControl.key('F', 'KeyF', 4);
      await delay(400);
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
      await windowControl.command('Trigger Suggest');
      await windowControl.waitForPainted('.suggest-widget');
      {
        const state = await windowControl.waitFor(`(() => { const rows=[...document.querySelectorAll('.suggest-widget .monaco-list-row')].map(row=>({text:row.innerText,snippet:!!row.querySelector('.codicon-symbol-snippet')})); return {visible:!!document.querySelector('.suggest-widget')?.getBoundingClientRect().height,rows}; })()`,
          (value) => value.visible && value.rows.some((row) => !row.snippet && row.text.includes('sampleNames'))
            && ['Sample loop', 'Sample card'].every((label) => value.rows.some((row) => row.snippet && row.text.includes(label))));
        if (!state.visible) throw new Error(`The completion providers did not finish: ${JSON.stringify(state)}`);
      }
      break;
    case 'tab-expansion':
      await open('src/snippet-suggestions.ts');
      { const line=fixtureLine('src/snippet-suggestions.ts','sam',true); await goto(line.line,1); await windowControl.key('Home','Home'); await windowControl.key('End','End',8); await windowControl.type('shotloop'); await windowControl.key('Escape','Escape'); if(phase==='after'){ await windowControl.key('Tab','Tab'); if(!await windowControl.evaluate("document.querySelector('.monaco-editor').innerText.includes('for (const item of items)')")) throw new Error('Tab did not expand the unique fixture snippet.'); } }
      break;
    case 'emmet-expansion': {
      await open('src/emmet.html'); const line=fixtureLine('src/emmet.html','ul>li.item*3',true); await goto(line.line,line.text.length+1); await windowControl.key('Escape','Escape');
      if(phase==='after'){ await windowControl.key('Tab','Tab'); if(await windowControl.evaluate("document.querySelector('.monaco-editor').innerText.match(/<li class=\"item\">/g)?.length")!==3) throw new Error('Emmet did not expand three fixture list items.'); }
      break;
    }
    case 'selected-suggestion':
      await open('src/suggestions.ts');
      { const target = fixtureLine('src/suggestions.ts', 'sample', true); await goto(target.line, target.text.length + 1); }
      await windowControl.type('.');
      await windowControl.command('Trigger Suggest');
      await windowControl.waitForPainted('.suggest-widget');
      await windowControl.key('ArrowDown', 'ArrowDown');
      await windowControl.waitForPainted('.suggest-widget .monaco-list-row.focused,.suggest-widget .monaco-list-row.selected,.suggest-widget .monaco-list-row[aria-selected="true"]');
      break;
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
    await windowControl.key('Escape','Escape');await windowControl.key('Z','KeyZ',4);
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

async function captureExtra(chapter, group, kind, phase) {
  const interaction = kind === 'find' ? 'find-widget' : `${kind}-expansion`, selector = kind === 'find' ? '.editor-widget.find-widget' : '.monaco-editor .view-lines';
  await runInteraction(interaction, phase, appliedSettings);
  const name = `ch${String(chapter.chapter).padStart(2, '0')}-${group}-${kind}-${phase}.png`, state = await measureGroup(kind === 'find' ? 'find-widget' : group, name, selector);
  const row = await capture(name, chapter.chapter, group, `${phase} ${kind} state measured in the same fixture editor.`, 'none', true);
  const text = await windowControl.evaluate("document.querySelector('.monaco-editor .view-lines')?.innerText || ''");
  if (phase === 'before' && kind === 'tab') {
    await windowControl.key('Tab', 'Tab');
    const after = await windowControl.evaluate("document.querySelector('.monaco-editor .view-lines')?.innerText || ''");
    if (!after.includes('shotloop') || after.includes('for (const item of items)')) throw new Error('Tab completion expanded while its setting was disabled.');
    if (after !== text) await windowControl.key('Z', 'KeyZ', 4);
    await windowControl.key('Z', 'KeyZ', 4);
  } else if (phase === 'before' && kind === 'emmet') {
    await windowControl.key('Tab', 'Tab');
    const after = await windowControl.evaluate("document.querySelector('.monaco-editor .view-lines')?.innerText || ''");
    if (!after.includes('ul>li.item*3') || after.includes('<li')) throw new Error('Emmet expanded while its setting was disabled.');
    if (after !== text) await windowControl.key('Z', 'KeyZ', 4);
  } else if (phase === 'after' && kind === 'tab') { await windowControl.key('Z', 'KeyZ', 4); await windowControl.key('Z', 'KeyZ', 4); }
  else if (phase === 'after' && kind === 'emmet') await windowControl.key('Z', 'KeyZ', 4);
  await resetInteraction(interaction, phase);
  return { state, row };
}

async function capturePair(chapter, groupKey, currentSettings) {
  const spec=groupSpecs[groupKey],tag=`ch${String(chapter.chapter).padStart(2,'0')}-${groupKey}`;
  const beforeName=`${tag}-before.png`,afterName=`${tag}-after.png`;
  const pairFiles=[beforeName,afterName,...(groupKey==='overlays'?['find-before','find-after'].map(s=>`ch04-overlays-${s}.png`):groupKey==='tab-completion'?['tab-before','tab-after','emmet-before','emmet-after'].map(s=>`ch10-tab-completion-${s}.png`):[])];
  const beforeSettings=structuredClone(plannedSettings);
  const afterSettings=deepMerge(structuredClone(beforeSettings),copyGroupSettings(currentSettings,spec.settings));
  plannedSettings=structuredClone(afterSettings);
  const rows=[];
  let advanced=false,failure;
  try{
    if(JSON.stringify(appliedSettings)!==JSON.stringify(beforeSettings)) await writeSettings(beforeSettings);
    if(spec.previewSettings) await writeTransientSettings(spec.previewSettings);
    await runInteraction(spec.interaction,'before',beforeSettings);
    const before=await measureGroup(groupKey,beforeName);
    const beforeRow=await capture(beforeName,chapter.chapter,groupKey,'Before the setting change, the same fixture state is staged.',groupKey==='operation-confirmations'?'operation-confirmation':groupKey==='recommendation-notifications'?'recommendation-toast':'none',true);
    rows.push(beforeRow);
    const extrasBefore=groupKey==='overlays'?[await captureExtra(chapter,groupKey,'find','before')]:groupKey==='tab-completion'?[await captureExtra(chapter,groupKey,'tab','before'),await captureExtra(chapter,groupKey,'emmet','before')]:[];
    rows.push(...extrasBefore.map(({row})=>row));
    if(groupKey!=='autosave') await resetInteraction(spec.interaction,'before');
    if(spec.previewSettings) await writeSettings(beforeSettings);
    await writeSettings(afterSettings);
    if(spec.settings.some(([key])=>key.startsWith('custom-ui-style.'))) await applyCustomUIStyleAndRestart();
    else if(spec.restart) await restartApp();
    advanced=true;
    if(spec.previewSettings) await writeTransientSettings(spec.previewSettings);
    await runInteraction(spec.interaction,'after',currentSettings);
    const after=await measureGroup(groupKey,afterName);
    const afterRow=await capture(afterName,chapter.chapter,groupKey,groupKey==='operation-confirmations'?'After the move, the file is in components without a confirmation dialog.':`After the setting change, ${spec.description||'the fixture shows the chapter style.'}`,'none',true);
    rows.push(afterRow);
    const extrasAfter=groupKey==='overlays'?[await captureExtra(chapter,groupKey,'find','after')]:groupKey==='tab-completion'?[await captureExtra(chapter,groupKey,'tab','after'),await captureExtra(chapter,groupKey,'emmet','after')]:[];
    rows.push(...extrasAfter.map(({row})=>row));
    await setPairDescription(groupKey,before,after,[beforeRow,afterRow]);
    for(let i=0;i<extrasBefore.length;i++){
      const kind=groupKey==='overlays'?'find':i?'emmet':'tab',a=extrasBefore[i],b=extrasAfter[i];
      const pixels=await compareEvidence(kind==='find'?'find-widget':groupKey,a.state,b.state);
      if(!pixels.changed) throw new Error(`${kind} target crop contains no changed pixels.`);
      if(kind==='find'){
        if(!a.state.metric.shadow||a.state.metric.shadow==='none'||b.state.metric.shadow!=='none'||a.state.metric.text!==b.state.metric.text) throw new Error('Find widget shadow or same-widget evidence failed.');
        a.row.description='Before chapter 4 overlay styles, the open Find widget has its default shadow.';
        b.row.description='After chapter 4 overlay styles, the same Find widget has no shadow.';
      }else{
        const beforeText=a.state.metric.editorText,afterText=b.state.metric.editorText;
        if(!beforeText.includes(kind==='tab'?'shotloop':'ul>li.item*3')||!afterText.includes(kind==='tab'?'for (const item of items)':'<li class="item">')) throw new Error(`${kind} expansion text did not match the staged buffer.`);
        a.row.description=kind==='tab'?'Before Tab completion is enabled, the editor shows the literal shotloop snippet prefix.':'Before Emmet Tab expansion is enabled, the editor shows ul>li.item*3.';
        b.row.description=kind==='tab'?'After Tab completion is enabled, the editor shows the expanded Sample loop snippet.':'After Emmet Tab expansion is enabled, the editor shows three li.item elements.';
      }
    }
    if(groupKey==='autosave'){
      beforeRow.description=`Before auto save, ${autosaveSentinel} is in the dirty buffer and absent from disk.`;
      afterRow.description=`After auto save, ${autosaveSentinel} is on disk and the dirty indicator cleared.`;
    }
    if(groupKey!=='autosave') await resetInteraction(spec.interaction,'after');
    if(spec.previewSettings) await writeSettings(afterSettings);
    if(groupKey==='recommendation-notifications') await rm(path.join(workspaceDir,'.vscode','extensions.json'),{force:true});
    await acceptCaptures(rows);
  }catch(error){
    if(error.code==='OWNER_RETURNED') throw error;
    failure=String(error.message||error).replace(/\s+/g,' ').trim();
    try{await resetInteraction(spec.interaction,'failed');}catch(cleanup){failure+=`; cleanup: ${cleanup.message}`;}
    if(!advanced){
      await writeSettings(afterSettings);
      if(spec.settings.some(([key])=>key.startsWith('custom-ui-style.'))) await applyCustomUIStyleAndRestart();
      else if(spec.restart) await restartApp();
      advanced=true;
    }
    if(spec.previewSettings) await writeSettings(afterSettings);
    if(groupKey==='recommendation-notifications') await rm(path.join(workspaceDir,'.vscode','extensions.json'),{force:true});
    const selected=new Set(pairFiles);
    for(let i=indexRows.length-1;i>=0;i--) if(selected.has(path.basename(indexRows[i].file))) indexRows.splice(i,1);
    const failedDir=path.join(outputDir,'failed');await mkdir(failedDir,{recursive:true});
    for(const name of pairFiles){
      const staged=`${path.join(imageDir,name)}.${process.pid}.capture.png`,image=path.join(imageDir,name),failed=path.join(failedDir,name);
      const source=await access(staged).then(()=>staged,()=>access(image).then(()=>image,()=>null));
      if(source){await rename(source,failed);indexRows.push({chapter:chapter.chapter,group:groupKey,file:path.relative(outputDir,failed),description:`failed: ${failure}`});}
    }
    failedPairs.push(`${chapter.chapter}-${groupKey}: ${failure}`);await persistIndex();
    console.error(`Failed pair ${chapter.chapter}-${groupKey}: ${failure}`);
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

const groupCount = chapters.reduce((count, chapter) => count + chapter.groups.length, 0);
if (groupCount !== 30) throw new Error(`Expected 30 visual groups; found ${groupCount}`);
for (const chapter of chapters) {
  const sourceSettings = readChapterSettings(chapter);
  for (const groupKey of chapter.groups) {
    const spec = groupSpecs[groupKey];
    if (!spec || spec.chapter !== chapter.chapter) throw new Error(`Group ${groupKey} is missing or assigned to the wrong chapter`);
    copyGroupSettings(sourceSettings, spec.settings);
  }
}

async function applyChapterSnapshot(settings) {
  await writeSettings(settings);
  if(installedExtensions.has(customUIStyleId)&&Object.keys(settings).some(key=>key.startsWith('custom-ui-style.'))) await applyCustomUIStyleAndRestart();
  else await restartApp();
  plannedSettings=structuredClone(settings);
}

try {
  logFrontmost('before the run');
  await startApp();
  await capture('00-zero.png',0,'zero','A fresh profile opens the fixed sample project with no user-installed extensions.');
  for(const chapter of chapters){
    await installRecommendations(chapter);
    await restartApp();
    const currentSettings=readChapterSettings(chapter);
    if(smokeMode){
      if(chapter.chapter<=2||chapter.chapter===4){await applyChapterSnapshot(currentSettings);continue;}
      if(chapter.chapter===3){await capturePair(chapter,'window-chrome',currentSettings);await applyChapterSnapshot(currentSettings);continue;}
      if(chapter.chapter===5){
        const cursor=groupSpecs['cursor-appearance'],next=deepMerge(structuredClone(plannedSettings),copyGroupSettings(currentSettings,cursor.settings));
        await writeSettings(next);await applyCustomUIStyleAndRestart();plannedSettings=structuredClone(next);
        await capturePair(chapter,'multi-cursor',currentSettings);
        break;
      }
      continue;
    }
    for(const groupKey of chapter.groups) await capturePair(chapter,groupKey,currentSettings);
    await applyChapterSnapshot(currentSettings);
    await windowControl.key('Escape','Escape');
    await open('src/main.ts');
    const checkpoint=`ch${String(chapter.chapter).padStart(2,'0')}-checkpoint.png`;
    await capture(checkpoint,chapter.chapter,'checkpoint',`After chapter ${chapter.chapter}, its cumulative settings are shown in the fixed sample project.`);
  }
} finally {
  await quitApp();
  await rm(profileDir,{recursive:true,force:true});
}

const expectedImageCount=smokeMode?5:78;
if(!failedPairs.length&&indexRows.length!==expectedImageCount) throw new Error(`Expected ${expectedImageCount} image-index rows; recorded ${indexRows.length}`);
for(const row of indexRows) await access(path.join(outputDir,row.file));
if(!smokeMode&&!failedPairs.length&&!indexRows.some(row=>row.file.endsWith('ch11-checkpoint.png'))) throw new Error('Full run did not record the chapter 11 checkpoint.');
await persistIndex();
console.log(`Captured ${indexRows.filter((row) => !row.description.startsWith('failed:')).length} PNGs; failed pairs: ${failedPairs.length}. Image index: ${indexPath}`);
if (failedPairs.length) { console.error(failedPairs.join('\n')); process.exitCode = 1; }
