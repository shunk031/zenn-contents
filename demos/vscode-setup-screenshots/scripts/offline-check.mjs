import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paintedMatch } from './cdp.mjs';
import { groupSpecs } from './groups.mjs';
import { addPairRequirements, buildChronologicalPlan, createPairRegistry, findShadowPixelsPass, findShadowRegions, parseRunArgs, selectPlan } from './planner.mjs';
const kit = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
console.log('Offline planner, selector, and shadow-mask checks passed.');
