#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const targets = process.argv.slice(2);
const files = targets.length > 0 ? targets : fs.readdirSync("articles")
  .filter((file) => file.endsWith(".md"))
  .map((file) => path.join("articles", file));

const checks = [
  {
    name: "avoid-vague-fillers",
    pattern: /(だいたい|ざっくり|豊かなフィードバック|一言で整理すると|次のようになります|以下の解説もわかりやすいです|追う必要があります|補助線)/,
    message: "ぼかし語や定型句を具体的な表現に直してください。",
  },
  {
    name: "avoid-leading-nanode",
    pattern: /^なので/m,
    message: "文頭の「なので」は避け、前文との関係を文中で自然につないでください。",
  },
  {
    name: "avoid-awkward-terms",
    pattern: /(単語片|(?<!事)後学習|現方策蒸留|ラベラ)/u,
    message: "過去に不自然と判断した用語が残っています。",
  },
  {
    name: "avoid-floating-reference",
    pattern: /ここでいう/,
    message: "指示語が浮きやすいので、受ける記号や用語を明示してください。",
  },
  {
    name: "avoid-generated-heading",
    pattern: /^#{2,3}\s+[^#\n]+:\s+.+$/m,
    message: "見出しに「手法名: ひとこと説明」を入れず、本文で説明してください。",
  },
  {
    name: "avoid-generated-title",
    pattern: /^title:\s*".*全体像:.*まで.*"$/m,
    message: "タイトルの「全体像: ...まで」は生成文っぽいので避けてください。",
  },
  {
    name: "cite-term-not-sentence-knowledge-distillation",
    pattern: /知識蒸留では、.*\[\^[^\]]+\]/,
    message: "用語の出典は文末ではなく「知識蒸留[^...] では」のように置いてください。",
  },
  {
    name: "cite-author-not-sentence",
    pattern: /Shen らは、.*\[\^[^\]]+\]/,
    message: "著者名に対応する引用は「Shen ら[^...] は」のように置いてください。",
  },
  {
    name: "cite-each-method-in-combined-label",
    pattern: /\b[A-Z][A-Z0-9-]*(?: \/ | \+ )[A-Z][A-Z0-9-]*(?: 系)?\[\^[^\]]+\](?:\[\^[^\]]+\])+/,
    message: "複数手法を並べるときは「RLVR[^...] / GRPO[^...]」のように各手法名の直後へ引用を置いてください。",
  },
  {
    name: "cite-each-sdpo-variant",
    pattern: /SDPO\[\^[^\]]+\]\[\^[^\]]+\]/,
    message: "SDPO の複数系統を並べるときは、各系統名の直後へ引用を置いてください。",
  },
  {
    name: "order-broad-to-specific-rlvr-grpo",
    pattern: /GRPO \/ RLVR|GRPO や RLVR|GRPO および RLVR/,
    message: "RLVR は広い枠組み、GRPO は具体的な方策更新なので、RLVR / GRPO の順にしてください。",
  },
];

let failed = false;

const acronymCitationChecks = [
  "SFT",
  "RLHF",
  "DPO",
  "PPO",
  "RLVR",
  "GRPO",
  "OPD",
  "OPSD",
  "SDPO",
];

function bodyLinesWithoutFrontMatter(text) {
  const lines = text.split(/\r?\n/);

  if (lines[0] !== "---") {
    return lines;
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line === "---");
  return closingIndex >= 0 ? lines.slice(closingIndex + 1) : lines;
}

function hasNearbyFootnote(line, termIndex) {
  return line.slice(termIndex, termIndex + 100).includes("[^");
}

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);

  for (const check of checks) {
    for (let index = 0; index < lines.length; index += 1) {
      if (check.pattern.test(lines[index])) {
        failed = true;
        console.error(`${file}:${index + 1}: ${check.name}: ${check.message}`);
        console.error(`  ${lines[index]}`);
      }
    }
  }

  const bodyLines = bodyLinesWithoutFrontMatter(text);

  for (const acronym of acronymCitationChecks) {
    const pattern = new RegExp(`\\b${acronym}\\b`);

    for (let index = 0; index < bodyLines.length; index += 1) {
      const line = bodyLines[index];

      if (line.startsWith("[^")) {
        continue;
      }

      const match = pattern.exec(line);

      if (!match) {
        continue;
      }

      if (!hasNearbyFootnote(line, match.index)) {
        failed = true;
        console.error(`${file}:${index + 1}: cite-first-acronym-use: 略語の本文初出では、正式名称と引用を同じ箇所に置いてください。`);
        console.error(`  ${line}`);
      }

      break;
    }
  }
}

if (failed) {
  process.exit(1);
}
