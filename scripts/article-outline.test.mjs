import assert from "node:assert/strict";
import { extractOutline } from "./article-outline.mjs";
import test from "node:test";

test("extracts prose openings and skips Markdown blocks", () => {
  const outline = extractOutline([
    "---", "title: Front matter", "---", "# Main heading",
    "First sentence. Second sentence.", "", "One sentence.",
    "```md", "## Code heading", "Code sentence.", "```",
    "- List sentence.", "Head A | Head B", "--- | ---", "row | value",
    "![image](image.png)", "Inline image ![image](image.png) remains.",
    "https://example.com/card", "[^note]: 脚注の定義です。",
    "> Quoted sentence.", "Lazy quoted continuation.",
    "", "Use e.g. this method. It works.", "## Next heading", "Last sentence.",
  ].join("\n"));

  assert.deepEqual(outline, [
    "# Main heading",
    "  First sentence.",
    "  [1文] One sentence.",
    "  [1文] Inline image remains.",
    "  Use e.g. this method.",
    "## Next heading",
    "  [1文] Last sentence.",
  ]);
});
