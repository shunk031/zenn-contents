const vscode = require('vscode');
const { writeFile } = require('node:fs/promises');
const jsonRange = (value) => !value ? null : value.start && value.end
  ? { start: value.start, end: value.end }
  : { inserting: jsonRange(value.inserting), replacing: jsonRange(value.replacing) };
const scopedConfiguration = (section, uri, names) => Object.fromEntries(names.map((name) => {
  const config = vscode.workspace.getConfiguration(section, uri);
  return [name, { value: config.get(name), inspect: config.inspect(name) }];
}));
function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand('vssRanking.captureDiagnostics', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) throw new Error('Ranking diagnostics require an active text editor.');
    const { document, selection } = editor, position = selection.active;
    const typescript = vscode.extensions.getExtension('vscode.typescript-language-features');
    let provider;
    try {
      const result = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', document.uri, position);
      const items = Array.isArray(result) ? result : result?.items || [];
      provider = { status: items.length ? 'items' : 'empty', items: items.map((item) => ({
        name: typeof item.label === 'string' ? item.label : item.label?.label,
        kind: item.kind, range: jsonRange(item.range || item.textEdit?.range),
      })) };
    } catch (error) {
      provider = { status: 'error', error: String(error?.stack || error) };
    }
    const editorConfig = scopedConfiguration('editor', document.uri,
      ['suggest', 'wordBasedSuggestions', 'quickSuggestions', 'suggestOnTriggerCharacters', 'tabCompletion']);
    const tsConfig = scopedConfiguration('typescript.suggest', document.uri, ['enabled', 'autoImports']);
    const sdk = vscode.workspace.getConfiguration('typescript', document.uri).inspect('tsdk');
    const output = {
      capturedAt: new Date().toISOString(),
      document: {
        uri: document.uri.toString(), languageId: document.languageId, version: document.version,
        text: document.getText(), selection, offset: document.offsetAt(position),
      },
      configuration: { editor: editorConfig, typescriptSuggest: tsConfig, typescriptSdk: sdk },
      typescriptExtension: { enabled: !!typescript, active: !!typescript?.isActive }, provider,
    };
    await writeFile(process.env.VSS_RANKING_DIAGNOSTIC_PATH, `${JSON.stringify(output, null, 2)}\n`);
  }));
}
module.exports = { activate };
