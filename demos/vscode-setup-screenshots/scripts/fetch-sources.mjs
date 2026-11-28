import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const kitDir = path.resolve(here, '..');
const manifestPath = path.join(kitDir, 'manifest', 'chapters.json');
const sourceRoot = process.argv[2];

if (!sourceRoot) {
  throw new Error('Usage: node fetch-sources.mjs <output-source-directory>');
}

const chapters = JSON.parse(await readFile(manifestPath, 'utf8'));
const rawBase = 'https://raw.githubusercontent.com/igorbabko/vscode-setup';
const apiBase = 'https://api.github.com/repos/igorbabko/vscode-setup/contents';

async function fetchText(url, accept) {
  const response = await fetch(url, {
    headers: {
      accept,
      'user-agent': 'vscode-setup-screenshot-kit',
    },
  });
  if (!response.ok) return null;
  return response.text();
}

async function fetchPinnedFile(sha, sourcePath) {
  const rawUrl = `${rawBase}/${sha}/${sourcePath}`;
  const raw = await fetchText(rawUrl, 'text/plain');
  if (raw !== null) return raw;

  const apiUrl = `${apiBase}/${sourcePath}?ref=${sha}`;
  const apiText = await fetchText(apiUrl, 'application/vnd.github+json');
  if (apiText === null) {
    throw new Error(`Unable to fetch pinned source ${sha}:${sourcePath}`);
  }
  const payload = JSON.parse(apiText);
  if (payload.encoding !== 'base64' || typeof payload.content !== 'string') {
    throw new Error(`Unexpected source response for ${sha}:${sourcePath}`);
  }
  return Buffer.from(payload.content, 'base64').toString('utf8');
}

await mkdir(sourceRoot, { recursive: true });

for (const chapter of chapters) {
  const chapterDir = path.join(sourceRoot, `ch${String(chapter.chapter).padStart(2, '0')}`);
  await mkdir(chapterDir, { recursive: true });

  for (const sourcePath of chapter.sourcePaths) {
    const contents = await fetchPinnedFile(chapter.sha, sourcePath);
    const destination = path.join(chapterDir, path.basename(sourcePath));
    const parsed = JSON.parse(contents);
    if (sourcePath.endsWith('settings.json') && (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null)) {
      throw new Error(`Expected an object in ${chapter.sha}:${sourcePath}`);
    }
    if (sourcePath.endsWith('extensions.json') && !Array.isArray(parsed.recommendations)) {
      throw new Error(`Expected extension recommendations in ${chapter.sha}:${sourcePath}`);
    }
    await writeFile(destination, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  }
}

console.log(`Fetched ${chapters.length} pinned chapter snapshots into the ignored output directory.`);
