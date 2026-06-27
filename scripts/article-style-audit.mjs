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
    pattern: /(だいたい|ざっくり|豊かなフィードバック|一言で整理すると|次のようになります|以下の解説もわかりやすいです|追う必要があります|次の目的を大きくします|距離を小さくします|補助線|下の表では|最初の候補はこうなります|対応する手法を並べます|左の列から読むと早いです|教えません|教えてくれます|素直な出発点になります|自然な出発点になります|候補になります)/,
    message: "ぼかし語や定型句を具体的な表現に直してください。",
  },
  {
    name: "avoid-abstract-starting-point",
    pattern: /(まず\s+[A-Z][A-Z0-9-]*\s+が自然です|[A-Z][A-Z0-9-]*\s+は.*出発点になります)/,
    message: "手法を開始位置として評価せず、どのデータで何を学習に入れるのかを書いてください。",
  },
  {
    name: "avoid-author-side-navigation",
    pattern: /(その入り口として|入り口として|読み直します|先に置きます|置いておきます|この記事では、以下|本記事では、以下|そこから訓練構成を選びます|このあと扱う手法)/,
    message: "書き手側の段取りではなく、読者が受け取る論点として書いてください。",
  },
  {
    name: "avoid-intro-example-dumping",
    pattern: /たとえば、[^。\n]+。[^。\n]+。[^。\n]+。そういう場面で/,
    message: "導入で失敗例を連発してから主題へ戻ると、本文へ入る前の寄り道になります。本文の論点を進めない例示は削ってください。",
  },
  {
    name: "avoid-subjectless-procedure-ending",
    pattern: /(訓練構成を選びます|手法を選びます|候補を選びます|決めるところから始めます|使う手法は.+決まります|失敗の単位に合わせて組み合わせます)/,
    message: "主語の曖昧な手順語尾を避け、関係として書くか筆者の推奨として書いてください。",
  },
  {
    name: "avoid-vague-training-data-metaphor",
    pattern: /(学習に戻せるデータ|データを学習に戻す|応答を学習に戻す)/,
    message: "データを学習に戻すという曖昧な比喩ではなく、データ形式と必要な構成要素を書いてください。",
  },
  {
    name: "avoid-vague-signal-location-metaphor",
    pattern: /(信号が入る場所|信号がどこに入る|どこに信号を入れ|途中の文脈まで信号を入れる)/,
    message: "教師信号を空間比喩だけで説明せず、訓練データの形、評価する出力の単位、必要なモデルや更新ループを書いてください。",
  },
  {
    name: "avoid-empty-classification-signpost",
    pattern: /(手法名ではなく[^。\n]*(?:分類して|分類し|読|見)|[^。\n]*(?:軸|粒度|場所|観点)[^。\n]*(?:分類して|分類し)[^。\n]*(?:読|見))/,
    message: "分類軸の宣言だけで済ませず、データ形式、評価対象、必要なモデル、更新ループのどれが変わるのかを書いてください。",
  },
  {
    name: "avoid-vague-local-data",
    pattern: /(手元のデータ|手元に残っているデータ|手元に残ってるデータ|手元の失敗)/,
    message: "データ、ログ、教師信号を分けて書いてください。",
  },
  {
    name: "avoid-inconsistent-acronym-variant-order",
    pattern: /(SDPO\s+(?:自己蒸留型|区間型)|(?:自己蒸留型|区間型) SDPO.*SDPO\s+(?:自己蒸留型|区間型)|SDPO\s+(?:自己蒸留型|区間型).*(?:自己蒸留型|区間型) SDPO)/,
    message: "同じ略語の派生名は、修飾語の位置をそろえてください。",
  },
  {
    name: "avoid-fragment-question-list",
    pattern: /なのか[、。].*なのか[、。]/,
    message: "「A なのか、B なのか」の断片列挙で済ませず、データ形式と訓練構成の対応を書いてください。",
  },
  {
    name: "avoid-empty-taxonomy-recap",
    pattern: /[A-Za-z0-9]+(?:、[A-Za-z0-9]+){2,} は、.+(分けられます|分類できます|整理できます)。/,
    message: "手法列挙の再分類で締めず、次に必要な差分を書くか削除してください。",
  },
  {
    name: "avoid-weak-link-bridge",
    pattern: /(次の記事は|次の記事が詳しいです|以下の記事では|話が扱われています|参考になります)/,
    message: "外部リンク前は、リンク先が本文のどの論点を補うのかを書いてください。",
  },
  {
    name: "avoid-medium-as-link-bridge-subject",
    pattern: /(note|ブログ記事|ブログ|Qiita|Zenn)(?: の)?(?:解説|記事)?では、(この|その|以下)/,
    message: "外部リンク前で媒体名を急に主語にせず、直前の論点とリンク先が補う内容をつないでください。",
  },
  {
    name: "avoid-abstract-evaluation-ending",
    pattern: /(追いやすくなります|整理しやすくなります|見えます|分かりやすくなります|扱いやすいです|使いやすいです)/,
    message: "評価で閉じず、何が減る・何を分ける・何を判断できるのかを書いてください。",
  },
  {
    name: "avoid-anthropomorphic-distillation-visibility",
    pattern: /(教師側|生徒側).{0,40}(見られます|見られません|見えます|見えません)/,
    message: "自己蒸留ではモデルを人扱いせず、追加情報を条件にする分布として書いてください。",
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
    name: "cite-named-system-not-sentence-instructgpt",
    pattern: /InstructGPT (?:では|でも|の).*?\[\^[^\]]+\]/,
    message: "システム名に対応する引用は「InstructGPT[^...] では」のように置いてください。",
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
  {
    name: "avoid-mixed-method-series-label",
    pattern: /[A-Z][A-Z0-9-]* \/ [ぁ-んァ-ヶ一-龠ー]+ \/ [A-Z][A-Z0-9-]*/u,
    message: "略語列挙に日本語の一般名詞を混ぜず、粒度と表記を揃えてください。",
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

function nextNonEmptyLine(lines, startIndex) {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (lines[index].trim() !== "") {
      return lines[index];
    }
  }

  return "";
}

