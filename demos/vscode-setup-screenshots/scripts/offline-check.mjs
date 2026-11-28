import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSearchFieldSelector, paintedMatch } from './cdp.mjs';
import { completionIdentity, pairFailureMessage, selectionCopyPass, tabCompletionPass } from './completion.mjs';
import { explorerDecorationsPass, failedPairIndexRows, titleSpacingPass } from './pair-evidence.mjs';
import { groupSpecs } from './groups.mjs';
import { addPairRequirements, buildChronologicalPlan, createPairRegistry, findShadowPixelsPass, findShadowRegions, parseRunArgs, selectPlan } from './planner.mjs';
const kit = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runSource = readFileSync(path.join(kit, 'scripts/run.mjs'), 'utf8');
const installerSource = readFileSync(path.join(kit, 'scripts/install-extension.mjs'), 'utf8');
const extensionSource = readFileSync(path.join(kit, 'scripts/ranking-diagnostic-extension.js'), 'utf8');
let focusedChecks = 0;
function focusedCheck(condition, label) { assert.ok(condition, label); focusedChecks += 1; }
const rendererCall = /(?:windowControl|this)\.(?:evaluate|waitFor)\(\s*(\`(?:\\.|[^\`])*\`|'(?:\\.|[^'])*'|"(?:\\.|[^"])*")/gs;
for (const file of ['run.mjs', 'cdp.mjs']) for (const [, raw] of readFileSync(path.join(kit, 'scripts', file), 'utf8').matchAll(rendererCall)) {
  const expression = new Function(`return ${raw[0] === '`' ? raw.replace(/\$\{[^{}]*\}/g, 'null') : raw}`)();
  assert.doesNotThrow(() => new Function(`return (${expression})`), `${file} renderer expression`);
}
const chapters = JSON.parse(readFileSync(path.join(kit, 'manifest/chapters.json'), 'utf8'));
const registry = createPairRegistry(chapters, groupSpecs);
assert.equal(registry.length, 33); assert.equal(1 + chapters.length + registry.length * 2, 78);
const requested = ['ch05-cursor-colors', 'ch10-tab-completion', 'ch10-selected-suggestion-color',
  'ch11-sidebar-and-title', 'ch10-tab-expansion', 'ch10-emmet-expansion', 'ch04-overlays-find'];
assert(requested.every((name) => registry.some((pair) => pair.canonical === name)));
assert(['ch10-tab-completion-tab', 'ch10-tab-completion-emmet', 'ch04-overlays-find']
  .every((name) => registry.some((pair) => pair.filename === name)));
function assign(target, parts, value) {
  const node = parts.slice(0, -1).reduce((cursor, part) => (cursor[part] ||= {}), target);
  node[parts.at(-1)] = value;
}
const snapshots = Object.fromEntries(chapters.map((chapter) => {
  const settings = { ungroupedMarker: `chapter-${chapter.chapter}` };
  for (const group of chapter.groups) for (const parts of groupSpecs[group].settings) {
    const value = group === 'tab-completion' && parts[0] === 'editor.tabCompletion' ? 'on'
      : group === 'tab-completion' && parts[0] === 'editor.snippetSuggestions' ? 'top'
        : group === 'tab-completion' ? true : group === 'automatic-suggestions' ? false
          : parts.at(-1) === 'editorSuggestWidget.selectedBackground' ? '#3A334B'
            : `${chapter.chapter}:${group}:${parts.join('.')}`;
    assign(settings, parts, value);
  }
  return [chapter.chapter, settings];
}));
const recommendations = Object.fromEntries(chapters.map(({ chapter }) => [chapter, chapter <= 4 ? ['publisher.base'] : ['publisher.later']]));
const pins = new Map([['publisher.base', '1.0.0'], ['publisher.later', '2.0.0']]);
const full = addPairRequirements(buildChronologicalPlan(chapters, snapshots, groupSpecs, registry), chapters, recommendations, pins);
const selected = selectPlan(full, parseRunArgs(['--only', requested.slice().reverse().join(',')], registry).only);
const chronological = [...requested].sort((a, b) => full.findIndex((pair) => pair.canonical === a) - full.findIndex((pair) => pair.canonical === b));
assert.deepEqual(selected.map((pair) => pair.canonical), chronological);
assert(selected.every((pair) => full.includes(pair)));
const tab = full.find((pair) => pair.canonical === 'ch10-tab-completion'); const emmet = selectPlan(full, new Set(['ch10-emmet-expansion']))[0];
assert.deepEqual([emmet.before, emmet.after, emmet.requiredExtensions], [tab.before, tab.after, tab.requiredExtensions]);
assert(Object.isFrozen(tab.before) && Object.isFrozen(tab.after));
const selectedColor = full.find((pair) => pair.canonical === 'ch10-selected-suggestion-color'); const beforeColor = selectedColor.before;
assert.deepEqual([beforeColor['editor.tabCompletion'], beforeColor['editor.snippetSuggestions'], beforeColor['editor.suggestOnTriggerCharacters']], ['on', 'top', false]);
const selectedBg = (settings) => settings['workbench.colorCustomizations']?.['[Aura Dracula Spirit (Soft)]']?.['editorSuggestWidget.selectedBackground'];
assert.deepEqual([selectedBg(beforeColor), selectedBg(selectedColor.after)], [undefined, '#3A334B']);
assert.equal(full.find((pair) => pair.canonical === 'ch02-sidebar-placement').before.ungroupedMarker, 'chapter-1');
const findPair = full.find((pair) => pair.canonical === 'ch04-overlays-find'); assert.deepEqual(findPair.requiredExtensions, [{ id: 'publisher.base', version: '1.0.0' }]);
const reordered = selectPlan(full, parseRunArgs(['--only', 'ch11-sidebar-and-title,ch04-overlays-find'], registry).only);
assert.deepEqual(reordered.map((pair) => pair.canonical), ['ch04-overlays-find', 'ch11-sidebar-and-title']);
for (const args of [
  ['--only', 'unknown-pair'], ['--only', 'ch04-overlays-find,'],
  ['--only', 'ch04-overlays-find,ch04-overlays-find'], ['--smoke', '--only', 'ch04-overlays-find'],
]) assert.throws(() => parseRunArgs(args, registry));
const viewport = { width: 1200, height: 800 }, widget = { left: 100, top: 20, right: 400, bottom: 50, width: 300, height: 30 };
const regions = findShadowRegions(widget, 'rgb(15, 15, 15) 0px 0px 8px 2px', viewport);
assert(regions.shadow.top >= widget.bottom && regions.shadow.left > widget.left && regions.shadow.right < widget.right);
assert(regions.control.top >= regions.shadow.bottom && regions.control.left > 60);
assert(findShadowPixelsPass([{ x: 200, y: regions.shadow.top + 1 }], regions, false));
assert(!findShadowPixelsPass([{ x: 200, y: widget.bottom - 1 }], regions, false));
assert(!findShadowPixelsPass([{ x: 20, y: regions.shadow.top + 1 }], regions, false));
assert(!findShadowPixelsPass([{ x: 200, y: regions.shadow.top + 1 }], regions, true));
const visible = { display: 'block', visibility: 'visible', opacity: 1, rects: [{ left: 5, top: 5, right: 20, bottom: 20, width: 15, height: 15 }], viewport };
const hidden = { ...visible, display: 'none' }; assert(paintedMatch([hidden, visible]));
assert(!paintedMatch([hidden]) && !paintedMatch([{ ...visible, opacity: 0 }]));
assert(!paintedMatch([{ ...visible, rects: [{ left: 1201, top: 5, right: 1220, bottom: 20, width: 19, height: 15 }] }]));
const savedSamRows = [
  { displayLabel: 'sam', detail: 'sam\nSample card', snippet: true, kind: 'codicon-symbol-snippet' },
  { displayLabel: 'sam', detail: 'sam\nSample loop', snippet: true, kind: 'codicon-symbol-snippet' },
].map((row) => ({ ...row, snippetName: row.detail.split('\n').at(-1) }));
const ordinary = { displayLabel: 'sampleNames', detail: '', snippet: false, kind: 'codicon-symbol-constant' };
const beforeRows = { suggestWidgetCount: 1, rows: [ordinary, ...savedSamRows] };
const afterRows = { suggestWidgetCount: 1, rows: [savedSamRows[1], savedSamRows[0], ordinary] };
const snippetName = { ...ordinary, snippet: true, snippetName: 'sampleNames' };
const sentinel = 'vss-selection-sentinel';
const rankFailures = [
  [{ ...beforeRows, rows: [...beforeRows.rows, ordinary] }, { ...afterRows, rows: [...afterRows.rows, ordinary] }],
  [beforeRows, { ...afterRows, rows: afterRows.rows.filter((row) => row !== ordinary) }],
  [{ ...beforeRows, rows: [snippetName, ...savedSamRows] }, { ...afterRows, rows: [snippetName, ...savedSamRows] }],
  [beforeRows, { ...afterRows, rows: [{ ...savedSamRows[1], kind: 'function' }, savedSamRows[0], ordinary] }],
  [beforeRows, beforeRows], [{ ...beforeRows, suggestWidgetCount: 2 }, afterRows],
];
const includes = (source, ...needles) => needles.every((needle) => source.includes(needle));
const copied = (text, focused = true, painted = true) => selectionCopyPass({ focused, painted, clipboard: text, sentinel, expected: 'items' });
const badCopies = [sentinel, '', 'for (const item of items) {', 'item'].every((text) => !copied(text));
const rankingCheck = completionIdentity(savedSamRows[0]) === 'snippet:codicon-symbol-snippet:Sample card'
  && tabCompletionPass(beforeRows, afterRows) && rankFailures.every(([a, b]) => !tabCompletionPass(a, b));
const selectionCheck = copied('items') && badCopies && !copied('items', true, false) && !copied('items', false);
const findCheck = findSearchFieldSelector === '.editor-widget.find-widget .find-part textarea.input'
  && includes(runSource, 'waitForPainted(findSearchFieldSelector)', 'document.activeElement===document.querySelector(${searchField})',
    "await windowControl.key('A', 'KeyA', 4)", 'fieldFocused:document.activeElement===findInput', 'fieldVisible:visible(findInput)', 'vss-find-no-match-9zq')
  && !runSource.includes('.editor-widget.find-widget input');
const diagnosticCheck = includes(runSource, "selectedPlan[0].canonical === 'ch10-tab-completion'", '--extensionDevelopmentPath=')
  && (extensionSource.match(/executeCompletionItemProvider/g) || []).length === 1
  && includes(extensionSource, "status: 'error'", "status: items.length ? 'items' : 'empty'",
    'config.inspect(name)', "getExtension('vscode.typescript-language-features')")
  && !runSource.includes('extension.provider.items');
const logCheck = includes(runSource, "runtimeSettings['typescript.tsserver.log'] = 'verbose'", "nextSettings['typescript.tsserver.log'] = 'verbose'")
  && runSource.indexOf('await preserveRankingArtifacts()') < runSource.indexOf('await rm(profileDir,{recursive:true,force:true})');
const styleCheck = includes(runSource, 'await startApp();\n    if (installedExtensions.has(customUIStyleId)) await applyCustomUIStyleAndRestart();',
  'appliedStyleWitness', 'nativeWindow: { id: windowId, x, y, width, height }');
const viewportCheck = !includes(runSource, 'targetHeight', 'Browser.setWindowBounds')
  && includes(runSource, 'before.viewport.width !== after.viewport.width', 'before.viewport.height !== after.viewport.height');
const failureCheck = runSource.indexOf('await writeFile(failurePath') < runSource.indexOf("await attempt('cleanup'")
  && pairFailureMessage('primary', ['cleanup failed', 'restore failed']) === 'primary; secondary: cleanup failed; secondary: restore failed'
  && runSource.includes("attempt('settings restoration'");
const profileCleanupCheck = includes(runSource, "process.once('exit'", 'rmSync(profileDir', 'await rm(profileDir,{recursive:true,force:true})')
  && includes(installerSource, "await mkdtemp(path.join(os.tmpdir(), 'vss-vsix-'))", 'finally {', 'await rm(stagingDir, { recursive: true, force: true })');
const cacheLifetimeCheck = includes(runSource, "const marketplaceCacheDir = path.join(outputRoot, 'marketplace-cache')", "await rm(runtimeDir, { recursive: true, force: true })");
const failureIndexWiringCheck = includes(runSource, "let indexedFile = '';", 'failedFiles.push(indexedFile)', 'indexRows.push(...failedPairIndexRows(descriptor, failedFiles, message))', 'if (row.file) await access(path.join(outputDir,row.file))');
const titleSpacingWiringCheck = includes(runSource, 'titleSpacingPass(a,b)', 'a.padding,b.padding,a.textX,b.textX');
const sourceChecks = [
  [rankingCheck, 'ranking positive/negative'], [selectionCheck, 'selection copy and paint/focus'],
  [findCheck, 'shared Find locator and gates'], [diagnosticCheck, 'diagnostic scope and no pass route'],
  [logCheck, 'verbose logs preserved before cleanup'], [styleCheck, 'style reload and geometry evidence'],
  [viewportCheck, 'resize removed; viewport gate retained'], [failureCheck, 'primary first; restoration secondary'],
  [profileCleanupCheck, 'temporary profile and installer staging cleanup'], [cacheLifetimeCheck, 'Marketplace cache survives runtime recreation'],
  [failureIndexWiringCheck, 'empty failed-pair rows wired into the full index'],
  [titleSpacingWiringCheck, 'title-spacing gate uses captured padding metric'],
];
for (const [pass, label] of sourceChecks) focusedCheck(pass, label);
const decorationBefore = { gitColor: '#f00', badges: true };
focusedCheck(!explorerDecorationsPass(decorationBefore, { gitColor: '#0f0', badges: true }), 'Explorer Git-color-only change fails');
focusedCheck(!explorerDecorationsPass(decorationBefore, { gitColor: '#f00', badges: false }), 'Explorer-badge-only change fails');
focusedCheck(explorerDecorationsPass(decorationBefore, { gitColor: '#0f0', badges: false }), 'Explorer pair passes when both effects change');
const titleBefore = { padding: '20px', textX: 120 };
focusedCheck(titleSpacingPass(titleBefore, { padding: '60px', textX: 180 }), 'Title-spacing gate passes with captured padding and moved ink');
focusedCheck(!titleSpacingPass(titleBefore, { padding: '60px', textX: 120 }), 'Title-spacing gate fails without moved ink');
focusedCheck(!titleSpacingPass({ padding: '0px', textX: 120 }, { padding: '60px', textX: 180 }), 'Title-spacing gate fails for unexpected before padding');
const missingCaptureRows = failedPairIndexRows({ chapter: 10, groupKey: 'tab-completion' }, ['', ''], 'capture timeout');
focusedCheck(missingCaptureRows.length === 2 && missingCaptureRows.every((row) => row.file === '' && row.description === 'failed: capture timeout'), 'No-image failure is indexed with empty file columns');
console.log(`Offline planner, selector, shadow-mask, and focused design checks passed (${focusedChecks}/${focusedChecks}).`);
