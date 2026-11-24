import { readFileSync } from 'node:fs';
import { access, cp, mkdir, readFile, readdir, rename, rm, stat, writeFile, appendFile } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
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
const resumeChapter11Mode = process.argv.includes('--resume-chapter-11');
if ([smokeMode, autosaveOnlyMode, resumeChapter11Mode].filter(Boolean).length > 1) throw new Error('Capture modes cannot be combined.');
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
  console.log('Usage: node ./scripts/run.mjs [--smoke | --autosave-only | --resume-chapter-11]\nRebuilds the isolated VS Code profile and captures the 78-image screenshot set. --smoke captures only 00-zero and the chapter 1 theme pair under output/smoke/. --autosave-only reshoots the chapter 11 autosave pair for an existing full set. --resume-chapter-11 captures the remaining chapter 11 images after an interrupted full run. Run only while nobody is using the Mac.');
  process.exit(0);
}

if (process.platform !== 'darwin') throw new Error('This screenshot route requires macOS.');
assertOwnerAway('run start');
await mkdir(outputDir, { recursive: true });
if (autosaveOnlyMode) {
  const existingLines = (await readFile(indexPath, 'utf8')).trimEnd().split('\n');
  if (existingLines.length !== 79) throw new Error(`Expected an existing 78-image index before targeted capture; found ${existingLines.length - 1} rows.`);
}
if (resumeChapter11Mode) {
  const existingNames = new Set(await readdir(imageDir));
  const expectedMissing = new Set([
    'ch11-autosave-after.png',
    'ch11-recommendation-notifications-before.png',
    'ch11-recommendation-notifications-after.png',
    'ch11-checkpoint.png',
  ]);
  const requiredNames = new Set([
    '00-zero.png',
    ...chapters.flatMap((chapter) => [
      ...chapter.groups.flatMap((group) => ['before', 'after'].map((side) => `ch${String(chapter.chapter).padStart(2, '0')}-${group}-${side}.png`)),
      `ch${String(chapter.chapter).padStart(2, '0')}-checkpoint.png`,
    ]),
    ...['tab', 'emmet'].flatMap((state) => ['before', 'after'].map((side) => `ch10-tab-completion-${state}-${side}.png`)),
    ...['before', 'after'].map((side) => `ch04-overlays-find-${side}.png`),
  ]);
  const missing = new Set([...requiredNames].filter((name) => !existingNames.has(name)));
  const unexpected = [...existingNames].filter((name) => !requiredNames.has(name));
  const interruptedSet = existingNames.size === 74 && missing.size === expectedMissing.size
    && [...missing].every((name) => expectedMissing.has(name));
  const completeSet = existingNames.size === 78 && missing.size === 0;
  if ((!interruptedSet && !completeSet) || unexpected.length) {
    throw new Error(`Resume mode requires the 74-image interrupted set or a complete 78-image set; found ${existingNames.size} entries, missing ${[...missing].join(', ')}.`);
  }
}
await rm(runtimeDir, { recursive: true, force: true });
await mkdir(runtimeDir, { recursive: true });
await rm(profileDir, { recursive: true, force: true });
if (!autosaveOnlyMode && !resumeChapter11Mode) await rm(imageDir, { recursive: true, force: true });
if (!autosaveOnlyMode && !resumeChapter11Mode) await rm(indexPath, { force: true });
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
let autosaveSentinel;
let indentationSource;
const installedExtensions = new Set();
const indexRows = [];
const imageNames = new Set();

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
  const overrides = appliedSettings.workbench?.colorCustomizations || {};
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
  assertOwnerAway('VS Code restart');
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
      await assertThemeReady();
      if (clearNotifications) await windowControl.clearNotifications();
      return;
    }
  }
  await quitApp();
  await startApp({ clearNotifications });
  if (clearNotifications) await windowControl.clearNotifications();
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

function sourceSettingsFor(chapter) {
  return readChapterSettings(chapter);
}

