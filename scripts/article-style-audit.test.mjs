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

  assert.equal(wrapped.status, 0, wrapped.stderr);
  assert.doesNotMatch(wrapped.stderr, /half-full-width-space-outside-textlint/);
  assert.equal(unclosed.status, 0, unclosed.stderr);
  assert.doesNotMatch(unclosed.stderr, /half-full-width-space-outside-textlint/);
  assert.equal(plain.status, 1, plain.stderr);
  assert.match(plain.stderr, /half-full-width-space-outside-textlint/);
});