function headingText(line) {
  const match = /^##\s+(.+)$/.exec(line);
  return match ? match[1].trim() : null;
}

function nonEmptyLineCount(lines, startIndex, endIndex) {
  return lines
    .slice(startIndex + 1, endIndex)
    .filter((line) => line.trim() !== "")
    .length;
}

function isTableLine(line) {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isFormalMethodIntroductionWithoutCitation(line) {
  if (isTableLine(line) || line.startsWith("[^")) {
    return false;
  }

  const formalIntroPattern = /[A-Za-z][A-Za-z -]+ \([A-Z][A-Z0-9-]+\)(?:\[\^[^\]]+\])?\s+は/;
  const recommendedIntroPattern = /[ぁ-んァ-ヶ一-龠ー]+ \([A-Za-z][A-Za-z -]+; [A-Z][A-Z0-9-]+\)(?:\[\^[^\]]+\])?\s+は/u;
  const match = formalIntroPattern.exec(line) ?? recommendedIntroPattern.exec(line);

  if (!match) {
    return false;
  }

  return !line.slice(match.index, match.index + match[0].length + 20).includes("[^");
}

function previousNonEmptyLine(lines, startIndex) {
  for (let index = startIndex - 1; index >= 0; index -= 1) {
    if (lines[index].trim() !== "") {
      return { index, line: lines[index] };
    }
  }

  return { index: -1, line: "" };
}

function isPlainTextLine(line) {
  return line.trim() !== ""
    && !line.startsWith("#")
    && !line.startsWith("|")
    && !line.startsWith("!")
    && !line.startsWith("[^")
    && !line.startsWith("http")
    && !line.startsWith("<!--")
    && !line.startsWith("$$")
    && !line.startsWith("- ")
    && !/^\d+\.\s/.test(line);
}