async function open(file, line, column = 1) {
  const absolutePath = path.join(workspaceDir, file);
  const args = ['--user-data-dir', profileDir, '--extensions-dir', extensionsDir];
  args.push('--goto', `${absolutePath}:${line || 1}:${column}`);
  execFileSync(cliPath, args, { stdio: 'ignore', env: { ...process.env, VSCODE_IPC_HOOK_CLI: '' } });
  const processCommand = execFileSync('/bin/ps', ['-ww', '-p', String(appChild.pid), '-o', 'command='], { encoding: 'utf8' });
  if (!processCommand.includes(path.join(appPath, 'Contents', 'MacOS', 'Electron')) || !processCommand.includes(`--user-data-dir ${profileDir}`)) throw new Error('The VS Code CLI did not preserve the isolated kit process identity.');
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
  'operation-confirmations': '.explorer-folders-view', 'window-chrome': '.monaco-workbench', 'cursor-appearance': '.monaco-editor',
  'font-metrics': '.monaco-editor .view-lines', overlays: '.quick-input-widget', 'save-and-diff': '.monaco-editor',
  'automatic-suggestions': '.monaco-workbench', 'recommendation-notifications': '.monaco-workbench',
  'explorer-decorations': '.explorer-folders-view', 'title-spacing': '.editor-group-container>.title .title-label',
  'surface-boundaries': '.sidebar', 'multi-cursor': '.cursors-layer', 'cursor-colors': '.cursors-layer .cursor',
  'code-style': '.monaco-editor .view-lines', 'code-decorations': '.monaco-editor', 'editor-hints': '.monaco-editor',
  'line-numbers-and-indent': '.monaco-editor', 'folding-and-guides': '.monaco-editor', 'scrollbars-and-ruler': '.monaco-editor',
  'marker-colors': '.monaco-editor .decorationsOverviewRuler', 'tab-completion': '.suggest-widget',
  'selected-suggestion-color': '.suggest-widget .monaco-list-row.focused', 'sidebar-and-title': '.sidebar', 'find-widget': '.editor-widget.find-widget',
  autosave: '.editor-group-container>.title',
};

