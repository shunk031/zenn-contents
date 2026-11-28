import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./article-outline.mjs", import.meta.url));
const repositoryPath = path.resolve(path.dirname(scriptPath), "..");

test("prints headings and first sentences while skipping non-prose blocks", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "article-outline-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const articlePath = path.join(directory, "article.md");
  fs.writeFileSync(articlePath, [
    "---",
    'title: "Front matter"',
    "---",
    "# Main heading",
    "最初の文です。二つ目の文です。",
    "",
    "1文だけの段落です。",
    "",
    "```md",
    "## Code heading",
    "コード内の文です。",
    "```",
    "",
    "- 箇条書きの文です。",
    "",
    "| table | text |",
    "| --- | --- |",
    "",
    "![image](image.png)",
    "",
    "画像の説明 ![image](image.png) は本文に残ります。",
    "",
    "https://example.com/calendar",
    "",
    "[^note]: 脚注の定義です。",
    "",
    "## Next heading",
    "最後の文です。",
  ].join("\n"));

  const result = spawnSync(process.execPath, [scriptPath, articlePath], {
    cwd: repositoryPath,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /# Main heading/);
  assert.match(result.stdout, /最初の文です。/);
  assert.doesNotMatch(result.stdout, /二つ目の文です。/);
  assert.match(result.stdout, /\[1文\] 1文だけの段落です。/);
  assert.match(result.stdout, /## Next heading/);
  assert.match(result.stdout, /\[1文\] 最後の文です。/);
  assert.match(result.stdout, /\[1文段落数: 3\]/);
  assert.match(result.stdout, /画像の説明 は本文に残ります。/);
  assert.doesNotMatch(result.stdout, /image\.png/);
  assert.doesNotMatch(result.stdout, /Front matter|Code heading|コード内|箇条書き|table|image\.png|calendar|脚注の定義/);
});
