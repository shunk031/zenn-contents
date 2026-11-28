export const completionIdentity = (row) => row.snippet
  ? `snippet:${row.kind}:${row.snippetName || (row.detail || '').trim().split(/\r?\n/).at(-1)?.trim() || ''}`
  : `item:${row.kind}:${row.displayLabel || row.label || ''}`;
export const identifyCompletionRows = (rows) => rows.map((row) => ({ ...row, identity: completionIdentity(row) }));
export function tabCompletionPass(before, after) {
  if (before.suggestWidgetCount !== 1 || after.suggestWidgetCount !== 1) return false;
  const a = before.rows, b = after.rows;
  if (JSON.stringify(a.map(completionIdentity).sort()) !== JSON.stringify(b.map(completionIdentity).sort())) return false;
  const rank = (rows, test) => { const found = rows.flatMap((row, i) => test(row) ? [i] : []); return found.length === 1 ? found[0] : -1; };
  const tests = [(r) => !r.snippet && r.displayLabel === 'sampleNames',
    (r) => r.snippet && r.snippetName === 'Sample loop', (r) => r.snippet && r.snippetName === 'Sample card'];
  const x = tests.map((test) => rank(a, test)), y = tests.map((test) => rank(b, test));
  return [...x, ...y].every((i) => i >= 0) && x[0] < x[1] && x[0] < x[2] && y[1] < y[0] && y[2] < y[0];
}
export const selectionCopyPass = ({ focused, painted, clipboard, sentinel, expected }) =>
  focused && painted && clipboard !== sentinel && clipboard === expected;
export const pairFailureMessage = (primary, secondary = []) => [primary, ...secondary].join('; secondary: ');
