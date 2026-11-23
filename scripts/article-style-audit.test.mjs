import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./article-style-audit.mjs", import.meta.url));
const repositoryPath = path.resolve(path.dirname(scriptPath), "..");

test("inline textlint directives exclude wrapped title text through an enable or end of file", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "article-style-audit-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const wrappedPath = path.join(directory, "wrapped.md");
  const unclosedPath = path.join(directory, "unclosed.md");
  const plainPath = path.join(directory, "plain.md");
  const quotedFencePath = path.join(directory, "quoted-fence.md");
  const listFencePath = path.join(directory, "list-fence.md");
  fs.writeFileSync(wrappedPath, [
    "---",
    'title: "<!-- textlint-disable ja-spacing/ja-space-between-half-and-full-width -->Codexの使い方<!-- textlint-enable ja-spacing/ja-space-between-half-and-full-width -->"',
    "---",
    "",
  ].join("\n"));
  fs.writeFileSync(unclosedPath, [
    "---",
    'title: "<!-- textlint-disable ja-spacing/ja-space-between-half-and-full-width -->Codexの使い方"',
    "---",
    "",
  ].join("\n"));
  fs.writeFileSync(plainPath, ["---", 'title: "Codexの使い方"', "---", ""].join("\n"));
  fs.writeFileSync(quotedFencePath, [
    "> ```md",
    "> [Codexの使い方](https://example.com)",
    "> <!-- textlint-disable -->",
    "> ```",
    "> <!-- textlint-disable -->",
    "",
  ].join("\n"));
  fs.writeFileSync(listFencePath, [
    "-   item with four-column content indentation",
    "",
    "    ```md",
    "    <!-- textlint-disable -->",
    "    [Codexの使い方](https://example.com)",
    "    ```",
    "123456789. item with eleven-column content indentation",
    "           ```md",
    "           <!-- textlint-disable -->",
    "           [Codexの使い方](https://example.com)",
    "           ```",
    "- parent list item",
    "    - nested list item",
    "      ```md",
    "      <!-- textlint-disable -->",
    "      [Codexの使い方](https://example.com)",
    "      ```",
    "- outside the fenced blocks",
    "  [Codexの使い方](https://example.com)",
    "  <!-- textlint-disable -->",
    "",
  ].join("\n"));

  const wrapped = spawnSync(process.execPath, [scriptPath, wrappedPath], {
    cwd: repositoryPath,
    encoding: "utf8",
  });
  const unclosed = spawnSync(process.execPath, [scriptPath, unclosedPath], {
    cwd: repositoryPath,
    encoding: "utf8",
  });
  const plain = spawnSync(process.execPath, [scriptPath, plainPath], {
    cwd: repositoryPath,
    encoding: "utf8",
  });
  const quotedFence = spawnSync(process.execPath, [scriptPath, quotedFencePath], {
    cwd: repositoryPath,
    encoding: "utf8",
  });
  const listFence = spawnSync(process.execPath, [scriptPath, listFencePath], {
    cwd: repositoryPath,
    encoding: "utf8",
  });

  assert.equal(wrapped.status, 0, wrapped.stderr);
  assert.doesNotMatch(wrapped.stderr, /half-full-width-space-outside-textlint/);
  assert.equal(unclosed.status, 0, unclosed.stderr);
  assert.doesNotMatch(unclosed.stderr, /half-full-width-space-outside-textlint/);
  assert.equal(plain.status, 1, plain.stderr);
  assert.match(plain.stderr, /half-full-width-space-outside-textlint/);
  assert.equal(quotedFence.status, 1, quotedFence.stderr);
  assert.doesNotMatch(quotedFence.stderr, /half-full-width-space-outside-textlint/);
  assert.doesNotMatch(quotedFence.stderr, /quoted-fence\.md:3: avoid-standalone-textlint-comment/);
  assert.match(quotedFence.stderr, /quoted-fence\.md:5: avoid-standalone-textlint-comment/);
  assert.equal(listFence.status, 1, listFence.stderr);
  assert.doesNotMatch(listFence.stderr, /list-fence\.md:(?:4|5|9|10|15|16):/);
  assert.match(listFence.stderr, /list-fence\.md:19: half-full-width-space-outside-textlint/);
  assert.match(listFence.stderr, /list-fence\.md:20: avoid-standalone-textlint-comment/);
});
