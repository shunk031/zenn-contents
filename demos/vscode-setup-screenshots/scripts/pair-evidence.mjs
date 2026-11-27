export function explorerDecorationsPass(before, after) {
  return before.gitColor !== after.gitColor && before.badges !== after.badges;
}

export function titleSpacingPass(before, after) {
  return before.padding === '20px' && after.padding === '60px' && after.textX > before.textX;
}

export function failedPairIndexRows(descriptor, files, message) {
  return files.map((file) => ({
    chapter: descriptor.chapter,
    group: descriptor.groupKey,
    file: file || '',
    description: `failed: ${message}`,
  }));
}