function countMethodLikeItems(line) {
  const acronyms = line.match(/\b[A-Z][A-Z0-9-]{1,}\b/g) ?? [];
  const quotedTerms = line.match(/`[^`]+`/g) ?? [];
  const japaneseListItems = line.match(/[A-Za-z0-9ぁ-んァ-ヶ一-龠ー]+(?:、[A-Za-z0-9ぁ-んァ-ヶ一-龠ー]+){2,}/gu) ?? [];
  return acronyms.length + quotedTerms.length + japaneseListItems.length * 3;
}

function isEmptyTaxonomyRecapBeforeHeading(line) {
  if (!isPlainTextLine(line)) {
    return false;
  }

  return countMethodLikeItems(line) >= 3
    && /(分けられます|分類できます|整理できます|整理しやすくなります|見通せます|見えます)。$/.test(line)
    && !/(次|ここから|以降|ただし|一方|このため|そのため)/.test(line);
}

function report(file, lineNumber, name, message, line) {
  failed = true;
  console.error(`${file}:${lineNumber}: ${name}: ${message}`);
  console.error(`  ${line}`);
}

function reportLooseTopicShiftAfterExternalMaterial(file, lines) {
  for (let index = 0; index < lines.length; index += 1) {
    if (!/(以前|前).*(スライド|記事|資料).*(扱いました|まとめました)/.test(lines[index])) {
      continue;
    }

    if (/その後、関心は.*へ移りました/.test(lines[index])) {
      report(
        file,
        index + 1,
        "avoid-loose-topic-shift-after-external-material",
        "外部資料から本文へ移るときに、包含関係を確認せず別領域へ移ったように書かないでください。前の資料の範囲と本文の範囲を明示してください。",
        lines[index],
      );
    }
  }
}

function reportMarkdownSensitiveMathLines(file, lines) {
  let inMathBlock = false;

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() === "$$") {
      inMathBlock = !inMathBlock;
      continue;
    }

    if (!inMathBlock) {
      continue;
    }

    if (/^\s*[-=+](?:\s|$)/.test(lines[index])) {
      report(
        file,
        index + 1,
        "avoid-markdown-sensitive-math-line",
        "$$ ブロック内で行頭に単独の演算子を置くと、GitHub 上のレビューで Markdown として崩れて見えやすくなります。aligned の &= や {}- などへ寄せてください。",
        lines[index],
      );
    }

    if (/\\begin\{aligned\}/.test(lines[index])) {
      report(
        file,
        index + 1,
        "avoid-aligned-in-display-math",
        "GitHub の PR 表示で崩れる場合があるため、記事本文の $$ ブロックでは aligned 環境を避け、標準的な LaTeX 式として書いてください。",
        lines[index],
      );
    }

    if (/[<>]/.test(lines[index])) {
      report(
        file,
        index + 1,
        "avoid-markdown-sensitive-display-math",
        "GitHub の数式表示では display math 内の < や > も HTML と衝突して崩れることがあります。\\lt / \\gt を使ってください。",
        lines[index],
      );
    }
  }
}

function reportMarkdownSensitiveInlineMath(file, text) {
  const displayMathPattern = /\$\$\n[\s\S]*?\n\$\$/g;
  const masked = text.replace(displayMathPattern, (match) => " ".repeat(match.length));
  const inlineMathPattern = /(?<!\$)\$([^$\n]+?)\$(?!\$)/g;
  let match;

  while ((match = inlineMathPattern.exec(masked)) !== null) {
    if (!/[<>]/.test(match[1])) {
      continue;
    }

    const lineNumber = text.slice(0, match.index).split(/\r?\n/).length;
    report(
      file,
      lineNumber,
      "avoid-markdown-sensitive-inline-math",
      "GitHub の数式表示では inline math 内の < や > が HTML と衝突して崩れることがあります。\\lt / \\gt を使ってください。",
      match[0],
    );
  }
}

function summarySectionStart(lines) {
  return lines.findIndex((line) => line.trim() === "## まとめ");
}

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);

  reportLooseTopicShiftAfterExternalMaterial(file, lines);
  reportMarkdownSensitiveMathLines(file, lines);
  reportMarkdownSensitiveInlineMath(file, text);

  for (const check of checks) {
    for (let index = 0; index < lines.length; index += 1) {
      if (check.pattern.test(lines[index])) {
        report(file, index + 1, check.name, check.message, lines[index]);
      }
    }
  }

  const h2s = lines
    .map((line, index) => ({ index, text: headingText(line) }))
    .filter((heading) => heading.text !== null);

  for (let index = 0; index < h2s.length - 1; index += 1) {
    const current = h2s[index];
    const next = h2s[index + 1];

    if (
      current.text === "背景"
      && /全体像/.test(next.text)
      && nonEmptyLineCount(lines, current.index, next.index) <= 6
    ) {
      report(
        file,
        current.index + 1,
        "avoid-short-background-before-overview",
        "短い「背景」が直後の「全体像」と役割重複していないか確認し、必要なら統合してください。",
        lines[current.index],
      );
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^#{2,3}\s+/.test(lines[index])) {
      continue;
    }

    const previous = previousNonEmptyLine(lines, index);
    if (previous.index >= 0 && isEmptyTaxonomyRecapBeforeHeading(previous.line)) {
      report(
        file,
        previous.index + 1,
        "avoid-empty-section-ending-recap",
        "見出し直前で分類をなぞるだけの文になっています。次の節へ渡す差分がなければ削除してください。",
        previous.line,
      );
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (!isTableLine(lines[index]) || (index > 0 && isTableLine(lines[index - 1]))) {
      continue;
    }

    const previous = previousNonEmptyLine(lines, index);

    if (
      previous.line !== ""
      && /(並べます|対応させています|見ると早い|候補|こうなります|下の表|以下の表|手法名より)/.test(previous.line)
    ) {
      report(
        file,
        previous.index + 1,
        "avoid-table-author-instruction",
        "表の前置きが配置説明になっています。表が本文のどの論点を引き受けるのかを書いてください。",
        previous.line,
      );
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (isFormalMethodIntroductionWithoutCitation(lines[index])) {
      report(
        file,
        index + 1,
        "cite-formal-method-introduction",
        "本文で手法を正式名称つきで導入する箇所には引用を置いてください。表の引用だけで代用しないでください。",
        lines[index],
      );
    }
  }

  const summaryStart = summarySectionStart(lines);
  if (summaryStart >= 0) {
    for (let index = summaryStart + 1; index < lines.length; index += 1) {
      if (/^#{1,2}\s+/.test(lines[index])) {
        break;
      }

      if (/(最後は、|から考えます|見えるなら|作れます|先に決めるのがよいと思っています)/.test(lines[index])) {
        report(
          file,
          index + 1,
          "avoid-procedural-summary",
          "まとめを手順書調で閉じず、冒頭の動機へ戻して筆者の判断を書いてください。",
          lines[index],
        );
      }
    }
  }

  const bodyLines = bodyLinesWithoutFrontMatter(text);

  for (const acronym of acronymCitationChecks) {
    const pattern = new RegExp(`\\b${acronym}\\b`);

    for (let index = 0; index < bodyLines.length; index += 1) {
      const line = bodyLines[index];

      if (
        line.startsWith("[^")
        || line.startsWith("!")
        || line.startsWith("*")
        || nextNonEmptyLine(bodyLines, index).startsWith("!")
      ) {
        continue;
      }

      const match = pattern.exec(line);

      if (!match) {
        continue;
      }

      if (!hasNearbyFootnote(line, match.index)) {
        report(
          file,
          index + 1,
          "cite-first-acronym-use",
          "略語の本文初出では、正式名称と引用を同じ箇所に置いてください。",
          line,
        );
      }

      break;
    }
  }
}

if (failed) {
  process.exit(1);
}
