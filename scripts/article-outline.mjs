#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function bodyStart(lines) {
  if (lines[0] !== "---") {
    return 0;
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && /^(---|\.\.\.)$/.test(line));
  return closingIndex < 0 ? lines.length : closingIndex + 1;
}

function isFenceStart(line) {
  return /^\s{0,3}(`{3,}|~{3,})/.exec(line);
}

function isFenceEnd(line, marker) {
  const character = marker[0];
  const minimumLength = marker.length;
  return new RegExp(`^\\s{0,3}${character}{${minimumLength},}\\s*$`).test(line);
}

function isListItem(line) {
  return /^\s{0,3}(?:[-+*]\s+|\d+[.)]\s+)/.test(line);
}

function isTableDelimiter(line) {
  const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function withoutImages(line) {
  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/<img\b[^>]*>/gi, "")
    .trim();
}

export function sentenceParts(text) {
  const parts = [];
  let start = 0;
  let inlineCodeDelimiter = 0;
  let linkDestinationDepth = 0;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "`" && text[index - 1] !== "\\") {
      let delimiterLength = 1;
      while (text[index + delimiterLength] === "`") delimiterLength += 1;
      inlineCodeDelimiter = inlineCodeDelimiter === 0 ? delimiterLength : 0;
      index += delimiterLength - 1;
      continue;
    }
    if (inlineCodeDelimiter > 0) continue;

    if (linkDestinationDepth === 0 && character === "]" && text[index + 1] === "(") {
      linkDestinationDepth = 1;
      index += 1;
      continue;
    }
    if (linkDestinationDepth > 0) {
      if (character === "(") linkDestinationDepth += 1;
      if (character === ")") linkDestinationDepth -= 1;
      continue;
    }
    if (character === "\\" || !"。！？!?.".includes(character)) continue;
    if (
      character === "."
      && index + 1 < text.length
      && !/[\s」』）)\]】]/.test(text[index + 1])
    ) continue;
    if (character === "." && /\b(?:e\.g|i\.e|u\.s|u\.k|mr|mrs|ms|dr|prof|fig|no|vs)\.$/i.test(text.slice(start, index + 1))) continue;

    let end = index + 1;
    while (end < text.length && "」』）)]】".includes(text[end])) end += 1;
    const part = text.slice(start, end).trim();
    if (part) parts.push(part);
    start = end;
    while (start < text.length && /\s/.test(text[start])) start += 1;
    index = end - 1;
  }

  const remainder = text.slice(start).trim();
  if (remainder) parts.push(remainder);
  return parts.length > 0 ? parts : [text.trim()];
}

function skippedBlockType(line) {
  const trimmed = line.trim();
  if (/^\|/.test(trimmed)) return "table";
  if (/^>/.test(trimmed)) return "blockquote";
  if (/^!\[[^\]]*\]\([^)]*\)\s*$/.test(trimmed) || /^<img\b[^>]*>$/i.test(trimmed)) return "image";
  if (/^\[\^[^\]]+\]:/.test(trimmed)) return "footnote";
  if (/^https?:\/\/\S+$/i.test(trimmed)) return "link-card";
  if (/^<!--/.test(trimmed) || /^</.test(trimmed)) return "html";
  if (/^\$\$/.test(trimmed)) return "math";
  if (/^(?:---+|___+|\*\*\*+)\s*$/.test(trimmed)) return "rule";
  if (/^\s{4,}\S/.test(line)) return "indented-code";
  return null;
}

export function parseProseBlocks(markdown) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let paragraphLine = 0;
  let fenceMarker = null;
  let listActive = false;
  let tableActive = false;
  let blockquoteActive = false;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    const text = paragraph.join(" ").replace(/\s+/g, " ").trim();
    const line = paragraphLine;
    paragraph = [];
    paragraphLine = 0;
    if (!text) return;

    blocks.push({ type: "paragraph", line, text, sentences: sentenceParts(text) });
  }

  const bodyOffset = bodyStart(lines);
  const bodyLines = lines.slice(bodyOffset);
  for (const [lineIndex, line] of bodyLines.entries()) {
    const sourceLine = lineIndex + bodyOffset + 1;
    const nextLine = bodyLines[lineIndex + 1] ?? "";
    if (fenceMarker) {
      if (isFenceEnd(line, fenceMarker)) fenceMarker = null;
      continue;
    }

    if (blockquoteActive) {
      if (line.trim() && !/^\s{0,3}>/.test(line) && !isFenceStart(line) && !isListItem(line)
        && !/^#{1,6}\s+/.test(line) && !skippedBlockType(line) && !isTableDelimiter(nextLine)) continue;
      blockquoteActive = false;
    }

    if ((tableActive && line.includes("|")) || (line.includes("|") && isTableDelimiter(nextLine))) {
      flushParagraph();
      blocks.push({ type: "table", line: sourceLine, text: line.trim() });
      tableActive = true;
      continue;
    }
    tableActive = false;

    const fence = isFenceStart(line);
    if (fence) {
      flushParagraph();
      fenceMarker = fence[1];
      const type = /^\s{0,3}(?:`{3,}|~{3,})\s*mermaid(?:\s|$)/i.test(line) ? "mermaid" : "code";
      blocks.push({ type, line: sourceLine, text: "" });
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    if (listActive) {
      if (isListItem(line) || /^\s{2,}\S/.test(line)) continue;
      listActive = false;
    }

    if (isListItem(line)) {
      flushParagraph();
      if (!listActive) blocks.push({ type: "list", line: sourceLine, text: "" });
      listActive = true;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", line: sourceLine, text: line.trim() });
      continue;
    }

    const skippedType = skippedBlockType(line);
    if (skippedType) {
      flushParagraph();
      blocks.push({ type: skippedType, line: sourceLine, text: line.trim() });
      if (skippedType === "blockquote") blockquoteActive = true;
      continue;
    }

    const proseLine = withoutImages(line);
    if (proseLine) {
      if (paragraph.length === 0) paragraphLine = sourceLine;
      paragraph.push(proseLine);
    }
  }

  flushParagraph();
  return blocks;
}

export function extractOutline(markdown) {
  return parseProseBlocks(markdown).flatMap((block) => {
    if (block.type === "heading") return [block.text];
    if (block.type !== "paragraph") return [];
    const marker = block.sentences.length === 1 ? "[1文] " : "";
    return [`  ${marker}${block.sentences[0]}`];
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: npm run article:outline -- <file>...");
    process.exitCode = 2;
  } else {
    for (const file of files) {
      try {
        const markdown = fs.readFileSync(file, "utf8");
        console.log(`===== ${path.normalize(file)}`);
        const outline = extractOutline(markdown);
        for (const line of outline) console.log(line);
        const oneSentenceCount = outline.filter((line) => line.startsWith("  [1文] ")).length;
        console.log(`  [1文段落数: ${oneSentenceCount}]`);
      } catch (error) {
        console.error(`${file}: ${error.message}`);
        process.exitCode = 1;
      }
    }
  }
}
