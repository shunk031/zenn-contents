const extraPairs = {
  overlays: [{ canonical: 'ch04-overlays-find', kind: 'find', filename: 'ch04-overlays-find' }],
  'tab-completion': [
    { canonical: 'ch10-tab-expansion', kind: 'tab', filename: 'ch10-tab-completion-tab' },
    { canonical: 'ch10-emmet-expansion', kind: 'emmet', filename: 'ch10-tab-completion-emmet' },
  ],
};
const clone = (value) => structuredClone(value);
function freezeTree(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}
export function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      target[key] = deepMerge(target[key] && typeof target[key] === 'object' ? target[key] : {}, value);
    } else target[key] = clone(value);
  }
  return target;
}
export function copyGroupSettings(source, paths) {
  const result = {};
  for (const parts of paths) {
    let value = source;
    for (const part of parts) {
      if (!value || typeof value !== 'object' || !(part in value)) throw new Error(`A group setting is missing from its pinned chapter source: ${parts.join(' / ')}`);
      value = value[part];
    }
    let cursor = result;
    for (const part of parts.slice(0, -1)) cursor = cursor[part] ||= {};
    cursor[parts.at(-1)] = clone(value);
  }
  return result;
}
export function createPairRegistry(chapters, groupSpecs) {
  return chapters.flatMap((chapter) => chapter.groups.flatMap((groupKey) => {
    const chapterTag = `ch${String(chapter.chapter).padStart(2, '0')}`;
    const base = { canonical: `${chapterTag}-${groupKey}`, chapter: chapter.chapter, groupKey, kind: 'group', filename: `${chapterTag}-${groupKey}` };
    return [base, ...(extraPairs[groupKey] || []).map((extra) => ({ ...extra, chapter: chapter.chapter, groupKey }))];
  })).map((pair) => {
    const spec = groupSpecs[pair.groupKey];
    if (!spec || spec.chapter !== pair.chapter) throw new Error(`Pair ${pair.canonical} has no valid group specification`);
    return { ...pair, settings: spec.settings, spec };
  });
}
export function parseRunArgs(args, registry) {
  let smoke = false, onlyValue;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help') return { help: true, smoke, only: null };
    if (arg === '--smoke') { if (smoke) throw new Error('--smoke may be supplied only once'); smoke = true; continue; }
    if (arg !== '--only') throw new Error(`Unknown option: ${arg}`);
    if (onlyValue !== undefined) throw new Error('--only may be supplied only once');
    onlyValue = args[++i];
    if (!onlyValue || onlyValue.startsWith('--')) throw new Error('--only requires a comma-separated pair list');
  }
  if (smoke && onlyValue !== undefined) throw new Error('--only cannot be combined with --smoke');
  if (onlyValue === undefined) return { help: false, smoke, only: null };
  const names = onlyValue.split(',').map((name) => name.trim());
  const invalidNames = names.some((name) => !name) || new Set(names).size !== names.length;
  if (invalidNames) throw new Error('Empty or duplicate --only pair name.');
  const known = new Set(registry.map((pair) => pair.canonical));
  const unknown = names.filter((name) => !known.has(name));
  if (unknown.length) throw new Error(`Unknown --only pair: ${unknown.join(', ')}`);
  return { help: false, smoke, requested: names, only: new Set(names) };
}
export function buildChronologicalPlan(chapters, settingsByChapter, groupSpecs, registry = createPairRegistry(chapters, groupSpecs)) {
  let plannedSettings = {};
  const plan = [];
  for (const chapter of chapters) {
    const snapshot = settingsByChapter[chapter.chapter];
    if (!snapshot) throw new Error(`Missing pinned settings for chapter ${chapter.chapter}`);
    for (const groupKey of chapter.groups) {
      const before = clone(plannedSettings);
      const after = deepMerge(clone(before), copyGroupSettings(snapshot, groupSpecs[groupKey].settings));
      const states = { before: freezeTree(clone(before)), after: freezeTree(clone(after)) };
      for (const pair of registry.filter((item) => item.chapter === chapter.chapter && item.groupKey === groupKey)) plan.push({ ...pair, ...states });
      plannedSettings = after;
    }
    plannedSettings = clone(snapshot);
  }
  if (plan.length !== registry.length) throw new Error(`Planned ${plan.length} pairs for a ${registry.length}-pair registry`);
  return plan;
}
export const selectPlan = (plan, selected) => selected ? plan.filter((pair) => selected.has(pair.canonical)) : plan;
export function requiredExtensionsThrough(chapters, selectedPlan, recommendationsByChapter, extensionPins) {
  if (!selectedPlan.length) return [];
  const lastChapter = Math.max(...selectedPlan.map((pair) => pair.chapter));
  const ids = new Set();
  for (const chapter of chapters.filter((item) => item.chapter <= lastChapter)) {
    for (const recommendation of recommendationsByChapter[chapter.chapter] || []) ids.add(recommendation.toLowerCase());
  }
  return [...ids].map((id) => {
    const version = extensionPins.get(id);
    if (!version) throw new Error(`No pinned Marketplace version is configured for recommendation ${id}`);
    return { id, version };
  });
}
export const addPairRequirements = (plan, chapters, recommendationsByChapter, extensionPins) => plan.map((pair) => ({
  ...pair, requiredExtensions: requiredExtensionsThrough(chapters, [pair], recommendationsByChapter, extensionPins),
}));
const inRect = (point, rect) => point.x >= rect.left && point.x < rect.right && point.y >= rect.top && point.y < rect.bottom;
export function findShadowRegions(widget, shadow, viewport) {
  if (!widget || !shadow || shadow === 'none') throw new Error('Find shadow witness requires a visible before shadow');
  const lengths = [...shadow.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1]));
  if (lengths.length < 4) throw new Error(`Unsupported pinned Find shadow: ${shadow}`);
  const [offsetX, offsetY, blur, spread] = lengths;
  const extentY = Math.max(0, offsetY + spread) + blur * 2;
  const inset = Math.max(40, Math.abs(offsetX) + blur + Math.abs(spread));
  const left = Math.max(0, widget.left + inset);
  const right = Math.min(viewport.width, widget.right - inset);
  const top = Math.max(0, widget.bottom + Math.max(0, offsetY + spread));
  const bottom = Math.min(viewport.height, widget.bottom + extentY);
  const controlTop = Math.min(viewport.height, widget.bottom + extentY + 6);
  const controlBottom = Math.min(viewport.height, controlTop + Math.max(4, blur));
  if (right <= left || bottom <= top || controlBottom <= controlTop) throw new Error('Find shadow witness is clipped or too narrow');
  const regions = { shadow: { left, right, top, bottom }, control: { left, right, top: controlTop, bottom: controlBottom }, widget };
  if (inRect({ x: (left + right) / 2, y: (widget.top + widget.bottom) / 2 }, regions.shadow)) throw new Error('Find shadow mask overlaps the widget interior');
  return regions;
}
export const findShadowPixelsPass = (changedPoints, regions, controlChanged) => !controlChanged
  && changedPoints.some((point) => inRect(point, regions.shadow) && !inRect(point, regions.widget));
