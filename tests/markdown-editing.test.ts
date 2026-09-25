import assert from "node:assert/strict";
import test from "node:test";
import { appendMarkdownBlock, editMarkdownSelection, getLatestNoteDraftContent, isSafeImageUrl, isNoteDraftDirty } from "../src/lib/markdownEditing";

test("appends inserted Markdown as a separate block for empty and populated notes", () => {
  assert.equal(appendMarkdownBlock("", "```mermaid\ngraph TD\n```"), "```mermaid\ngraph TD\n```\n");
  assert.equal(appendMarkdownBlock("# Note\n\nText\n", "```mermaid\ngraph TD\n```"), "# Note\n\nText\n\n```mermaid\ngraph TD\n```\n");
});

test("reads the latest visual draft by flushing before caller-side content changes", () => {
  let flushCount = 0;
  const content = getLatestNoteDraftContent("visual", "stale", {
    flush: () => {
      flushCount += 1;
      return "latest";
    },
  });

  assert.equal(content, "latest");
  assert.equal(flushCount, 1);
});

test("keeps the Markdown draft as the source of truth in Markdown mode", () => {
  const content = getLatestNoteDraftContent("markdown", "latest source", {
    flush: () => { throw new Error("visual editor must not be flushed"); },
  });

  assert.equal(content, "latest source");
});

test("formatting selected text preserves the surrounding Markdown exactly", () => {
  const source = "---\ntitle: Demo\n---\n\nคำก่อน คำเลือก คำหลัง\n```mermaid\ngraph TD\n A-->B\n```";
  const start = source.indexOf("คำเลือก");
  const result = editMarkdownSelection(source, start, start + "คำเลือก".length, "bold");
  assert.equal(result.text, source.replace("คำเลือก", "**คำเลือก**"));
  assert.equal(result.selectionStart, start + 2);
  assert.equal(result.selectionEnd, start + 2 + "คำเลือก".length);
});

test("toolbar inserts a Markdown image URL without changing other blocks", () => {
  const source = "# บันทึก\n\n$$\nx^2\n$$\n";
  const result = editMarkdownSelection(source, source.length, source.length, "image", "https://example.com/chart.png");
  assert.equal(result.text, `${source}![รูปภาพ](https://example.com/chart.png)`);
});

test("image URL accepts HTTPS and rejects local files or script URLs", () => {
  assert.equal(isSafeImageUrl("https://example.com/pic.png"), true);
  assert.equal(isSafeImageUrl("javascript:alert(1)"), false);
  assert.equal(isSafeImageUrl("file:///private/pic.png"), false);
  assert.equal(isSafeImageUrl("http://example.com/pic.png"), false);
});

test("draft guard detects title or body edits", () => {
  const saved = { title: "เดิม", content: "# เดิม" };
  assert.equal(isNoteDraftDirty(saved, saved), false);
  assert.equal(isNoteDraftDirty(saved, { ...saved, title: "ใหม่" }), true);
  assert.equal(isNoteDraftDirty(saved, { ...saved, content: "# ใหม่" }), true);
});

test("list formatting does not change the line after a selection ending in a newline", () => {
  const source = "first\nsecond\nthird";
  const result = editMarkdownSelection(source, 0, "first\n".length, "bullet");
  assert.equal(result.text, "- first\nsecond\nthird");
});

test("image URLs with parentheses remain one Markdown destination", () => {
  const result = editMarkdownSelection("", 0, 0, "image", "https://example.com/a(b).png");
  assert.equal(result.text, "![รูปภาพ](https://example.com/a%28b%29.png)");
});

test("image URLs with spaces are normalized before insertion", () => {
  const result = editMarkdownSelection("", 0, 0, "image", "https://example.com/my image.png");
  assert.equal(result.text, "![รูปภาพ](https://example.com/my%20image.png)");
});
