import assert from "node:assert/strict";
import test from "node:test";
import { parseLivePreview, previewIsActive } from "../src/modules/content/shared/livePreview";

test("live preview uses whole-note references and excludes frontmatter from body blocks", () => {
  const source = "---\ncolor: sage\ncustom: keep\n---\n\n# Heading\n\n[Link][ref] and footnote[^1]\n\n[ref]: https://example.com\n\n[^1]: Definition\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n";
  const result = parseLivePreview(source);
  assert.equal(result.frontmatterEnd, source.indexOf("# Heading") - 1);
  assert.equal(result.context.length, 2);
  assert.equal(result.blocks.find(block => block.node.type === "table")?.from, source.indexOf("| A"));
  assert.ok(result.inline.some(item => item.node.type === "linkReference"));
  assert.ok(result.inline.some(item => item.node.type === "footnoteReference"));
});

test("a selection touching a complex block reveals the complete block", () => {
  const parsed = parseLivePreview("Before\n\n$$\nx^2\n$$\n\nAfter");
  const block = parsed.blocks.find(block => block.node.type === "math")!;
  assert.equal(previewIsActive(block, [{ from: block.from + 4, to: block.from + 4 }]), true);
  assert.equal(previewIsActive(block, [{ from: 0, to: 6 }]), false);
  assert.equal(previewIsActive(block, [{ from: 0, to: block.to + 2 }]), true);
});

test("whole-note footnote numbers follow first-reference order and definitions preview as blocks", () => {
  const parsed = parseLivePreview("first[^b], second[^a], repeat[^b]\n\n[^a]: Alpha\n\n[^b]: Beta");
  assert.deepEqual([...parsed.footnoteNumbers], [["b", 1], ["a", 2]]);
  assert.equal(parsed.blocks.filter(block => block.node.type === "footnoteDefinition" && block.widget).length, 2);
});

test("ordered and nested checklists expose the exact original marker position", () => {
  const source = "1. [ ] numbered\n2. [x] done\n\n- parent\n  - [ ] child";
  const parsed = parseLivePreview(source);
  assert.deepEqual(parsed.tasks.map(task => [source[task.marker], task.checked]), [[" ", false], ["x", true], [" ", false]]);
});

test("advanced blocks preview while unknown HTML remains editable source", () => {
  const source = "```ts\nconst  x = 1;\n```\n\n```mermaid\ngraph TD\nA-->B\n```\n\n![image](https://example.com/a.png)\n\n$$\nx^2\n$$\n\n> [!WARNING]\n> Stay safe.\n\n<details><summary>Raw</summary>Body</details>";
  const parsed = parseLivePreview(source);
  assert.deepEqual(parsed.blocks.map(block => [block.node.type, block.widget]), [["code", true], ["code", true], ["paragraph", true], ["math", true], ["blockquote", true], ["html", false]]);
});
