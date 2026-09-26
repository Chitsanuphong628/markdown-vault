import assert from "node:assert/strict";
import test from "node:test";
import { parseGfmAlert, parseMarkdownBlocks, prepareMarkdownForEditor, serializeWithOriginalBlocks } from "../src/lib/markdownBlocks";

test("classifies editable advanced Markdown blocks without treating them as plain text", () => {
  const source = [
    "ข้อความก่อน",
    "",
    "| ชื่อ | ค่า |",
    "| --- | --- |",
    "| ไทย | 1 |",
    "",
    "```ts",
    "const answer = 42;",
    "```",
    "",
    "```mermaid",
    "graph TD\n  A-->B",
    "```",
    "",
    "$$",
    "x^2 + 1",
    "$$",
    "",
    "![ภาพ](https://example.com/image.png)",
  ].join("\n");

  assert.deepEqual(parseMarkdownBlocks(source).map(block => block.kind), [
    "richText", "table", "code", "mermaid", "math", "image",
  ]);
});

test("replaces unsupported HTML with a reversible editor placeholder", () => {
  const source = "ก่อน\n\n<details data-x=\"ไทย\"><summary>More</summary>body</details>\n\nหลัง";
  const prepared = prepareMarkdownForEditor(source);

  assert.match(prepared.markdown, /:::nota-opaque-v1 /);
  assert.equal(prepared.blocks.find(block => block.kind === "opaque")?.source,
    "<details data-x=\"ไทย\"><summary>More</summary>body</details>");
  assert.equal(prepared.blocks.map(block => block.source).join("\n\n"), source);
});

test("keeps GitHub Markdown alerts as independently editable blocks", () => {
  const alertSource = "> [!WARNING]\n> Keep **important** details visible.\n>\n> Add a second paragraph.";
  const source = `Before the alert.\n\n${alertSource}\n\nAfter the alert.`;
  const blocks = parseMarkdownBlocks(source);
  const alert = blocks.find(block => block.source === alertSource);

  assert.equal(alert?.kind, "opaque");
  assert.equal(alert?.reason, "gfm-alert");
  assert.deepEqual(blocks.map(block => block.kind), ["richText", "opaque", "richText"]);

  const prepared = prepareMarkdownForEditor(source);
  assert.equal(prepared.blocks.find(block => block.source === alertSource)?.reason, "gfm-alert");
  assert.match(prepared.markdown, /:::nota-opaque-v1 /);
});

test("recognizes the five GFM alert labels and keeps their formatted body", () => {
  const labels = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const;
  for (const type of labels) {
    const parsed = parseGfmAlert(`> [!${type.toLowerCase()}]\n> First **bold** paragraph.\n>\n> Second paragraph.`);
    assert.deepEqual(parsed, {
      type,
      body: "First **bold** paragraph.\n\nSecond paragraph.",
    });
  }

  assert.equal(parseGfmAlert("> [!NOTICE]\n> Not a supported GitHub alert."), null);
  assert.equal(parseGfmAlert("> [!NOTE] inline text\n> Not the standalone alert marker."), null);
});

test("classifies H4 headings and lists that start later as normal editable blocks", () => {
  const source = "#### Deep heading\n\n3. Numbered entry\n4. Next entry";
  const blocks = parseMarkdownBlocks(source);
  const prepared = prepareMarkdownForEditor(source);

  assert.deepEqual(blocks.map(block => block.kind), ["richText", "richText"]);
  assert.equal(blocks[0]?.source, "#### Deep heading");
  assert.equal(blocks[1]?.source, "3. Numbered entry\n4. Next entry");
  assert.equal(prepared.markdown, source);
});

test("retains original offsets and raw separators for each block", () => {
  const source = "# หัวข้อ\r\n\r\nข้อความ  เดิม\r\n";
  const blocks = parseMarkdownBlocks(source);

  assert.equal(blocks[0]?.source, "# หัวข้อ");
  assert.equal(blocks[1]?.source, "ข้อความ  เดิม");
  assert.equal(source.slice(blocks[0]!.end, blocks[1]!.start), "\r\n\r\n");
});

test("prepares inline and block math as reversible visual editor nodes", () => {
  const prepared = prepareMarkdownForEditor("ก่อน $x^2$ หลัง\n\n$$\ny = mx + b\n$$");

  assert.match(prepared.markdown, /\[\[nota-math-inline-v1:/);
  assert.match(prepared.markdown, /:::nota-math-block-v1 /);
});

test("preserves untouched source blocks byte-for-byte when nearby text changes", () => {
  const originalBody = "#   Heading\n\n```ts\nconst  x = 1;\n```\n";
  const baselineDocument = {
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Heading" }] },
      { type: "codeBlock", attrs: { language: "ts" }, content: [{ type: "text", text: "const  x = 1;" }] },
    ],
  };
  const currentDocument = {
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Changed" }] },
      baselineDocument.content[1]!,
    ],
  };
  const result = serializeWithOriginalBlocks({
    originalBody,
    baselineDocument,
    currentDocument,
    serializeDocument: document => document.content[0]?.type === "heading" ? "# Changed" : "",
  });

  assert.equal(result, "# Changed\n\n```ts\nconst  x = 1;\n```\n");
});
