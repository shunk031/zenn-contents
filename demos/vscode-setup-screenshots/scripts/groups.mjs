const setting = (...parts) => parts;

export const extensionPins = new Map([
  ['josemurilloc.aura-spirit-dracula', '0.1.10'],
  ['pkief.material-icon-theme', '5.40.0'],
  ['subframe7536.custom-ui-style', '0.7.2'],
]);

export const groupSpecs = {
  theme: {
    chapter: 1,
    settings: [setting('workbench.colorTheme')],
    description: 'The Aura Dracula Spirit theme recolors the workbench.',
  },
  'minimal-chrome': {
    chapter: 1,
    settings: [setting('workbench.activityBar.location'), setting('workbench.editor.showTabs'), setting('workbench.statusBar.visible')],
    description: 'The Activity Bar and Status Bar disappear while one editor tab remains.',
  },
  'editor-aids': {
    chapter: 1,
    settings: [setting('editor.minimap.enabled'), setting('breadcrumbs.enabled')],
    description: 'The editor minimap and breadcrumb row disappear.',
  },
  'sidebar-placement': {
    chapter: 2,
    settings: [setting('workbench.sideBar.location')],
    description: 'The Explorer moves from the left side of the workbench to the right.',
  },
  'explorer-icons': {
    chapter: 2,
    settings: [setting('workbench.iconTheme'), setting('material-icon-theme.hidesExplorerArrows')],
    description: 'Material file icons replace the defaults and Explorer disclosure arrows hide.',
  },
  'tree-layout': {
    chapter: 2,
    settings: [setting('workbench.tree.enableStickyScroll'), setting('workbench.tree.renderIndentGuides'), setting('workbench.tree.indent'), setting('explorer.compactFolders')],
    interaction: 'tree-layout',
    description: 'Nested folders expand into separate rows without tree indent guides.',
  },
  'operation-confirmations': {
    chapter: 2,
    settings: [setting('explorer.confirmDragAndDrop'), setting('explorer.confirmDelete')],
    interaction: 'delete-cancel',
    description: 'The sample editor stays visible; the confirmation dialog is omitted, so the setting leaves no visible difference.',
  },
  'explorer-decorations': {
    chapter: 2,
    settings: [setting('explorer.decorations.badges'), setting('git.decorations.enabled')],
    description: 'Explorer error badges and Git status colors disappear from the file list.',
  },
  'window-chrome': {
    chapter: 3,
    settings: [setting('window.zoomLevel'), setting('window.customTitleBarVisibility'), setting('window.titleBarStyle'), setting('custom-ui-style.electron')],
    restart: true,
    description: 'The title bar becomes minimal and the workbench zoom changes.',
  },
  'title-spacing': {
    chapter: 3,
    settings: [setting('custom-ui-style.stylesheet', '.monaco-workbench .part.editor > .content .editor-group-container > .title > .label-container > .title-label'), setting('custom-ui-style.font.sansSerif')],
    restart: true,
    description: 'Extra spacing clears the editor title area around the window controls.',
  },
  overlays: {
    chapter: 4,
    settings: [setting('custom-ui-style.stylesheet', '.notification-toast'), setting('custom-ui-style.stylesheet', '.quick-input-widget.show-file-icons'), setting('custom-ui-style.stylesheet', '.quick-input-widget'), setting('custom-ui-style.stylesheet', '.quick-input-list .scrollbar'), setting('custom-ui-style.stylesheet', '.monaco-action-bar.quick-input-inline-action-bar'), setting('custom-ui-style.stylesheet', '.editor-widget.find-widget'), setting('custom-ui-style.stylesheet', '.quick-input-titlebar')],
    restart: true,
    interaction: 'find-widget',
    description: 'The Find widget and quick input use the new overlay spacing and shadows.',
  },
  'surface-boundaries': {
    chapter: 4,
    settings: [setting('custom-ui-style.stylesheet', '.monaco-workbench .part.editor > .content .editor-group-container > .title.title-border-bottom:after'), setting('custom-ui-style.stylesheet', '.monaco-scrollable-element > .shadow.top'), setting('custom-ui-style.stylesheet', '.sidebar .title-label'), setting('custom-ui-style.stylesheet', '.sidebar'), setting('custom-ui-style.stylesheet', '.monaco-workbench .monaco-list:not(.element-focused):focus:before'), setting('custom-ui-style.stylesheet', '.monaco-list-row.focused'), setting('custom-ui-style.stylesheet', '.monaco-editor .scroll-decoration'), setting('custom-ui-style.stylesheet', '.title-actions'), setting('custom-ui-style.stylesheet', '.title.show-file-icons .label-container .monaco-icon-label.file-icon'), setting('custom-ui-style.stylesheet', '.title .monaco-icon-label:after')],
    restart: true,
    description: 'The same sample editor and Explorer remain visible; the injected surface styles make no visible change in this VS Code build.',
  },
  'cursor-appearance': {
    chapter: 5,
    settings: [setting('editor.cursorBlinking'), setting('editor.cursorStyle'), setting('custom-ui-style.stylesheet', '.monaco-editor .cursors-layer .cursor')],
    restart: true,
    interaction: 'cursor-focus',
    description: 'A solid block cursor receives the chapter gradient styling.',
  },
  'multi-cursor': {
    chapter: 5,
    settings: [setting('editor.multiCursorModifier')],
    interaction: 'multi-cursor',
    description: 'The fixed Option-click gesture leaves one cursor after the setting changes the multi-cursor modifier to Command-click.',
  },
  'cursor-colors': {
    chapter: 5,
    settings: [setting('workbench.colorCustomizations', 'editorCursor.background')],
    interaction: 'cursor-focus',
    description: 'The cursor looks the same because the earlier cursor gradient style takes precedence over this background color.',
  },
  'font-metrics': {
    chapter: 6,
    settings: [setting('editor.fontFamily'), setting('editor.fontSize'), setting('editor.lineHeight')],
    interaction: 'editor-top',
    description: 'Editor text size and line spacing change across the visible code lines.',
  },
  'code-style': {
    chapter: 6,
    settings: [setting('editor.fontLigatures'), setting('editor.tokenColorCustomizations')],
    interaction: 'editor-top',
    description: 'The sample code looks unchanged because Dank Mono is not installed and the theme already italicizes comments.',
  },
  'code-decorations': {
    chapter: 7,
    settings: [setting('editor.stickyScroll.enabled'), setting('editor.colorDecorators'), setting('editor.codeLens'), setting('editor.links'), setting('editor.matchBrackets')],
    interaction: 'code-lens',
    description: 'The sample code looks unchanged; this VS Code and TypeScript combination shows no visible difference for this settings group.',
  },
  'editor-hints': {
    chapter: 7,
    settings: [setting('editor.parameterHints.enabled'), setting('editor.lightbulb.enabled'), setting('editor.hover.enabled')],
    interaction: 'hover',
    description: 'The editor hint and hover UI follows the chapter settings.',
  },
  'save-and-diff': {
    chapter: 7,
    settings: [setting('files.trimTrailingWhitespace'), setting('files.insertFinalNewline'), setting('scm.diffDecorations')],
    interaction: 'save-diff',
    description: 'The modified sample file and Git gutter decoration look the same before and after these save and diff settings.',
  },
  'line-numbers-and-indent': {
    chapter: 8,
    settings: [setting('editor.lineNumbers'), setting('editor.tabSize'), setting('editor.detectIndentation')],
    interaction: 'editor-top',
    description: 'Relative line numbers and the configured indentation width appear in the editor.',
  },
  'folding-and-guides': {
    chapter: 8,
    settings: [setting('editor.showFoldingControls'), setting('editor.guides.indentation'), setting('editor.renderWhitespace'), setting('editor.renderLineHighlight'), setting('editor.occurrencesHighlight'), setting('editor.selectionHighlight')],
    interaction: 'editor-top',
    description: 'Folding controls, indentation guides, whitespace, and code highlights change.',
  },
  'scrollbars-and-ruler': {
    chapter: 9,
    settings: [setting('editor.scrollbar.horizontal'), setting('editor.scrollbar.vertical'), setting('editor.overviewRulerBorder')],
    interaction: 'editor-top',
    description: 'Editor scrollbars and the overview ruler use the chapter layout.',
  },
  'marker-colors': {
    chapter: 9,
    settings: [setting('editor.hideCursorInOverviewRuler'), setting('workbench.colorCustomizations', 'editorOverviewRuler.wordHighlightStrongForeground'), setting('workbench.colorCustomizations', 'editorOverviewRuler.selectionHighlightForeground'), setting('workbench.colorCustomizations', 'editorOverviewRuler.rangeHighlightForeground'), setting('workbench.colorCustomizations', 'editorOverviewRuler.wordHighlightForeground'), setting('workbench.colorCustomizations', 'editorOverviewRuler.bracketMatchForeground'), setting('workbench.colorCustomizations', 'editorOverviewRuler.findMatchForeground'), setting('workbench.colorCustomizations', 'editorOverviewRuler.modifiedForeground'), setting('workbench.colorCustomizations', 'editorOverviewRuler.deletedForeground'), setting('workbench.colorCustomizations', 'editorOverviewRuler.warningForeground'), setting('workbench.colorCustomizations', 'editorOverviewRuler.addedForeground'), setting('workbench.colorCustomizations', 'editorOverviewRuler.errorForeground'), setting('workbench.colorCustomizations', 'editorOverviewRuler.infoForeground'), setting('workbench.colorCustomizations', 'editorOverviewRuler.border')],
    interaction: 'overview-ruler-search',
    description: 'The Find widget and overview ruler marks remain visible with no clear color change in this VS Code build.',
  },
  'automatic-suggestions': {
    chapter: 10,
    settings: [setting('editor.quickSuggestions'), setting('editor.suggestOnTriggerCharacters')],
    interaction: 'automatic-suggestions',
    description: 'Typing a trigger character opens suggestions before, then stays quiet after.',
  },
  'tab-completion': {
    chapter: 10,
    settings: [setting('editor.tabCompletion'), setting('editor.snippetSuggestions'), setting('emmet.triggerExpansionOnTab')],
    interaction: 'tab-completion',
    description: 'Tab expands the sample Emmet abbreviation into HTML elements.',
  },
  'selected-suggestion-color': {
    chapter: 10,
    settings: [setting('workbench.colorCustomizations', '[Aura Dracula Spirit (Soft)]', 'editorSuggestWidget.selectedBackground')],
    interaction: 'selected-suggestion',
    description: 'The selected suggestion row looks the same because the chapter color matches the theme selection color.',
  },
  'sidebar-and-title': {
    chapter: 11,
    settings: [setting('custom-ui-style.stylesheet', '.monaco-workbench .part.editor > .content .editor-group-container > .title > .label-container > .title-label'), setting('workbench.colorCustomizations', '[Aura Dracula Spirit (Soft)]', 'sideBar.background')],
    restart: true,
    description: 'The sidebar background and file title spacing receive their final styling.',
  },
  autosave: {
    chapter: 11,
    settings: [setting('files.autoSave')],
    interaction: 'autosave',
    description: 'The unsaved editor indicator clears after the configured save delay.',
  },
  'recommendation-notifications': {
    chapter: 11,
    settings: [setting('extensions.ignoreRecommendations'), setting('update.mode')],
    interaction: 'recommendations',
    restart: true,
    description: 'The sample editor remains visible; no recommendation toast is captured, so the setting has no visible difference.',
  },
};
