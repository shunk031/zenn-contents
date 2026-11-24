import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';

export async function installMarketplaceExtension(extensionId, version, cacheDir) {
  const [publisher, name] = extensionId.split('.');
  if (!publisher || !name || !version) throw new Error(`Invalid pinned extension: ${extensionId}@${version}`);
  await mkdir(cacheDir, { recursive: true });
  const vsixPath = path.join(cacheDir, `${extensionId}-${version}.vsix`);
  const packageUrl = `https://marketplace.visualstudio.com/_apis/public/gallery/publishers/${encodeURIComponent(publisher)}/vsextensions/${encodeURIComponent(name)}/${encodeURIComponent(version)}/vspackage`;
  execFileSync('curl', ['-fLsS', packageUrl, '-o', vsixPath], { stdio: 'inherit' });

  const downloaded = await readFile(vsixPath);
  // The tested Marketplace response was gzip-wrapped; RFC 1952 defines the 1f 8b signature.
  const archive = downloaded[0] === 0x1f && downloaded[1] === 0x8b ? gunzipSync(downloaded) : downloaded;
  if (archive !== downloaded) await writeFile(vsixPath, archive);
  const stagingDir = await mkdtemp(path.join(os.tmpdir(), 'vss-vsix-'));
  try {
    const archivePath = path.join(stagingDir, 'package.zip');
    await writeFile(archivePath, archive);
    execFileSync('unzip', ['-q', archivePath, '-d', stagingDir], { stdio: 'inherit' });
    const packagePath = path.join(stagingDir, 'extension', 'package.json');
    const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
    const manifestId = `${manifest.publisher}.${manifest.name}`.toLowerCase();
    if (manifestId !== extensionId.toLowerCase() || manifest.version !== version) {
      throw new Error(`Marketplace package identity mismatch: ${manifestId}@${manifest.version}`);
    }
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }
  return vsixPath;
}