async function measureGroup(key) {
  const selector = evidenceTargets[key] || '.monaco-workbench';
  if (!selector) return null;
  const metric = await windowControl.evaluate(`(() => { const s=${JSON.stringify(selector)}, e=[...document.querySelectorAll(s)].find(n=>{const r=n.getBoundingClientRect();return r.width&&r.height}); if(!e) return null; const c=getComputedStyle(e),r=e.getBoundingClientRect(),sc=document.querySelector('.monaco-editor .monaco-scrollable-element'),row=[...document.querySelectorAll('.explorer-folders-view .monaco-list-row')].find(n=>n.innerText.includes('changed.ts')),focus=document.querySelector('.explorer-folders-view .monaco-list-row.focused'),fileTitle=document.querySelector('.title .monaco-icon-label.file-icon'),rows=[...document.querySelectorAll('.suggest-widget .monaco-list-row')],selected=rows.find(n=>n.matches('.focused,.selected,[aria-selected="true"]')),comment=[...document.querySelectorAll('.monaco-editor .view-line')].find(n=>n.innerText.includes('Sample comment')),ligature=[...document.querySelectorAll('.monaco-editor .view-line span')].find(n=>n.innerText.includes('=>')),range=document.createRange(),visible=(n)=>{const b=n?.getBoundingClientRect();return !!(b?.width&&b?.height)},sidebar=document.querySelector('.sidebar'),cursors=[...document.querySelectorAll('.cursors-layer .cursor')].filter(visible),chrome=['.part.activitybar','.part.statusbar','.tabs-container','.breadcrumbs-control','.minimap'].map(q=>[q,[...document.querySelectorAll(q)].some(visible)]),tree=[...document.querySelectorAll('.explorer-folders-view .monaco-list-row')].filter(visible).map(n=>{const icon=n.querySelector('.monaco-icon-label,.file-icon,.folder-icon'),b=n.getBoundingClientRect(),i=icon&&getComputedStyle(icon,'::before'),guides=[...n.querySelectorAll('.monaco-tl-indent .indent-guide')].map(g=>[g.getBoundingClientRect().x,getComputedStyle(g).borderLeftColor,getComputedStyle(g).backgroundColor]);return [n.innerText.trim(),b.x,getComputedStyle(n).paddingLeft,icon?.className,i?.backgroundImage,i?.content,guides]}),toast=[...document.querySelectorAll('.notifications-toasts .notification-toast')].filter(visible).map(n=>n.innerText),dialogs=[...document.querySelectorAll('.monaco-dialog-box,[aria-modal="true"]')].filter(visible).map(n=>n.innerText); if(e.firstChild){range.selectNodeContents(e)} return {text:e.innerText?.slice(0,180),x:r.x,y:r.y,textX:range.getBoundingClientRect().x,w:r.width,h:r.height,color:c.color,bg:c.backgroundColor,image:c.backgroundImage,pad:c.paddingLeft,margin:c.marginLeft,outline:c.outlineColor,shadow:c.boxShadow,display:c.display,opacity:c.opacity,font:getComputedStyle(document.querySelector('.monaco-editor .view-line span')||e).font,features:getComputedStyle(ligature||e).fontFeatureSettings,tab:getComputedStyle(document.querySelector('.monaco-editor .view-lines')||e).tabSize,dirty:document.querySelectorAll('.tab.dirty,.title .dirty').length,chrome,sidebarRect:sidebar&&visible(sidebar)?[sidebar.getBoundingClientRect().x,sidebar.getBoundingClientRect().y,sidebar.getBoundingClientRect().width]:null,tree,toast,dialogs,suggestVisible:visible(document.querySelector('.suggest-widget')),selectedSuggestion:selected?.innerText.trim(),cursorStyle:cursors.map(n=>{const s=getComputedStyle(n),b=n.getBoundingClientRect();return [s.color,s.backgroundColor,b.width,b.height,s.borderLeft]}),cursors:cursors.length,sliders:[...document.querySelectorAll('.monaco-editor .scrollbar .slider')].filter(visible).filter(n=>{const s=getComputedStyle(n);return s.display!=='none'&&s.opacity!=='0'}).length,scroll:[sc?.scrollTop,sc?.scrollHeight,sc?.clientHeight,sc?.scrollLeft,sc?.scrollWidth,sc?.clientWidth],squiggles:document.querySelectorAll('.monaco-editor .squiggly-error').length,badges:document.querySelectorAll('.explorer-folders-view .monaco-list-row .badge,.explorer-folders-view .monaco-list-row .monaco-count-badge').length,gitColor:row?getComputedStyle(row.querySelector('.label-name')||row).color:'',focus:focus?getComputedStyle(focus).outlineColor:'',justify:getComputedStyle(document.querySelector('.editor-group-container>.title')||e).justifyContent,decoration:getComputedStyle(document.querySelector('.monaco-editor .scroll-decoration')||e).display,sticky:document.querySelectorAll('.monaco-editor .sticky-widget').length,swatches:document.querySelectorAll('.monaco-editor .colorpicker-color').length,lightbulb:document.querySelectorAll('.monaco-editor .lightbulb-glyph,.monaco-editor .lightBulbWidget,.monaco-editor .codicon-lightbulb,.monaco-editor .codicon-lightbulb-autofix').length,signature:document.querySelectorAll('.parameter-hints-widget').length,folding:document.querySelectorAll('.monaco-editor .codicon-folding-expanded,.monaco-editor .codicon-folding-collapsed').length,comment:comment?['fontStyle','fontFeatureSettings','color'].map(k=>getComputedStyle(comment.querySelector('span')||comment)[k]):[],sidebar:getComputedStyle(sidebar||e).backgroundColor,title:getComputedStyle(fileTitle||e).marginLeft,rows:rows.map(n=>n.innerText.trim()),snippets:rows.filter(n=>n.querySelector('.codicon-symbol-snippet')).map(n=>n.innerText.trim())}; })()`);
  if (!metric) throw new Error(`No visible DOM target for ${key}: ${selector}`);
  if (key === 'line-numbers-and-indent') metric.indent = await windowControl.evaluate(`(() => { const line=(s)=>[...document.querySelectorAll('.monaco-editor .view-line')].find(n=>n.innerText.includes(s)), nested=[...document.querySelectorAll('.monaco-editor .view-line')].find(n=>n.innerText.includes('return')&&n.innerText.includes('heading')), ink=(n)=>{if(!n)return null;const w=document.createTreeWalker(n,NodeFilter.SHOW_TEXT);while(w.nextNode()){const i=w.currentNode.textContent.search(/\S/);if(i>=0){const r=document.createRange();r.setStart(w.currentNode,i);r.setEnd(w.currentNode,i+1);const b=r.getBoundingClientRect();return {x:b.x,width:b.width};}}return null;},base=ink(line('export function')),one=ink(line('const heading')),three=ink(nested); return [one,three].map(p=>base&&p?Math.round((p.x-base.x)/base.width):null); })()`);
  return { metric, pixels: await windowControl.capturePixels(selector, key === 'find-widget' ? 16 : 2) };
}

