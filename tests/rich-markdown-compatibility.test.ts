import assert from "node:assert/strict";
import test from "node:test";
import { MarkdownManager } from "@tiptap/markdown";
import { getRichEditorCompatibility, isSupportedRichEditorLinkUrl, serializeRichEditorMarkdown } from "../src/lib/richEditorCompatibility";
import { createRichNoteEditorExtensions } from "../src/lib/richNoteEditorExtensions";

const markdownManager = new MarkdownManager({
  extensions: createRichNoteEditorExtensions("en"),
});

test("accepts common Thai and English note Markdown", () => {
  const markdown = [
    "# Meeting notes",
    "",
    "ข้อความ **สำคัญ** และ *ความคิด* ~~เก่า~~ [ลิงก์](https://example.com)",
    "",
    "- รายการหนึ่ง",
    "",
    "รายการที่ต้องทำ:",
    "",
    "- [ ] งานที่ยังไม่เสร็จ",
    "- [x] งานที่เสร็จแล้ว",
    "",
    "> ข้อความอ้างอิง",
    "",
    "---",
  ].join("\n");

  assert.deepEqual(getRichEditorCompatibility(markdown), { supported: true });
});

test("round-trips basic Markdown through the visual editor schema", () => {
  const markdown = [
    "# Meeting notes",
    "",
    "ข้อความ **สำคัญ** และ *idea* ~~old~~ [เอกสาร](https://example.com)",
    "",
    "## หัวข้อสอง",
    "",
    "### Third level",
    "",
    "- รายการ",
    "",
    "รายการที่ต้องทำ:",
    "",
    "- [ ] งานที่ยังไม่เสร็จ",
    "- [x] งานที่เสร็จแล้ว",
    "",
    "> ข้อความอ้างอิง",
    "",
    "---",
  ].join("\n");
  const document = markdownManager.parse(markdown);
  const serialized = markdownManager.serialize(document);

  assert.equal(serialized, markdown);
  assert.deepEqual(markdownManager.parse(serialized), document);
});

test("ignores frontmatter when checking a note body", () => {
  const markdown = "---\ntitle: Demo\ntags: [work]\n---\n\n# บันทึก\nข้อความ";

  assert.deepEqual(getRichEditorCompatibility(markdown), { supported: true });
});

test("allows relative note links but routes unsafe URL schemes to Markdown mode", () => {
  assert.deepEqual(getRichEditorCompatibility("[note](../related.md)"), { supported: true });
  assert.deepEqual(getRichEditorCompatibility("[unsafe](javascript:alert%281%29)"), { supported: false, reason: "advanced" });
  assert.equal(isSupportedRichEditorLinkUrl("#section"), true);
  assert.equal(isSupportedRichEditorLinkUrl("mailto:person@example.com"), true);
  assert.equal(isSupportedRichEditorLinkUrl("javascript:alert(1)"), false);
});

test("keeps the original Markdown byte-for-byte when the rich document was not edited", () => {
  const original = "---\r\ntitle: Demo\r\ncolor: sage\r\n---\r\n\r\n#   Heading\r\n\r\nBody";
  const document = JSON.stringify({ type: "doc", content: [] });

  assert.equal(serializeRichEditorMarkdown({
    originalContent: original,
    bodyMarkdown: "# Heading\n\nBody",
    baselineDocument: document,
    currentDocument: document,
  }), original);
});

test("keeps note frontmatter when an edited rich document is serialized", () => {
  const original = "---\ntitle: Demo\ntags: [work]\ncolor: sage\n---\n\n# Old";

  assert.equal(serializeRichEditorMarkdown({
    originalContent: original,
    bodyMarkdown: "# New",
    baselineDocument: "old document",
    currentDocument: "new document",
  }), "---\ntitle: Demo\ntags: [work]\ncolor: sage\n---\n\n# New");
});

test("routes notes with unsupported Markdown to the source editor", () => {
  const cases = [
    ["| name | value |\n| --- | --- |\n| A | B |", "table"],
    ["![diagram](https://example.com/diagram.png)", "image"],
    ["```mermaid\ngraph TD\n  A-->B\n```", "code"],
    ["$$\nx^2\n$$", "math"],
    ["<details><summary>More</summary>Text</details>", "html"],
    ["#### Heading four", "advanced"],
    ["3. Start at three", "advanced"],
    ["- plain item\n\n- [ ] task item", "advanced"],
    ["[Reference](https://example.com \"title\")", "advanced"],
  ] as const;

  for (const [markdown, reason] of cases) {
    assert.deepEqual(getRichEditorCompatibility(markdown), { supported: false, reason });
  }
});
