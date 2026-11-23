import { readFileSync } from 'node:fs';
import { access, cp, mkdir, readFile, rm, writeFile, appendFile } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { VSCodeControl } from './cdp.mjs';
import { extensionPins, groupSpecs } from './groups.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const kitDir = path.resolve(here, '..');
const outputDir = path.join(kitDir, 'output');
const runtimeDir = path.join(outputDir, 'runtime');
const vscodeArchive = path.join(outputDir, 'vscode-1.101.1-darwin-arm64.zip');
const sourceDir = path.join(runtimeDir, 'sources');
const profileDir = path.join(runtimeDir, 'user-data');
const extensionsDir = path.join(runtimeDir, 'extensions');
const workspaceDir = path.join(runtimeDir, 'workspace');
const appPath = path.join(runtimeDir, 'Visual Studio Code.app');
const appExecutable = path.join(appPath, 'Contents', 'MacOS', 'Electron');
const cliPath = path.join(appPath, 'Contents', 'Resources', 'app', 'bin', 'code');
const finderSource = path.join(here, 'window-id.swift');
const finderBinary = path.join(runtimeDir, 'window-id');
const imageDir = path.join(outputDir, 'images');
const indexPath = path.join(outputDir, 'image-index.csv');
const devtoolsPort = 9237;
const windowSize = '1200,800';
const fixtureDir = path.join(kitDir, 'fixture');
const chapters = JSON.parse(await readFile(path.join(kitDir, 'manifest', 'chapters.json'), 'utf8'));

