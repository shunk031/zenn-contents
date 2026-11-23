#!/usr/bin/env node

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { parse: parseMarkdown } = require("@textlint/markdown-to-ast");

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
    pattern: /(学習に戻せるデータ|データを学習に戻す|応答を学習に戻す|どの形のデータへ変換できるか|目的関数は変わります)/,
    message: "データを学習に戻すという曖昧な比喩ではなく、データ形式と必要な構成要素を書いてください。",
  },
  {
    name: "avoid-vague-signal-location-metaphor",
    pattern: /(信号が入る場所|信号がどこに入る|どこに信号を入れ|途中の文脈まで信号を入れる)/,
    message: "教師信号を空間比喩だけで説明せず、訓練データの形、評価する出力の単位、必要なモデルや更新ループを書いてください。",
  },
  {
    name: "avoid-empty-classification-signpost",
    pattern: /(手法名ではなく[^。\n]*(?:分類して|分類し|読|見)|[^。\n]*(?:軸|粒度|場所|観点)[^。\n]*(?:分類して|分類し)[^。\n]*(?:読|見)|訓練データの形が変わると、必要なモデルや更新ループも変わります)/,
    message: "分類軸の宣言だけで済ませず、データ形式、評価対象、必要なモデル、更新ループのどれが変わるのかを書いてください。",
  },
  {
    name: "avoid-reader-error-framing",
    pattern: /(取り違えやすい|取り違えないように|見誤りやすい|間違えやすい)/,
    message: "導入で読者のミスを指摘する形にせず、データ形式や訓練構成の関係として書いてください。",
  },
  {
    name: "avoid-introspective-scope-transition",
    pattern: /(気になってきます|考えたいところです|そこを考えると|そうなると、手元で動かせるモデルを前提に考えたくなります)/,
    message: "導入を筆者の内面描写でつながず、問いとして残すか次の射程説明へ吸収してください。",
  },
  {
    name: "avoid-false-contrast-open-weight",
    pattern: /一方で、open-weight な/,
    message: "closed LLM と open-weight LLM の話が対立していないなら「一方で」でつながず、同じ動機へ向かう接続にしてください。",
  },
  {
    name: "avoid-uncertain-lineage-same-as",
    pattern: /(ChatGPT (?:では|には).{0,40}InstructGPT.{0,40}同じく|InstructGPT.{0,40}と同じく.{0,40}ChatGPT)/,
    message: "ChatGPT と InstructGPT の関係を「同じく」と断定せず、応用されていると言われている程度に弱めてください。",
  },
  {
    name: "avoid-catalog-like-intro-model-list",
    pattern: /(Qwen3\[\^|Qwen3 以降\[\^).{0,120}(Gemma 4\[\^|GLM-5\.2\[\^)/,
    message: "導入でモデル名をカタログのように並べず、主張を短く書いて引用を添えてください。",
  },
  {
    name: "avoid-repair-framing-at-method-intro",
    pattern: /(崩れ|不足).{0,20}直すなら/,
    message: "手法の章冒頭を後付けの修理として書かず、データ形式と学習対象から入ってください。",
  },
  {
    name: "avoid-mechanical-notation-preface",
    pattern: /以降の式では、.*次の記号で表します/,
    message: "記法章の前置きは作業説明で済ませず、複数の手法で同じ記号を使うために一度まとめる、という理由を書いてください。",
  },
  {
    name: "avoid-mixed-bare-noun-list-in-notation-preface",
    pattern: /(模範応答、報酬、比較、蒸留|報酬、比較、蒸留)/,
    message: "記法章の前置きで粒度の違う裸名詞を並べず、式で扱う対象として並べてください。",
  },
  {
    name: "avoid-slogan-like-technical-transition",
    pattern: /なら、[^。\n]*(?:したい|見たい|使いたい|入れたい)。/,
    message: "章冒頭でキャッチコピー調の短文を置かず、次の手法が使うデータ、分布、目的関数へ直接入ってください。",
  },
  {
    name: "avoid-vague-technical-causality",
    pattern: /(変わりすぎます|絡みます|モデルを調整します|利得を \$A_t\$、クリップ幅を \$\\epsilon\$ とします|で欲しいのは)/,
    message: "技術説明を曖昧な動詞や変数名の列挙で済ませず、どの量が何を意味し、どの構成がなぜ重いのかを書いてください。",
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
    name: "avoid-unverified-link-visual-claim",
    pattern: /(以下の解説|以下の記事|リンク先|記事).{0,40}(図で分けています|図で示しています|図解しています|図示しています)/,
    message: "外部リンク先の図や表示形式に関する説明は、リンク先を確認した場合だけ書いてください。確認していないなら削除してください。",
  },
  {
    name: "avoid-medium-as-link-bridge-subject",
    pattern: /(note|ブログ記事|ブログ|Qiita|Zenn)(?: の)?(?:解説|記事)?では、(この|その|以下)/,
    message: "外部リンク前で媒体名を急に主語にせず、直前の論点とリンク先が補う内容をつないでください。",
  },
  {
    name: "avoid-abstract-evaluation-ending",
    pattern: /(追いやすくなります|整理しやすくなります|見えます|分かりやすくなります|扱いやすいです|使いやすいです|[^。\n]{1,80}は(?:簡潔|強固)です)/,
    message: "評価で閉じず、何が減る・何を分ける・何を判断できるのかを書いてください。",
  },
  {
    name: "avoid-vague-cleanup-safety",
    pattern: /安全な片付け/,
    message: "安全性を形容するだけでなく、何をどう片付けるかを書いてください。",
  },
  {
    name: "avoid-vague-safe-termination",
    pattern: /安全に終了します/,
    message: "安全性を評価するだけでなく、終了時の処理や結果を具体的に書いてください。",
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

function h3HeadingText(line) {
  const match = /^###\s+(.+)$/.exec(line);
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

function collectMarkdownNodes(node, output = []) {
  output.push(node);
  for (const child of node.children ?? []) {
    collectMarkdownNodes(child, output);
  }
  return output;
}

function commentsInNode(text, node) {
  const [nodeStart, nodeEnd] = node.range ?? [];
  if (!Number.isInteger(nodeStart) || !Number.isInteger(nodeEnd)) {
    return [];
  }

  const raw = text.slice(nodeStart, nodeEnd);
  const comments = [];
  for (const match of raw.matchAll(/<!--[\s\S]*?-->/g)) {
    const start = nodeStart + match.index;
    const end = start + match[0].length;
    comments.push({
      start,
      end,
      value: match[0].slice(4, -3),
      inFrontMatter: node.type === "Yaml",
    });
  }
  return comments;
}

function createMarkdownContext(text) {
  const ast = parseMarkdown(text);
  const nodes = collectMarkdownNodes(ast);
  const codeBlocks = nodes.filter((node) => node.type === "CodeBlock");
  const htmlNodes = nodes.filter((node) => node.type === "Html" || node.type === "HtmlBlock");
  const yamlNodes = nodes.filter((node) => node.type === "Yaml");
  const comments = [
    ...htmlNodes.flatMap((node) => commentsInNode(text, node)),
    // Markdown front matter is parsed as YAML, so textlint comments in a title
    // are recovered from that AST node to preserve the existing title behavior.
    ...yamlNodes.flatMap((node) => commentsInNode(text, node)),
  ].filter((comment) => !codeBlocks.some((node) => (
    comment.start >= node.range[0] && comment.end <= node.range[1]
  ))).sort((a, b) => a.start - b.start);
  const lineStarts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") {
      lineStarts.push(index + 1);
    }
  }

  return {
    ast,
    codeBlocks,
    htmlNodes,
    listItems: nodes.filter((node) => node.type === "ListItem"),
    inlineCode: nodes.filter((node) => node.type === "Code"),
    comments,
    lineStarts,
  };
}

function lineIndexAtOffset(lineStarts, offset) {
  let lower = 0;
  let upper = lineStarts.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (lineStarts[middle] <= offset) {
      lower = middle + 1;
    } else {
      upper = middle;
    }
  }
  return Math.max(0, lower - 1);
}

function mergedRanges(ranges) {
  const sorted = ranges
    .filter(([start, end]) => Number.isInteger(start) && Number.isInteger(end) && start < end)
    .sort((a, b) => a[0] - b[0]);
  const merged = [];

  for (const [start, end] of sorted) {
    const previous = merged.at(-1);
    if (previous && start <= previous[1]) {
      previous[1] = Math.max(previous[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  return merged;
}

function maskSourceRanges(text, ranges) {
  const merged = mergedRanges(ranges);
  let result = "";
  let cursor = 0;

  for (const [start, end] of merged) {
    result += text.slice(cursor, start);
    result += text.slice(start, end).replace(/[^\r\n]/g, " ");
    cursor = end;
  }

  return result + text.slice(cursor);
}

function isCommentOnlyHtmlNode(text, node) {
  const raw = text.slice(node.range[0], node.range[1]);
  return raw.replace(/<!--[\s\S]*?-->/g, "").trim() === "";
}

function reportHtmlCommentsBetweenListItems(file, text, lines, context) {
  const isListNode = (node) => node.type === "List" || node.type === "ListItem";

  function reportBetweenListSiblings(children) {
    for (let index = 0; index < children.length; index += 1) {
      const previous = children[index];
      if (!isListNode(previous)) {
        continue;
      }

      const comments = [];
      let nextIndex = index + 1;
      while (
        nextIndex < children.length
        && (children[nextIndex].type === "Html" || children[nextIndex].type === "HtmlBlock")
        && isCommentOnlyHtmlNode(text, children[nextIndex])
      ) {
        comments.push(children[nextIndex]);
        nextIndex += 1;
      }

      const next = children[nextIndex];
      if (comments.length > 0 && next?.type === previous.type) {
        const commentLinesAreAdjacent = comments.every((comment, commentIndex) => {
          const following = comments[commentIndex + 1] ?? next;
          const gap = text.slice(comment.range[1], following.range[0]);
          return /^[ \t]*\r?\n[ \t]*$/u.test(gap)
            && comment.loc.start.line === comment.loc.end.line;
        });
        const lineIndex = comments[0].loc.start.line - 1;
        const lineStart = context.lineStarts[lineIndex];
        const standalone = text.slice(lineStart, comments[0].range[0]).trim() === "";
        if (commentLinesAreAdjacent && standalone) {
          report(
            file,
            lineIndex + 1,
            "avoid-html-comment-between-list-items",
            "箇条書きの項目の間に HTML コメントがあります。コメントは箇条書き全体の前後に置いてください。",
            lines[lineIndex],
          );
        }
      }

      if (previous.children) {
        reportBetweenListSiblings(previous.children);
      }
    }
  }

  reportBetweenListSiblings(context.ast.children ?? []);
}

function listItemContainsOnlyComment(text, listItem, comment) {
  function isOnlyComment(node) {
    if (node.type === "Html" || node.type === "HtmlBlock") {
      return isCommentOnlyHtmlNode(text, node)
        && comment.start >= node.range[0]
        && comment.end <= node.range[1];
    }
    return node.children?.length > 0 && node.children.every(isOnlyComment);
  }

  return listItem.children?.length === 1 && isOnlyComment(listItem.children[0]);
}

function reportHeadingImmediatelyFollowedBySubheading(file, text, lines, context) {
  function reportAdjacentHeadings(children) {
    for (let index = 0; index < children.length; index += 1) {
      const heading = children[index];
      if (heading.type === "Header") {
        let nextIndex = index + 1;
        while (
          nextIndex < children.length
          && (children[nextIndex].type === "Html" || children[nextIndex].type === "HtmlBlock")
          && isCommentOnlyHtmlNode(text, children[nextIndex])
        ) {
          nextIndex += 1;
        }

        const nextHeading = children[nextIndex];
        if (nextHeading?.type === "Header" && nextHeading.depth > heading.depth) {
          const lineIndex = heading.loc.start.line - 1;
          report(
            file,
            lineIndex + 1,
            "add-lead-before-subheading",
            "見出しの直後に子見出しを続けず、節の内容を示す短いリード文を置いてください。",
            lines[lineIndex],
          );
        }
      }

      if (children[index].children) {
        reportAdjacentHeadings(children[index].children);
      }
    }
  }

  // The AST keeps list and list-item child structure while this walk checks
  // heading siblings at each Markdown block level.
  reportAdjacentHeadings(context.ast.children ?? []);
}

function reportStandaloneTextlintComments(file, text, lines, context) {
  const directive = /^\s*textlint-(?:disable|enable)(?=\s|$)[\s\S]*$/;
  const codeRanges = context.codeBlocks.map((node) => node.range);

  for (const comment of context.comments) {
    if (comment.inFrontMatter || !directive.test(comment.value)) {
      continue;
    }

    const lineIndex = lineIndexAtOffset(context.lineStarts, comment.start);
    if (lineIndexAtOffset(context.lineStarts, comment.end) !== lineIndex) {
      continue;
    }
    const lineStart = text.lastIndexOf("\n", comment.start - 1) + 1;
    let lineEnd = text.indexOf("\n", comment.end);
    if (lineEnd < 0) {
      lineEnd = text.length;
    }
    const line = text.slice(lineStart, lineEnd).replace(/\r$/, "");
    const startColumn = comment.start - lineStart;
    const endColumn = comment.end - lineStart;
    const prefix = line.slice(0, startColumn);
    const suffix = line.slice(endColumn);
    const standalone = (
      /^(?:[ \t]*>[ \t]?)*[ \t]*$/.test(prefix)
      && /^[ \t]*$/.test(suffix)
    ) || context.listItems.some((listItem) => (
      listItemContainsOnlyComment(text, listItem, comment)
    ));
    const inCode = codeRanges.some(([start, end]) => comment.start >= start && comment.end <= end);

    if (!standalone || inCode) {
      continue;
    }

    report(
      file,
      lineIndex + 1,
      "avoid-standalone-textlint-comment",
      "textlint の disable/enable コメントは独立行にせず、対象段落のインラインに置いてください。",
      lines[lineIndex],
    );
  }
}

function stripUrls(text) {
  return text.replace(/(?:https?:\/\/|www\.)\S+/giu, (match) => " ".repeat(match.length));
}

function stripMarkdownFormatting(text) {
  return text
    .replace(/(?<!\\)(\*\*|__|~~)(.+?)\1/gu, "$2")
    .replace(/(?<!\\)([*_])([^*_]+?)\1/gu, "$2");
}

function textlintSpacingDisabledRanges(text, context) {
  const spacingRule = "ja-spacing/ja-space-between-half-and-full-width";
  const comments = context.comments;
  let allRulesDisableCount = 0;
  let spacingRuleDisableCount = 0;
  const ranges = [];
  let cursor = 0;

  for (const comment of comments) {
    if (allRulesDisableCount > 0 || spacingRuleDisableCount > 0) {
      ranges.push([cursor, comment.start]);
    }

    const directive = /^\s*textlint-(disable|enable)(?=$|\s)([\s\S]*?)\s*$/.exec(comment.value);
    if (directive) {
      const descriptionIndex = directive[2].indexOf("--");
      const ruleNames = (descriptionIndex < 0 ? directive[2] : directive[2].slice(0, descriptionIndex))
        .split(/[\s,]+/)
        .filter(Boolean);
      if (ruleNames.length === 0) {
        if (directive[1] === "disable") {
          allRulesDisableCount += 1;
        } else {
          allRulesDisableCount = 0;
          spacingRuleDisableCount = 0;
        }
      } else if (ruleNames.includes(spacingRule)) {
        spacingRuleDisableCount = directive[1] === "disable"
          ? spacingRuleDisableCount + 1
          : Math.max(0, spacingRuleDisableCount - 1);
      }
    }
    cursor = comment.end;
  }

  if (allRulesDisableCount > 0 || spacingRuleDisableCount > 0) {
    ranges.push([cursor, text.length]);
  }

  return mergedRanges(ranges);
}

function reportHalfFullWidthSpaceOutsideTextlint(file, text, lines, context) {
  const japaneseCharacter = "\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Han}";
  const halfFullWidthBoundary = new RegExp(`(?:[A-Za-z0-9][${japaneseCharacter}]|[${japaneseCharacter}][A-Za-z0-9])`, "u");
  const disabledRanges = textlintSpacingDisabledRanges(text, context);
  const auditLines = maskSourceRanges(text, [
    ...context.codeBlocks.map((node) => node.range),
    ...context.comments.map(({ start, end }) => [start, end]),
    ...context.inlineCode.map((node) => node.range),
    ...disabledRanges,
  ]).split(/\r?\n/);
  const reportedLines = new Set();

  function reportIfNeeded(lineIndex, text) {
    if (reportedLines.has(lineIndex) || !halfFullWidthBoundary.test(stripUrls(text))) {
      return;
    }

    reportedLines.add(lineIndex);
    report(
      file,
      lineIndex + 1,
      "half-full-width-space-outside-textlint",
      "textlint が見ないタイトル、見出し、リンク文字列でも、半角英数字と全角文字の間に半角スペースを入れてください。",
      lines[lineIndex],
    );
  }

  if (lines[0] === "---") {
    const closingIndex = lines.findIndex((line, index) => index > 0 && line === "---");
    if (closingIndex >= 0) {
      const titleIndex = lines.findIndex((line, index) => index > 0 && index < closingIndex && /^title:\s*/.test(line));
      if (titleIndex >= 0) {
        const titleValue = /^title:\s*(.*)$/.exec(auditLines[titleIndex])?.[1] ?? "";
        reportIfNeeded(titleIndex, titleValue);
      }
    }
  }

  const inlineLinkPattern = /(?<!!)(?<!\\)\[([^\]]+)\]\([^)]*\)/g;
  let firstBodyLine = 0;

  if (lines[0] === "---") {
    const closingIndex = lines.findIndex((line, index) => index > 0 && line === "---");
    if (closingIndex >= 0) {
      firstBodyLine = closingIndex + 1;
    }
  }

  for (let index = firstBodyLine; index < auditLines.length; index += 1) {
    const heading = /^ {0,3}#{1,6}(?:\s+|$)(.*)$/.exec(auditLines[index]);
    if (heading) {
      reportIfNeeded(index, stripMarkdownFormatting(heading[1]));
    }

    for (const match of auditLines[index].matchAll(inlineLinkPattern)) {
      reportIfNeeded(index, stripMarkdownFormatting(match[1]));
    }
  }
}

function reportFootnoteReferencesInMermaid(file, lines, context) {
  for (const codeBlock of context.codeBlocks) {
    if (codeBlock.lang?.toLowerCase() !== "mermaid") {
      continue;
    }

    const contentLines = codeBlock.value.split(/\r?\n/);
    for (let contentIndex = 0; contentIndex < contentLines.length; contentIndex += 1) {
      if (!/\[\^[^\]]+\](?!:)/.test(contentLines[contentIndex])) {
        continue;
      }

      const lineNumber = codeBlock.loc.start.line + contentIndex + 1;
      report(
        file,
        lineNumber,
        "avoid-footnote-reference-in-mermaid",
        "Mermaid ブロック内の脚注参照は本文上の引用として読めないため、図の前後の本文へ移してください。",
        lines[lineNumber - 1],
      );
    }
  }
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

function reportPrematureWinnerLoserTerms(file, lines) {
  const notationIndex = lines.findIndex((line) => /^##\s+共通の記法\s*$/.test(line));
  if (notationIndex < 0) {
    return;
  }

  for (let index = 0; index < notationIndex; index += 1) {
    if (!/(勝ち応答|負け応答)/.test(lines[index])) {
      continue;
    }

    report(
      file,
      index + 1,
      "avoid-premature-winner-loser-terms",
      "記法導入前に勝ち応答 / 負け応答を出さず、応答同士の比較や選好ペアとして書いてください。",
      lines[index],
    );
  }
}

function reportRepeatedScopeDeclarations(file, lines) {
  const scopePattern = /(このメモでは|この記事では|本稿では|本記事では)/;

  for (let index = 0; index < lines.length; index += 1) {
    if (!scopePattern.test(lines[index])) {
      continue;
    }

    for (let nextIndex = index + 1; nextIndex <= Math.min(index + 4, lines.length - 1); nextIndex += 1) {
      if (!scopePattern.test(lines[nextIndex])) {
        continue;
      }

      report(
        file,
        nextIndex + 1,
        "avoid-repeated-scope-declarations",
        "導入で「このメモでは」「この記事では」などの射程宣言を近接して重ねないでください。役割を分け、射程宣言は 1 箇所へ寄せてください。",
        lines[nextIndex],
      );
    }
  }
}

function reportFloatingQuestionParagraph(file, lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!/^.+どう.+か。$/.test(line)) {
      continue;
    }

    const previous = lines[index - 1]?.trim() ?? "";
    const next = lines[index + 1]?.trim() ?? "";
    if (previous !== "" || next !== "") {
      continue;
    }

    report(
      file,
      index + 1,
      "avoid-floating-question-paragraph",
      "問いだけの独立段落を残さず、前段へ吸収するか、直後で何を読むのかまで同じ段落でつなげてください。",
      lines[index],
    );
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

function reportPeerMethodHeadingMismatch(file, lines) {
  const peerGroups = [
    ["GRPO", "MAXRL"],
  ];

  const h2Indexes = lines
    .map((line, index) => ({ index, text: headingText(line) }))
    .filter((heading) => heading.text !== null)
    .map((heading) => heading.index);

  for (let sectionNumber = 0; sectionNumber < h2Indexes.length; sectionNumber += 1) {
    const startIndex = h2Indexes[sectionNumber];
    const endIndex = h2Indexes[sectionNumber + 1] ?? lines.length;
    const sectionLines = lines.slice(startIndex + 1, endIndex);
    const sectionText = sectionLines.join("\n");
    const h3Headings = new Set(
      sectionLines
        .map((line) => h3HeadingText(line))
        .filter((text) => text !== null),
    );

    for (const peerGroup of peerGroups) {
      const presentTerms = peerGroup.filter((term) => new RegExp(`\\b${term}\\b`).test(sectionText));
      if (presentTerms.length < peerGroup.length) {
        continue;
      }

      const headingTerms = peerGroup.filter((term) => h3Headings.has(term));
      if (headingTerms.length === 0 || headingTerms.length === peerGroup.length) {
        continue;
      }

      report(
        file,
        startIndex + 1,
        "avoid-peer-method-heading-mismatch",
        `${peerGroup.join(" / ")} のように同じ親章で並ぶ具体手法は、片方だけ小見出しにせず見出し粒度をそろえてください。`,
        lines[startIndex],
      );
    }
  }
}

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const markdown = createMarkdownContext(text);

  reportHeadingImmediatelyFollowedBySubheading(file, text, lines, markdown);
  reportStandaloneTextlintComments(file, text, lines, markdown);
  reportLooseTopicShiftAfterExternalMaterial(file, lines);
  reportPrematureWinnerLoserTerms(file, lines);
  reportRepeatedScopeDeclarations(file, lines);
  reportFloatingQuestionParagraph(file, lines);
  reportMarkdownSensitiveMathLines(file, lines);
  reportMarkdownSensitiveInlineMath(file, text);
  reportHalfFullWidthSpaceOutsideTextlint(file, text, lines, markdown);
  reportHtmlCommentsBetweenListItems(file, text, lines, markdown);
  reportFootnoteReferencesInMermaid(file, lines, markdown);
  reportPeerMethodHeadingMismatch(file, lines);

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