function setPairDescription(group, before, after, rows) {
  const pixelsChanged = before && after && before.pixels !== after.pixels;
  const domChanged = before && after && JSON.stringify(before.metric) !== JSON.stringify(after.metric);
  if (!pixelsChanged || !domChanged) throw new Error(`${group} showed no measured DOM and pixel change in its target UI crop.`);
  if (group === 'multi-cursor' && (before.metric.cursors !== 3 || after.metric.cursors !== 1)) throw new Error(`Option-click cursor count did not change from 3 to 1: ${before.metric.cursors} -> ${after.metric.cursors}.`);
  if (group === 'cursor-colors' && JSON.stringify(before.metric.cursorStyle) === JSON.stringify(after.metric.cursorStyle)) throw new Error('Focused block cursor colors did not change.');
  if (group === 'code-style' && before.metric.features === after.metric.features && JSON.stringify(before.metric.comment) === JSON.stringify(after.metric.comment)) throw new Error('Ligature or comment token styling did not change.');
  if (group === 'selected-suggestion-color' && (!before.metric.selectedSuggestion || before.metric.selectedSuggestion !== after.metric.selectedSuggestion || before.metric.bg === after.metric.bg)) throw new Error('The same selected completion did not receive the chapter background color.');
  if (group === 'operation-confirmations' && JSON.stringify(before.metric.tree) === JSON.stringify(after.metric.tree)) throw new Error('The staged Explorer move did not change the target tree.');
  if (group === 'title-spacing' && (before.metric.pad !== '20px' || after.metric.pad !== '60px' || after.metric.textX <= before.metric.textX)) throw new Error(`Title spacing evidence failed: ${JSON.stringify([before.metric, after.metric])}`);
  if (group === 'sidebar-and-title' && (before.metric.sidebar !== 'rgb(20, 17, 27)' || after.metric.sidebar !== 'rgb(25, 21, 33)' || before.metric.title === after.metric.title)) throw new Error(`Sidebar/title evidence failed: ${JSON.stringify([before.metric, after.metric])}`);
  if (group === 'surface-boundaries' && before.metric.focus === after.metric.focus && before.metric.justify === after.metric.justify && before.metric.decoration === after.metric.decoration) throw new Error('Focused Explorer outline, title geometry, and editor surface decoration were unchanged.');
  if (group === 'scrollbars-and-ruler' && (before.metric.sliders < 2 || after.metric.sliders || before.metric.scroll[0] <= 0 || before.metric.scroll[3] <= 0 || before.metric.scroll[0] !== after.metric.scroll[0] || before.metric.scroll[3] !== after.metric.scroll[3] || before.metric.scroll[1] <= before.metric.scroll[2] || before.metric.scroll[4] <= before.metric.scroll[5])) throw new Error(`Editor scrollbar evidence failed: ${JSON.stringify([before.metric, after.metric])}`);
  if (group === 'marker-colors' && (!before.metric.squiggles || !after.metric.squiggles || !pixelsChanged)) throw new Error('Diagnostic underline or overview-ruler pixel evidence is missing.');
  if (group === 'tab-completion') {
    const rank = (state) => [state.metric.rows.findIndex((row) => state.metric.snippets.includes(row)), state.metric.rows.findIndex((row) => !state.metric.snippets.includes(row))];
    const a = rank(before), b = rank(after);
    if (before.metric.snippets.length < 2 || after.metric.snippets.length < 2 || a[0] < a[1] || b[0] > b[1]) throw new Error(`Snippet ranking did not move above word completions: ${JSON.stringify([a, b])}`);
  }
  if (group === 'code-decorations' && (!before.metric.sticky || after.metric.sticky || !before.metric.text.includes('#9b87f5'))) throw new Error('Nested sticky header or color literal was not staged.');
  if (group === 'editor-hints' && (!before.metric.signature || !before.metric.lightbulb || after.metric.signature || after.metric.lightbulb)) throw new Error('Signature help and code-action lightbulb did not change with their settings.');
  if (group === 'code-decorations' && (!before.metric.swatches || after.metric.swatches)) throw new Error('The nested-block color decorator did not change with its setting.');
  if (group === 'line-numbers-and-indent' && (before.metric.tab !== '4' || after.metric.tab !== '2' || before.metric.indent.join(',') !== '4,12' || after.metric.indent.join(',') !== '2,6')) throw new Error(`Tab-width geometry failed: ${JSON.stringify([before.metric.tab, before.metric.indent, after.metric.tab, after.metric.indent])}`);
  if (group === 'autosave' && (before.metric.dirty < 1 || after.metric.dirty !== 0)) throw new Error(`Autosave dirty indicator did not clear: ${before.metric.dirty} -> ${after.metric.dirty}`);
  if (group === 'minimal-chrome' && JSON.stringify(before.metric.chrome) === JSON.stringify(after.metric.chrome)) throw new Error('Status bar, tabs, breadcrumbs, and minimap visibility did not change.');
  if (group === 'editor-aids' && JSON.stringify(before.metric.chrome.filter(([target]) => target.includes('breadcrumbs') || target.includes('minimap'))) === JSON.stringify(after.metric.chrome.filter(([target]) => target.includes('breadcrumbs') || target.includes('minimap')))) throw new Error('Breadcrumb or minimap visibility did not change.');
  if (group === 'sidebar-placement' && before.metric.sidebarRect?.[0] === after.metric.sidebarRect?.[0]) throw new Error('Explorer sidebar did not change sides.');
  if (['explorer-icons', 'tree-layout'].includes(group) && JSON.stringify(before.metric.tree) === JSON.stringify(after.metric.tree)) throw new Error(`${group} Explorer tree DOM did not change.`);
  if (group === 'cursor-appearance' && JSON.stringify(before.metric.cursorStyle) === JSON.stringify(after.metric.cursorStyle)) throw new Error('Editor cursor shape or color did not change.');
  if (group === 'automatic-suggestions' && (!before.metric.suggestVisible || after.metric.suggestVisible)) throw new Error('Automatic suggestion widget visibility did not change.');
  if (group === 'recommendation-notifications' && (!before.metric.toast.some((text) => /recommend/i.test(text)) || after.metric.toast.length)) throw new Error('Recommendation notification did not differ before and after.');
  if (group === 'folding-and-guides' && !before.metric.folding) throw new Error('Folding controls were not visible in the gutter state.');
  for (const row of rows) row.description = `${row.chapter === 0 ? 'The zero state' : row.file.endsWith('before.png') ? 'Before' : 'After'} ${group} is applied, ${groupSpecs[group].description}`;
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
        const prefix = fixtureLine('src/snippet-suggestions.ts', 'sam', true);
        await goto(prefix.line, prefix.column + 'sam'.length);
      }
      await windowControl.key('Space', 'Space', 2);
      await delay(500);
      {
        const suggestionState = await windowControl.evaluate(`(() => { const widget=document.querySelector('.suggest-widget'),rows=[...document.querySelectorAll('.suggest-widget .monaco-list-row')].map(row=>({text:row.innerText,snippet:!!row.querySelector('.codicon-symbol-snippet')})); return {visible:!!widget?.getBoundingClientRect().height,rows}; })()`);
        if (!suggestionState.visible || !['Sample loop', 'Sample card'].every((label) => suggestionState.rows.some((row) => row.snippet && row.text.includes(label))) || !suggestionState.rows.some((row) => !row.snippet)) {
          throw new Error(`The snippet suggestion example did not open with the fixture snippets: ${JSON.stringify(suggestionState)}`);
        }
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
      await windowControl.waitFor("!!document.querySelector('.suggest-widget')?.getBoundingClientRect().height");
      await windowControl.key('ArrowDown', 'ArrowDown');
      await delay(500);
      const selectedSuggestion = await windowControl.evaluate("!!document.querySelector('.suggest-widget .monaco-list-row.focused, .suggest-widget .monaco-list-row.selected, .suggest-widget .monaco-list-row[aria-selected=\"true\"]')");
      if (!selectedSuggestion) throw new Error('The completion widget has no visibly selected item.');
      break;
    case 'autosave':
      if (phase === 'before') {
        await open('src/autosave.ts');
        const target = fixtureLine('src/autosave.ts', 'const trim = "base";', true);
        autosaveSentinel = `vss-autosave-${Date.now()}`;
        if ((await readFile(path.join(workspaceDir, 'src', 'autosave.ts'), 'utf8')).includes(autosaveSentinel)) throw new Error('Autosave sentinel already exists on disk.');
        await goto(target.line, target.text.length + 1);
        await windowControl.type(` // ${autosaveSentinel}`);
        if (!await windowControl.evaluate("!!document.querySelector('.tab.dirty, .title .dirty')")) throw new Error('Autosave before state is not dirty.');
      }
      if (phase === 'after') {
        const editedFile = path.join(workspaceDir, 'src', 'autosave.ts');
        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
          const state = await windowControl.notificationState();
          if (state.toasts.length) throw new Error(`Autosave surfaced a notification: ${JSON.stringify(state)}`);
          if ((await readFile(editedFile, 'utf8')).includes(autosaveSentinel) && !await windowControl.evaluate("!!document.querySelector('.tab.dirty, .title .dirty')")) return true;
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
      if (phase === 'before') await windowControl.assertExpectedOperationConfirmation();
      else {
        if ((await readFile(movedFile).catch(() => Buffer.alloc(0))).compare(original) !== 0 || await access(file).then(() => true, () => false)) throw new Error('Explorer drop did not move the exact fixture file.');
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
      const target = fixtureLine('src/code-style.ts', 'const f = x => x;');
      await goto(target.line, target.text.indexOf('=>') + 2);
      break;
    }
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
      await windowControl.assertNoModalOrToast();
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
      break;
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
  const interaction = kind === 'find' ? 'find-widget' : `${kind}-expansion`, selector = kind === 'find' ? 'find-widget' : '.monaco-editor .view-lines';
  await runInteraction(interaction, phase, appliedSettings);
  const state = await measureGroup(selector), name = `ch${String(chapter.chapter).padStart(2, '0')}-${group}-${kind}-${phase}.png`;
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
  const spec = groupSpecs[groupKey];
  const beforeName = `ch${String(chapter.chapter).padStart(2, '0')}-${groupKey}-before.png`;
  const afterName = `ch${String(chapter.chapter).padStart(2, '0')}-${groupKey}-after.png`;
  if (spec.previewSettings) await writeTransientSettings(spec.previewSettings);
  await runInteraction(spec.interaction, 'before', appliedSettings);
  const before = await measureGroup(groupKey), beforeText = groupKey === 'operation-confirmations' ? 'Before moving delete-me.txt, VS Code shows its Explorer confirmation.' : `Before ${groupKey}, the staged fixture state is visible.`;
  const beforeRow = await capture(beforeName, chapter.chapter, groupKey, beforeText, groupKey === 'operation-confirmations' ? 'operation-confirmation' : groupKey === 'recommendation-notifications' ? 'recommendation-toast' : 'none', true);
  const extrasBefore = groupKey === 'overlays' ? [await captureExtra(chapter, groupKey, 'find', 'before')] : groupKey === 'tab-completion' ? [await captureExtra(chapter, groupKey, 'tab', 'before'), await captureExtra(chapter, groupKey, 'emmet', 'before')] : [];
  if (groupKey !== 'autosave') await resetInteraction(spec.interaction, 'before');
  if (spec.previewSettings) await writeSettings(appliedSettings);

  const groupSettings = copyGroupSettings(currentSettings, spec.settings);
  const nextSettings = deepMerge(structuredClone(appliedSettings), groupSettings);
  await writeSettings(nextSettings);
  if (spec.settings.some(([first]) => first.startsWith('custom-ui-style.'))) {
    await applyCustomUIStyleAndRestart();
  } else if (spec.restart) await restartApp();
  if (spec.previewSettings) await writeTransientSettings(spec.previewSettings);
  await runInteraction(spec.interaction, 'after', currentSettings);
  const after = await measureGroup(groupKey), afterText = groupKey === 'operation-confirmations' ? 'After the setting is applied, the fixture file moves without a confirmation.' : `After ${groupKey} is applied, ${spec.description}`;
  const afterRow = await capture(afterName, chapter.chapter, groupKey, afterText, 'none', true);
  const extrasAfter = groupKey === 'overlays' ? [await captureExtra(chapter, groupKey, 'find', 'after')] : groupKey === 'tab-completion' ? [await captureExtra(chapter, groupKey, 'tab', 'after'), await captureExtra(chapter, groupKey, 'emmet', 'after')] : [];
  if (before && after) setPairDescription(groupKey, before, after, [beforeRow, afterRow]);
  for (let i = 0; i < extrasBefore.length; i++) {
    const kind = groupKey === 'overlays' ? 'find' : i ? 'emmet' : 'tab', a = extrasBefore[i], b = extrasAfter[i];
    if (kind === 'find') {
      if (a.state.metric.shadow === 'none' || b.state.metric.shadow !== 'none' || a.state.metric.x !== b.state.metric.x || a.state.metric.y !== b.state.metric.y || a.state.metric.text !== b.state.metric.text || a.state.pixels === b.state.pixels) throw new Error('Find widget shadow or same-state evidence failed.');
      a.row.description = 'Before chapter 4 overlay styles, the open Find widget has its default shadow.'; b.row.description = 'After chapter 4 overlay styles, the same Find widget has no shadow.';
    } else {
      if (!a.state.metric.text.includes(kind === 'tab' ? 'shotloop' : 'ul>li.item*3') || !b.state.metric.text.includes(kind === 'tab' ? 'for (const item of items)' : '<li') || a.state.pixels === b.state.pixels) throw new Error(`${kind} expansion DOM or target-crop pixels did not change.`);
      a.row.description = kind === 'tab' ? 'Before Tab completion is enabled, the editor shows the literal shotloop snippet prefix.' : 'Before Emmet Tab expansion is enabled, the editor shows ul>li.item*3.';
      b.row.description = kind === 'tab' ? 'After Tab completion is enabled, the editor shows the expanded Sample loop snippet.' : 'After Emmet Tab expansion is enabled, the editor shows three li.item elements.';
    }
  }
  if (groupKey === 'autosave') { beforeRow.description = `Before auto save, ${autosaveSentinel} is in the dirty buffer and absent from disk.`; afterRow.description = `After auto save, ${autosaveSentinel} is on disk and the dirty indicator cleared.`; }
  await acceptCaptures([beforeRow, ...extrasBefore.map(({ row }) => row), afterRow, ...extrasAfter.map(({ row }) => row)]);
  if (groupKey !== 'autosave') await resetInteraction(spec.interaction, 'after');
  if (spec.previewSettings) await writeSettings(appliedSettings);

  if (groupKey === 'recommendation-notifications') {
    await rm(path.join(workspaceDir, '.vscode', 'extensions.json'), { force: true });
  }

  return appliedSettings;
}

function csv(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function rowLine(row) { return [row.chapter, row.group, row.file, row.description].map(csv).join(','); }

async function persistIndex() {
  const header = ['chapter', 'group', 'file', 'description'].map(csv).join(','), updates = new Map(indexRows.map((row) => [row.file, rowLine(row)]));
  const prior = autosaveOnlyMode || resumeChapter11Mode ? (await readFile(indexPath, 'utf8')).trimEnd().split('\n') : [header];
  const lines = [header, ...prior.slice(1).filter((line) => ![...updates.keys()].some((file) => line.includes(csv(file)))), ...updates.values()];
  await writeFile(indexPath, lines.join('\n') + '\n');
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
  logFrontmost('before the run');
  await startApp();
  if (autosaveOnlyMode || resumeChapter11Mode) {
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
      if (resumeChapter11Mode) {
        await capturePair(chapter, 'recommendation-notifications', currentSettings);
        await writeSettings(currentSettings);
        await restartApp();
        await windowControl.key('Escape', 'Escape');
        await open('src/main.ts');
        await delay(600);
        const checkpointName = `ch${String(chapter.chapter).padStart(2, '0')}-checkpoint.png`;
        await capture(checkpointName, chapter.chapter, 'checkpoint', `After chapter ${chapter.chapter}, its cumulative settings are shown in the fixed sample project.`);
      }
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

const expectedImageCount = smokeMode ? 3 : autosaveOnlyMode ? 2 : resumeChapter11Mode ? 5 : 78;
if (indexRows.length !== expectedImageCount || imageNames.size !== expectedImageCount) {
  throw new Error(`Expected ${expectedImageCount} screenshots; captured ${imageNames.size}`);
}
if (autosaveOnlyMode) {
  const existingLines = (await readFile(indexPath, 'utf8')).trimEnd().split('\n');
  if (existingLines.length !== 79) throw new Error(`Expected an existing 78-image index before targeted capture; found ${existingLines.length - 1} rows.`);
  await persistIndex();
} else if (resumeChapter11Mode) {
  const lines = (await readFile(indexPath, 'utf8')).trimEnd().split('\n');
  if (lines.length !== 79) throw new Error(`Resume index contains ${lines.length - 1} rows, expected 78.`);
} else {
  await writeFile(indexPath, [
    ['chapter', 'group', 'file', 'description'].map(csv).join(','),
    ...indexRows.map(rowLine),
  ].join('\n') + '\n');
}
console.log(`Captured ${imageNames.size} PNGs. Image index: ${indexPath}`);