if (process.platform !== 'darwin') throw new Error('This screenshot route requires macOS.');
await mkdir(outputDir, { recursive: true });
await rm(runtimeDir, { recursive: true, force: true });
await mkdir(runtimeDir, { recursive: true });
await rm(imageDir, { recursive: true, force: true });
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
  await writeFile(userSettingsPath, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
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
    console.log(`Installing ${id}@${version} for chapter ${chapter.chapter}.`);
    execFileSync(cliPath, [
      '--user-data-dir', profileDir,
      '--extensions-dir', extensionsDir,
      '--install-extension', `${id}@${version}`,
      '--force',
    ], { stdio: 'inherit' });
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
    '--remote-debugging-port=' + devtoolsPort,
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

async function startApp() {
  if (appChild) return;
  const child = spawn(appExecutable, launchArgs(), { detached: true, stdio: 'ignore' });
  child.unref();
  appChild = true;
  await delay(2500);
  windowControl = new VSCodeControl(devtoolsPort);
  await windowControl.connect();
  await openFixedFiles();
  await windowControl.clearNotifications();
  await delay(800);
}

async function stopApp() {
  if (windowControl) {
    try { await windowControl.key('Q', 'KeyQ', 4); } catch {}
  }
  await delay(1200);
  windowControl?.close();
  windowControl = null;
  appChild = false;
}

async function restartApp() {
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
      windowControl = new VSCodeControl(devtoolsPort);
      await windowControl.connect();
      await openFixedFiles();
      await windowControl.clearNotifications();
      return;
    }
    try { await windowControl.key('Q', 'KeyQ', 4); } catch {}
  }
  windowControl?.close();
  windowControl = null;
  appChild = false;
  const deadline = Date.now() + 12_000;
  let portClosed = false;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${devtoolsPort}/json`);
      if (!response.ok) {
        portClosed = true;
        break;
      }
      await delay(250);
    } catch {
      portClosed = true;
      break;
    }
  }
  if (!portClosed) throw new Error('VS Code did not exit before restart.');
  await startApp();
  await windowControl.clearNotifications();
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
      await open('src/emmet.html');
      await goto(8, 1);
      await windowControl.key('End', 'End');
      await windowControl.key('Tab', 'Tab');
      await delay(700);
      break;
    case 'selected-suggestion':
      await open('src/suggestions.ts');
      await windowControl.key('ArrowDown', 'ArrowDown', 4);
      await windowControl.key('End', 'End');
      await windowControl.key('Space', 'Space', 2);
      await delay(900);
      break;
    case 'autosave':
      await open('src/autosave.ts');
      await windowControl.key('ArrowDown', 'ArrowDown', 4);
      await windowControl.key('End', 'End');
      await windowControl.type(' // edit');
      if (phase === 'after') await delay(1800);
      break;
    case 'delete-cancel':
    case 'recommendations':
      await open('src/main.ts');
      break;
    case 'save-diff':
      await open('src/changed.ts');
      await goto(1, 1);
      break;
    default:
      throw new Error(`Unknown UI interaction: ${name}`);
  }
}

async function resetInteraction(name) {
  if (!name) return;
  switch (name) {
    case 'automatic-suggestions':
      await windowControl.key('Escape', 'Escape');
      await windowControl.key('Backspace', 'Backspace');
      break;
    case 'tab-completion':
      await windowControl.key('Escape', 'Escape');
      await windowControl.key('Z', 'KeyZ', 4);
      break;
    case 'selected-suggestion':
    case 'find-widget':
    case 'overview-ruler-search':
    case 'hover':
      await windowControl.key('Escape', 'Escape');
      break;
    case 'multi-cursor':
      await windowControl.key('Escape', 'Escape');
      break;
    case 'autosave':
      await windowControl.key('Escape', 'Escape');
      await windowControl.key('Z', 'KeyZ', 4);
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

async function capture(name, chapter, group, description) {
  await windowControl.assertNoModalOrToast();
  const destination = imageFilename(name);
  const [windowId, width, height] = run(finderBinary, [appPath]).split(/\s+/);
  if (width !== '1200' || height !== '800') {
    throw new Error(`Expected a 1200x800 point window, found ${width}x${height}`);
  }
  execFileSync('screencapture', ['-x', '-l', windowId, destination], { stdio: 'inherit' });
  const dimensions = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', destination], { encoding: 'utf8' });
  if (!dimensions.includes('pixelWidth:') || !dimensions.includes('pixelHeight:')) throw new Error(`Unable to verify screenshot dimensions: ${destination}`);
  indexRows.push({ chapter, group, file: path.relative(outputDir, destination), description });
}

async function capturePair(chapter, groupKey, currentSettings) {
  const spec = groupSpecs[groupKey];
  const beforeName = `ch${String(chapter.chapter).padStart(2, '0')}-${groupKey}-before.png`;
  const afterName = `ch${String(chapter.chapter).padStart(2, '0')}-${groupKey}-after.png`;
  await runInteraction(spec.interaction, 'before', appliedSettings);
  await capture(beforeName, chapter.chapter, groupKey, `The sample project editor and Explorer show the cumulative state before ${groupKey} is applied.`);
  await resetInteraction(spec.interaction);

  const groupSettings = copyGroupSettings(currentSettings, spec.settings);
  const nextSettings = deepMerge(structuredClone(appliedSettings), groupSettings);
  await writeSettings(nextSettings);
  if (spec.restart) await restartApp();
  await runInteraction(spec.interaction, 'after', currentSettings);
  await capture(afterName, chapter.chapter, groupKey, `After ${groupKey} is applied, ${spec.description}`);
  await resetInteraction(spec.interaction);

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
  await startApp();
  await capture('00-zero.png', 0, 'zero', 'A fresh profile opens the fixed sample project with no user-installed extensions.');

  for (const chapter of chapters) {
    await installRecommendations(chapter);
    await restartApp();
    await windowControl.clearNotifications();

    const currentSettings = sourceSettingsFor(chapter);
    for (const groupKey of chapter.groups) {
      await capturePair(chapter, groupKey, currentSettings);
    }

    await writeSettings(currentSettings);
    await restartApp();
    await windowControl.key('Escape', 'Escape');
    await open('src/main.ts');
    await delay(600);
    const checkpointName = `ch${String(chapter.chapter).padStart(2, '0')}-checkpoint.png`;
    await capture(checkpointName, chapter.chapter, 'checkpoint', `After chapter ${chapter.chapter}, its cumulative settings are shown in the fixed sample project.`);
  }
} finally {
  await stopApp();
}

if (indexRows.length !== 72 || imageNames.size !== 72) {
  throw new Error(`Expected 72 screenshots; captured ${imageNames.size}`);
}
await writeFile(indexPath, [
  ['chapter', 'group', 'file', 'description'].map(csv).join(','),
  ...indexRows.map((row) => [row.chapter, row.group, row.file, row.description].map(csv).join(',')),
].join('\n') + '\n');
console.log(`Captured ${imageNames.size} PNGs. Image index: ${indexPath}`);
