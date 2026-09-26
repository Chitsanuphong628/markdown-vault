import assert from "node:assert/strict";
import test from "node:test";
import { MarkdownManager } from "@tiptap/markdown";
import { Editor } from "@tiptap/core";
import { getRichEditorCompatibility, isSupportedRichEditorLinkUrl, serializeRichEditorMarkdown } from "../src/lib/richEditorCompatibility";
import { canPreserveMarkdownBlocks, parseMarkdownBlocks, prepareMarkdownForEditor } from "../src/lib/markdownBlocks";
import { createRichNoteEditorExtensions } from "../src/lib/richNoteEditorExtensions";
import { parseNoteTheme } from "../src/lib/noteTheme";

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

  assert.deepEqual(getRichEditorCompatibility(markdown), { supported: true, coverage: "full", opaqueReasons: [] });
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

  assert.deepEqual(getRichEditorCompatibility(markdown), { supported: true, coverage: "full", opaqueReasons: [] });
});

test("allows relative note links and preserves unsafe URL syntax in an opaque visual block", () => {
  assert.deepEqual(getRichEditorCompatibility("[note](../related.md)"), { supported: true, coverage: "full", opaqueReasons: [] });
  assert.deepEqual(getRichEditorCompatibility("[unsafe](javascript:alert%281%29)"), { supported: true, coverage: "partial", opaqueReasons: ["link"] });
  assert.match(prepareMarkdownForEditor("[unsafe](javascript:alert%281%29)").markdown, /nota-opaque-v1/);
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

test("routes advanced note blocks through visual editing without losing their source", () => {
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

  for (const [markdown] of cases) {
    const compatibility = getRichEditorCompatibility(markdown);
    assert.equal(compatibility.supported, true);
    if (markdown.startsWith("<details")) {
      assert.equal(compatibility.coverage, "partial");
    } else {
      assert.equal(compatibility.coverage, "full");
    }
  }
});

test("Tiptap parses and serializes legacy tables, code, Mermaid, math, images, and HTML blocks", () => {
  const markdown = [
    "Before **bold**.",
    "",
    "| Name | Value |",
    "| --- | ---: |",
    "| Note | 12 |",
    "",
    "![remote](https://example.com/image.png)",
    "",
    "Inline $x^2$ math.",
    "",
    "$$",
    "y = mx + b",
    "$$",
    "",
    "```ts",
    "const answer = 42;",
    "```",
    "",
    "```mermaid",
    "graph TD\n  A-->B",
    "```",
    "",
    "<details><summary>More</summary>preserve this</details>",
  ].join("\n");
  const prepared = prepareMarkdownForEditor(markdown);
  const document = markdownManager.parse(prepared.markdown);
  const serialized = markdownManager.serialize(document);

  assert.match(serialized, /\| Name \| Value \|/);
  assert.match(serialized, /!\[remote\]\(https:\/\/example.com\/image.png\)/);
  assert.match(serialized, /\$x\^2\$/);
  assert.match(serialized, /```mermaid/);
  assert.match(serialized, /<details><summary>More<\/summary>preserve this<\/details>/);
});

test("editing a heading preserves untouched Markdown blocks and frontmatter exactly", () => {
  const original = [
    "---",
    "title: Keep this metadata",
    "tags: [notes]",
    "---",
    "",
    "# Old heading",
    "",
    "Text with $x^2$ and a link.",
    "",
    "| Name | Value |",
    "| --- | ---: |",
    "| Row | 007 |",
    "",
    "![remote image](https://example.com/a%20b.png)",
    "",
    "$$",
    "\\int_0^1 x dx",
    "$$",
    "",
    "```ts",
    "const unchanged = true;",
    "```",
    "",
    "```mermaid",
    "graph TD; A-->B",
    "```",
    "",
    "<details><summary>More</summary>Keep raw HTML.</details>",
    "",
  ].join("\n");
  const bodyStart = original.indexOf("# Old heading");
  const body = original.slice(bodyStart);
  const prepared = prepareMarkdownForEditor(body);
  const baseline = markdownManager.parse(prepared.markdown);
  const current = structuredClone(baseline);
  const heading = current.content?.[0];
  assert.equal(heading?.type, "heading");
  if (heading?.content?.[0]) heading.content[0].text = "Updated heading";

  const serialized = serializeRichEditorMarkdown({
    originalContent: original,
    bodyMarkdown: markdownManager.serialize(current),
    baselineDocument: JSON.stringify(baseline),
    currentDocument: JSON.stringify(current),
    parseDocument: markdown => markdownManager.parse(markdown),
    serializeDocument: document => markdownManager.serialize(document),
  });

  assert.match(serialized, /^---\ntitle: Keep this metadata\ntags: \[notes\]\n---\n\n# Updated heading/);
  for (const block of parseMarkdownBlocks(body)) {
    if (!block.source.startsWith("# Old heading")) {
      assert.ok(serialized.includes(block.source), `lost original ${block.kind} source: ${block.source}`);
    }
  }
  assert.ok(serialized.endsWith("\n"));
});

test("editing around a mixed regular list and checklist preserves later Markdown syntax", () => {
  const original = [
    "---",
    "title: Mixed list fixture",
    "---",
    "",
    "# Old heading",
    "",
    "- plain item",
    "",
    "- [ ] task item",
    "",
    "| A | B |",
    "| - | - |",
    "| x | y |",
    "",
    "~~~python",
    "print(1)",
    "~~~",
  ].join("\n");
  const body = original.slice(original.indexOf("# Old heading"));
  const baseline = markdownManager.parse(prepareMarkdownForEditor(body).markdown);
  const current = structuredClone(baseline);
  current.content![0]!.content![0]!.text = "New heading";

  const serialized = serializeRichEditorMarkdown({
    originalContent: original,
    bodyMarkdown: markdownManager.serialize(current),
    baselineDocument: JSON.stringify(baseline),
    currentDocument: JSON.stringify(current),
    parseDocument: markdown => markdownManager.parse(markdown),
    serializeDocument: document => markdownManager.serialize(document),
  });

  assert.equal(serialized, original.replace("# Old heading", "# New heading"));
});

test("legacy Markdown blocks map consistently when syntax depends on whole-note context", () => {
  const cases = [
    ["screenshot checklist", [
      "# แผนการสร้าง AI ทำนายความเสี่ยงโรคหัวใจ (Heart Disease Prediction)",
      "",
      "โปรเจกต์เรียนรู้การสร้างโมเดล Machine Learning สำหรับการทำนาย (Classification) ตั้งแต่เตรียมข้อมูลจนถึงนำไปใช้งานจริง",
      "",
      "---",
      "",
      "## 1. รายการสิ่งที่ต้องเตรียม (Checklist)",
      "",
      "### 1.1 สภาพแวดล้อม (Environment)",
      "",
      "- [x] Python 3.9+ ติดตั้งในเครื่อง",
      "- [ ] Code Editor (เช่น VS Code / PyCharm)",
      "- [x] โฟลเดอร์โปรเจกต์: `dataAipredict`",
      "",
      "### 1.2 Python Libraries",
      "",
      "- [ ] ติดตั้ง pandas และ scikit-learn",
    ].join("\n")],
    ["nested lists and quoted code", [
      "## Notes",
      "",
      "1. First",
      "   - child",
      "   - [x] done",
      "2. Second",
      "",
      "> quoted text",
      ">",
      "> ```js",
      "> run()",
      "> ```",
    ].join("\n")],
    ["reference links and footnotes", [
      "Text with footnote[^1].",
      "",
      "[^1]: Footnote.",
    ].join("\n")],
    ["legacy HTML and tilde fences", [
      "Before <kbd>Enter</kbd> after.",
      "",
      "<!-- keep this comment -->",
      "",
      "~~~python title=example.py",
      "print('hello')",
      "~~~",
      "",
      "<details><summary>More</summary>",
      "Body text.",
      "</details>",
      "",
      "After the raw block.",
    ].join("\n")],
    ["mixed advanced blocks", [
      "# Heading",
      "",
      "Paragraph with $x^2$ and **bold**.",
      "",
      "| key | value |",
      "| --- | ---: |",
      "| a | 1 |",
      "",
      "```mermaid",
      "graph TD; A-->B",
      "```",
      "",
      "#### Deep heading",
      "",
      "Text after all preserved blocks.",
    ].join("\n")],
  ] as const;

  for (const [name, body] of cases) {
    const prepared = prepareMarkdownForEditor(body);
    const baselineDocument = markdownManager.parse(prepared.markdown);

    assert.equal(canPreserveMarkdownBlocks({
      originalBody: body,
      baselineDocument,
      parseDocument: markdown => markdownManager.parse(markdown),
    }), true, `${name} should not lock out write mode`);
  }
});

test("editing beside a legacy footnote preserves its source", () => {
  const original = [
    "Before the footnote.",
    "",
    "Text with footnote[^1].",
    "",
    "[^1]: Footnote.",
    "",
    "After the footnote.",
  ].join("\n");
  const baseline = markdownManager.parse(prepareMarkdownForEditor(original).markdown);
  const current = structuredClone(baseline);
  current.content![0]!.content![0]!.text = "Updated paragraph.";

  const saved = serializeRichEditorMarkdown({
    originalContent: original,
    bodyMarkdown: markdownManager.serialize(current),
    baselineDocument: JSON.stringify(baseline),
    currentDocument: JSON.stringify(current),
    parseDocument: markdown => markdownManager.parse(markdown),
    serializeDocument: document => markdownManager.serialize(document),
  });

  assert.equal(saved, original.replace("Before the footnote.", "Updated paragraph."));
});

test("headings H4 to H6 open as editable visual headings", () => {
  const markdown = ["#### Fourth", "##### Fifth", "###### Sixth"].join("\n\n");
  const document = markdownManager.parse(prepareMarkdownForEditor(markdown).markdown);

  assert.deepEqual(document.content?.map(node => [node.type, node.attrs?.level]), [
    ["heading", 4],
    ["heading", 5],
    ["heading", 6],
  ]);
  assert.equal(markdownManager.serialize(document), markdown);
});

test("ordered lists that start above one convert to editable numbered lists", () => {
  const markdown = "3. Third item\n4. Fourth item";
  const document = markdownManager.parse(prepareMarkdownForEditor(markdown).markdown);

  assert.equal(document.content?.[0]?.type, "orderedList");
  assert.equal(document.content?.[0]?.attrs?.start, 3);
  assert.equal(markdownManager.serialize(document), markdown);
});

test("GFM footnotes convert to editable references and note text", () => {
  const markdown = "Text with footnote[^1].\n\n[^1]: Footnote text.";
  const prepared = prepareMarkdownForEditor(markdown);
  const document = markdownManager.parse(prepared.markdown);
  const reference = document.content?.[0]?.content?.find(node => node.type === "footnoteReference");

  assert.deepEqual(getRichEditorCompatibility(markdown), { supported: true, coverage: "full", opaqueReasons: [] });
  assert.equal(reference?.attrs?.label, "1");
  assert.equal(document.content?.[1]?.type, "footnoteDefinition");
  assert.equal(document.content?.[1]?.attrs?.text, "Footnote text.");
  assert.equal(markdownManager.serialize(document), markdown);
  assert.equal(canPreserveMarkdownBlocks({
    originalBody: markdown,
    baselineDocument: document,
    parseDocument: source => markdownManager.parse(source),
  }), true);
});

test("reference-style Markdown links parse into editable links", () => {
  const markdown = "[guide]: https://example.com/guide \"Guide\"\n\nRead [the guide][guide].";
  const document = markdownManager.parse(prepareMarkdownForEditor(markdown).markdown);
  const linkText = document.content?.[0]?.content?.find(node => node.text === "the guide");

  assert.deepEqual(getRichEditorCompatibility(markdown), { supported: true, coverage: "full", opaqueReasons: [] });
  assert.deepEqual(linkText?.marks?.map(mark => ({ type: mark.type, href: mark.attrs?.href })), [
    { type: "link", href: "https://example.com/guide" },
  ]);
  assert.equal(canPreserveMarkdownBlocks({
    originalBody: markdown,
    baselineDocument: document,
    parseDocument: source => markdownManager.parse(source),
  }), true);
});

test("editing beside a reference link preserves the definition and its source spelling", () => {
  const markdown = [
    "[guide]: https://example.com/guide \"Guide\"",
    "",
    "Read [the guide][guide].",
    "",
    "Keep this paragraph.",
  ].join("\n");
  const prepared = prepareMarkdownForEditor(markdown);
  const baseline = markdownManager.parse(prepared.markdown);
  const current = structuredClone(baseline);
  current.content![1]!.content![0]!.text = "Update this paragraph.";

  const saved = serializeRichEditorMarkdown({
    originalContent: markdown,
    bodyMarkdown: markdownManager.serialize(current),
    baselineDocument: JSON.stringify(baseline),
    currentDocument: JSON.stringify(current),
    parseDocument: source => markdownManager.parse(source),
    serializeDocument: document => markdownManager.serialize(document),
  });

  assert.equal(saved, markdown.replace("Keep this paragraph.", "Update this paragraph."));
});

test("unsafe reference links stay source-preserved instead of becoming active links", () => {
  const markdown = "[unsafe]: javascript:alert%281%29\n\nOpen [this link][unsafe].";
  const prepared = prepareMarkdownForEditor(markdown);
  const document = markdownManager.parse(prepared.markdown);

  assert.deepEqual(getRichEditorCompatibility(markdown), {
    supported: true,
    coverage: "partial",
    opaqueReasons: ["unsafe-definition", "linkReference"],
  });
  assert.match(prepared.markdown, /nota-opaque-v1/);
  assert.equal(document.content?.some(node => node.content?.some(child => child.marks?.some(mark => mark.type === "link"))), false);
});

test("safe semantic HTML converts to editable text, links, and tables", () => {
  const markdown = [
    "<p>Hello <strong>world</strong>. Read <a href=\"https://example.com\">the guide</a>.</p>",
    "<table><tr><th>Name</th><th>Count</th></tr><tr><td>Apples</td><td>3</td></tr></table>",
  ].join("\n");
  const prepared = prepareMarkdownForEditor(markdown);
  const document = markdownManager.parse(prepared.markdown);

  assert.deepEqual(getRichEditorCompatibility(markdown), { supported: true, coverage: "full", opaqueReasons: [] });
  assert.equal(document.content?.[0]?.type, "paragraph");
  assert.equal(document.content?.[0]?.content?.some(node => node.text === "world" && node.marks?.some(mark => mark.type === "bold")), true);
  assert.equal(document.content?.[0]?.content?.some(node => node.text === "the guide" && node.marks?.some(mark => mark.type === "link")), true);
  assert.equal(document.content?.[1]?.type, "markdownTable");
  assert.equal(canPreserveMarkdownBlocks({
    originalBody: markdown,
    baselineDocument: document,
    parseDocument: source => markdownManager.parse(source),
  }), true);
});

test("safe semantic HTML converts headings, lists, quotations, and code blocks", () => {
  const markdown = [
    "<h4>หัวข้อ</h4>",
    "<ol start=\"3\"><li>สาม</li><li>สี่</li></ol>",
    "<blockquote><p>ข้อความอ้างอิง</p></blockquote>",
    "<pre><code class=\"language-ts\">const note = 'ok';</code></pre>",
  ].join("\n");
  const prepared = prepareMarkdownForEditor(markdown);
  const document = markdownManager.parse(prepared.markdown);

  assert.deepEqual(getRichEditorCompatibility(markdown), { supported: true, coverage: "full", opaqueReasons: [] });
  assert.deepEqual(document.content?.map(node => node.type), ["heading", "orderedList", "blockquote", "codeBlock"]);
  assert.equal(document.content?.[0]?.attrs?.level, 4);
  assert.equal(document.content?.[1]?.attrs?.start, 3);
  assert.equal(document.content?.[2]?.content?.[0]?.type, "paragraph");
  assert.equal(document.content?.[3]?.attrs?.language, "ts");
  assert.equal(canPreserveMarkdownBlocks({
    originalBody: markdown,
    baselineDocument: document,
    parseDocument: source => markdownManager.parse(source),
  }), true);
});

test("HTML that has no Markdown equivalent remains intact while surrounding text stays editable", () => {
  const markdown = [
    "<p>Old text.</p>",
    "",
    "<details><summary>Extra</summary>Keep this disclosure.</details>",
    "",
    "<p>Later text.</p>",
  ].join("\n");
  const baseline = markdownManager.parse(prepareMarkdownForEditor(markdown).markdown);
  const current = structuredClone(baseline);
  current.content![0]!.content![0]!.text = "New text.";

  const saved = serializeRichEditorMarkdown({
    originalContent: markdown,
    bodyMarkdown: markdownManager.serialize(current),
    baselineDocument: JSON.stringify(baseline),
    currentDocument: JSON.stringify(current),
    parseDocument: source => markdownManager.parse(source),
    serializeDocument: document => markdownManager.serialize(document),
  });

  assert.deepEqual(getRichEditorCompatibility(markdown), { supported: true, coverage: "partial", opaqueReasons: ["html"] });
  assert.equal(saved, markdown.replace("<p>Old text.</p>", "New text."));
});

test("editing converted HTML writes Markdown and preserves untouched HTML blocks", () => {
  const markdown = [
    "<p>Old <strong>text</strong>.</p>",
    "",
    "<details><summary>Extra</summary>Keep this disclosure.</details>",
  ].join("\n");
  const baseline = markdownManager.parse(prepareMarkdownForEditor(markdown).markdown);
  const current = structuredClone(baseline);
  current.content![0]!.content![0]!.text = "New ";

  const saved = serializeRichEditorMarkdown({
    originalContent: markdown,
    bodyMarkdown: markdownManager.serialize(current),
    baselineDocument: JSON.stringify(baseline),
    currentDocument: JSON.stringify(current),
    parseDocument: source => markdownManager.parse(source),
    serializeDocument: document => markdownManager.serialize(document),
  });

  assert.match(saved, /^New \*\*text\*\*\./);
  assert.ok(saved.includes("<details><summary>Extra</summary>Keep this disclosure.</details>"));
});

test("AI-style notes with loose task lists, nested bullets, Mermaid, math, and tables open in Write mode", () => {
  const markdown = [
    "# Project plan",
    "",
    "A short introduction.",
    "",
    "---",
    "",
    "## 1. Preparation",
    "",
    "### 1.1 Environment",
    "",
    "- [x] Python is installed",
    "- [ ] Code editor is ready",
    "- [x] Project folder exists",
    "",
    "### 1.2 Libraries",
    "",
    "Install the dependencies:",
    "",
    "```bash",
    "pip install pandas numpy",
    "```",
    "",
    "- [ ] `pandas`: tables",
    "- [ ] `numpy`: arrays",
    "- [ ] `plotting`: charts &amp; graphs",
    "",
    "### 1.3 Dataset",
    "",
    "- [x] Get the dataset",
    "  - Source: UCI or Kaggle",
    "  - Features: 13 variables",
    "  - Target: 0 = normal, 1 = positive",
    "",
    "## 2. Workflow",
    "",
    "```mermaid",
    "flowchart TD",
    "  A --> B",
    "```",
    "",
    "## 3. Steps",
    "",
    "### \\[ \\] Step 1: `01_load_data.py` (load data)",
    "",
    "- Read data from the standard URL into a DataFrame.",
    "- Save a local CSV file.",
    "- Show row and column counts.",
    "",
    "### \\[ \\] Step 2: `02_eda.py` (explore data)",
    "",
    "- Check data types and missing values.",
    "- Plot the normal and positive classes.",
    "",
    "### \\[ \\] Step 3: `03_train_model.py` (train the model)",
    "",
    "- Features ($X$) go into the model.",
    "- Target ($y$) is used for prediction.",
    "- Split the data into two groups:",
    "  - **Train Set (80%)**: used for learning.",
    "  - **Test Set (20%)**: used for evaluation.",
    "",
    "### \\[ \\] Step 4: `04_predict.py` (run prediction)",
    "",
    "- Save the trained model.",
    "- Return a risk percentage.",
    "",
    "## 4. Data dictionary",
    "",
    "| Name | Value |",
    "| :--- | :--- |",
    "| age | years |",
    "| sex | 0 or 1 |",
    "| glucose | > 120 mg/dl |",
  ].join("\n");
  const baseline = markdownManager.parse(prepareMarkdownForEditor(markdown).markdown);

  assert.equal(canPreserveMarkdownBlocks({
    originalBody: markdown,
    baselineDocument: baseline,
    parseDocument: source => markdownManager.parse(source),
  }), true);
});

test("complex README content with Thai lists and a wide table aligns for Write mode", () => {
  const markdown = [
    "# แผนการสร้าง AI ทำนายความเสี่ยงโรคหัวใจ (Heart Disease Prediction)",
    "",
    "โปรเจกต์เรียนรู้การสร้างโมเดล Machine Learning สำหรับการทำนาย (Classification) ตั้งแต่เตรียมข้อมูลจนถึงนำไปใช้งานจริง",
    "",
    "---",
    "",
    "## 1. รายการสิ่งที่ต้องเตรียม (Checklist)",
    "",
    "### 1.1 สภาพแวดล้อม (Environment)",
    "",
    "- [x] Python 3.9+ ติดตั้งในเครื่อง",
    "- [ ] Code Editor (เช่น VS Code / PyCharm)",
    "- [x] โฟลเดอร์โปรเจกต์: `dataAipredict`",
    "",
    "### 1.2 Python Libraries",
    "",
    "ติดตั้งคำสั่งนี้ใน Terminal:",
    "",
    "```bash",
    "pip install pandas numpy scikit-learn matplotlib seaborn",
    "```",
    "",
    "- [ ] `pandas`: จัดการและประมวลผลข้อมูลในรูปแบบตาราง (DataFrame)",
    "- [ ] `numpy`: คำนวณทางคณิตศาสตร์และจัดการ Array ตัวเลข",
    "- [ ] `scikit-learn`: ไลบรารีหลักสำหรับสร้างและเทรนโมเดล AI",
    "- [ ] `matplotlib` &amp; `seaborn`: วาดกราฟและแผนภาพวิเคราะห์ข้อมูล",
    "",
    "### 1.3 ชุดข้อมูล (Dataset)",
    "",
    "- [x] ไฟล์ `heart.csv` (Cleveland Heart Disease Dataset)",
    "  - แหล่งที่มา: UCI Machine Learning Repository / Kaggle",
    "  - จำนวนฟีเจอร์: 13 ตัวแปรสุขภาพ (เช่น อายุ, ความดัน, คอเลสเตอรอล)",
    "  - เป้าหมาย (`target`): 0 = ปกติ, 1 = เสี่ยงเป็นโรคหัวใจ",
    "",
    "---",
    "",
    "## 2. ลำดับขั้นตอนการทำงาน (Workflow)",
    "",
    "```mermaid",
    "flowchart TD",
    '    Step1["01_load_data.py<br/>โหลดข้อมูล & บันทึกไฟล์"] --> Step2["02_eda.py<br/>สำรวจข้อมูล & เช็ค Missing Values"]',
    '    Step2 --> Step3["03_train_model.py<br/>แบ่ง Train/Test & เทรนโมเดล"]',
    '    Step3 --> Step4["04_predict.py<br/>ทดสอบรับค่าคนไข้ใหม่ & ทำนายผล"]',
    "```",
    "",
    "---",
    "",
    "## 3. ลำดับไฟล์โค้ดที่จะลงมือเขียน",
    "",
    "### \\[ \\] Step 1: `01_load_data.py` (ดึงข้อมูล)",
    "",
    "- ดึงข้อมูลจาก URL มาตรฐานเข้า DataFrame",
    "- บันทึกเป็นไฟล์ `heart.csv` ไว้ในเครื่อง",
    "- แสดงจำนวนแถว/คอลัมน์ และตัวอย่าง 5 แถวแรก",
    "",
    "### \\[ \\] Step 2: `02_eda.py` (วิเคราะห์ข้อมูลเบื้องต้น - EDA)",
    "",
    "- ตรวจสอบชนิดข้อมูล (Data Types)",
    "- เช็คว่ามีค่าสูญหาย (Missing Values / NaN) หรือไม่",
    "- ดูสถิติพื้นฐาน (ค่าเฉลี่ย, min, max, มัธยฐาน)",
    "- พลอตกราฟดูสัดส่วนระหว่างคนปกติ vs คนมีความเสี่ยง",
    "",
    "### \\[ \\] Step 3: `03_train_model.py` (สร้างและเทรนโมเดล AI)",
    "",
    "- แยก Features ($X$) ออกจาก Target ($y$)",
    "- แบ่งข้อมูลออกเป็น 2 ชุด:",
    "  - **Train Set (80%)**: ให้ AI ใช้เรียนรู้",
    "  - **Test Set (20%)**: เก็บไว้สอบวัดผล",
    "- เทรนโมเดลด้วย `RandomForestClassifier` / `LogisticRegression`",
    "- วัดผลโมเดล:",
    "  - **Accuracy** (ความแม่นยำรวม)",
    "  - **Confusion Matrix** &amp; **Recall** (ดูว่าหลุดเคสคนป่วยหรือไม่)",
    "",
    "### \\[ \\] Step 4: `04_predict.py` (จำลองการใช้งานจริง)",
    "",
    "- บันทึกโมเดลเก็บไว้ (Save Model เป็นไฟล์ `.pkl` หรือ `.joblib`)",
    "- เขียนฟังก์ชันรับข้อมูลผลตรวจสุขภาพของคนไข้ใหม่",
    "- ให้โมเดลประมวลผลและตอบออกมาเป็น % ความเสี่ยง",
    "",
    "---",
    "",
    "## 4. บันทึกคำอธิบายตัวแปรใน Dataset (Data Dictionary)",
    "",
    "| ชื่อคอลัมน์ | ความหมาย | หน่วย / ค่าที่เป็นไปได้ |",
    "| :--- | :--- | :--- |",
    "| `age` | อายุ | ปี |",
    "| `sex` | เพศ | 1 = ชาย, 0 = หญิง |",
    "| `cp` | อาการเจ็บหน้าอก (Chest Pain Type) | 0, 1, 2, 3 |",
    "| `trestbps` | ความดันโลหิตขณะพัก | mm Hg |",
    "| `chol` | คอเลสเตอรอลในเลือด | mg/dl |",
    "| `fbs` | น้ำตาลในเลือดตอนอดอาหาร &gt; 120 mg/dl | 1 = จริง, 0 = ไม่จริง |",
    "| `restecg` | ผลคลื่นไฟฟ้าหัวใจขณะพัก | 0, 1, 2 |",
    "| `thalach` | อัตราการเต้นหัวใจสูงสุด | ครั้งต่อนาที (bpm) |",
    "| `exang` | อาการเจ็บหน้าอกหลังออกกำลังกาย | 1 = มี, 0 = ไม่มี |",
    "| `oldpeak` | ระดับ ST depression | ค่าตัวเลข |",
    "| `slope` | ความชันของ ST segment | 0, 1, 2 |",
    "| `ca` | จำนวนหลอดเลือดใหญ่ที่มองเห็นด้วยฟลูออโรสโคปี | 0 - 3 |",
    "| `thal` | ผลตรวจธาลัสซีเมีย | 1 = ปกติ, 2 = ผิดปกติถาวร, 3 = ผิดปกติชั่วคราว |",
    "| **`target`** | **ผลการวินิจฉัย (Target)** | **0 = ปกติ, 1 = เสี่ยงเป็นโรค** |",
    "",
    "",
  ].join("\n");
  const baseline = markdownManager.parse(prepareMarkdownForEditor(markdown).markdown);

  assert.equal(canPreserveMarkdownBlocks({
    originalBody: markdown,
    baselineDocument: baseline,
    parseDocument: source => markdownManager.parse(source),
  }), true);

  const editor = new Editor({
    extensions: createRichNoteEditorExtensions("en"),
    content: prepareMarkdownForEditor(markdown).markdown,
    contentType: "markdown",
    element: null,
  });
  try {
    assert.equal(canPreserveMarkdownBlocks({
      originalBody: markdown,
      baselineDocument: editor.getJSON(),
      parseDocument: source => editor.storage.markdown.manager.parse(source),
    }), true);

    const originalDocument = editor.getJSON();
    const editedDocument = structuredClone(originalDocument);
    const firstHeading = editedDocument.content?.[0]?.content?.[0] as { type?: string; text?: string } | undefined;
    assert.equal(firstHeading?.type, "text");
    firstHeading.text = "แผนการสร้าง AI ฉบับแก้ไข";
    const saved = serializeRichEditorMarkdown({
      originalContent: markdown,
      bodyMarkdown: editor.getMarkdown(),
      baselineDocument: JSON.stringify(originalDocument),
      currentDocument: JSON.stringify(editedDocument),
      parseDocument: source => editor.storage.markdown.manager.parse(source),
      serializeDocument: document => editor.storage.markdown.manager.serialize(document),
    });
    assert.equal(saved, markdown.replace("# แผนการสร้าง AI ทำนายความเสี่ยงโรคหัวใจ (Heart Disease Prediction)", "# แผนการสร้าง AI ฉบับแก้ไข"));
  } finally {
    editor.destroy();
  }
});

test("legacy leading gaps, numbered lists, and table HTML with math stay editable", () => {
  const notes = [
    { markdown: "\n\n# หัวข้อ\n\nเนื้อหาเดิม\n", before: "หัวข้อ", after: "แก้ไข" },
    { markdown: "# แผนงาน\n\n1. ขั้นแรก\n2. ขั้นต่อไป\n", before: "แผนงาน", after: "แก้ไข" },
    { markdown: "Before.\n\n| Topic | Detail |\n| --- | --- |\n| Line<br>next | $x^2$ |\n\nAfter.", before: "Before.", after: "Updated." },
  ];

  for (const { markdown, before, after } of notes) {
    const editor = new Editor({
      extensions: createRichNoteEditorExtensions("en"),
      content: prepareMarkdownForEditor(markdown).markdown,
      contentType: "markdown",
      element: null,
    });
    try {
      const baselineDocument = editor.getJSON();
      assert.equal(canPreserveMarkdownBlocks({
        originalBody: markdown,
        baselineDocument,
        parseDocument: source => editor.storage.markdown.manager.parse(source),
      }), true);
      const unmatchedDocument = structuredClone(baselineDocument);
      unmatchedDocument.content?.push({ type: "paragraph", attrs: {}, content: [{ type: "text", text: "Untracked", marks: [] }] });
      assert.equal(canPreserveMarkdownBlocks({
        originalBody: markdown,
        baselineDocument: unmatchedDocument,
        parseDocument: source => editor.storage.markdown.manager.parse(source),
      }), false);
      assert.equal(serializeRichEditorMarkdown({
        originalContent: markdown,
        bodyMarkdown: editor.getMarkdown(),
        baselineDocument: JSON.stringify(baselineDocument),
        currentDocument: JSON.stringify(baselineDocument),
        parseDocument: source => editor.storage.markdown.manager.parse(source),
        serializeDocument: document => editor.storage.markdown.manager.serialize(document),
      }), markdown);

      const editedDocument = structuredClone(baselineDocument);
      const textNode = editedDocument.content?.find(node => node.content?.[0]?.type === "text")?.content?.[0] as { text?: string } | undefined;
      assert.equal(textNode?.text, before);
      textNode.text = after;
      const saved = serializeRichEditorMarkdown({
        originalContent: markdown,
        bodyMarkdown: editor.getMarkdown(),
        baselineDocument: JSON.stringify(baselineDocument),
        currentDocument: JSON.stringify(editedDocument),
        parseDocument: source => editor.storage.markdown.manager.parse(source),
        serializeDocument: document => editor.storage.markdown.manager.serialize(document),
      });
      assert.equal(saved, markdown.replace(before, after));
    } finally {
      editor.destroy();
    }
  }
});

test("common Markdown variants open in the real editor and retain source when untouched", () => {
  const variants = [
    ["setext headings", "Title\n=====\n\nSubtitle\n-------\n\nBody"],
    ["tilde fenced code", "Before\n\n~~~typescript title=demo.ts\nconst answer = 42;\n~~~\n\nAfter"],
    ["indented code", "Before\n\n    const answer = 42;\n    console.log(answer);\n\nAfter"],
    ["nested blockquotes", "> First level\n>\n> > Nested level\n>\n> - Quoted item\n\nAfter"],
    ["ordered lists with parenthesis markers", "1) First\n2) Second\n3) Third"],
    ["nested task and bullet lists", "- [x] Done\n  - child item\n  - [ ] Child task\n- [ ] Open"],
    ["loose list paragraphs", "- First paragraph\n\n  Continued paragraph\n\n- Second item"],
    ["reference links", "Read [the guide][guide].\n\n[guide]: https://example.com/docs \"Guide\""],
    ["reference images", "![Diagram][diagram]\n\n[diagram]: https://example.com/diagram.png \"Diagram\""],
    ["inline links and remote images", "Read [the guide](https://example.com/docs \"Guide\").\n\n![Diagram](https://example.com/diagram.png \"Diagram\")"],
    ["autolinks and escaped punctuation", "<https://example.com> and user@example.com\n\nUse \\\*literal stars\\\* and \\_underscores\\_."],
    ["hard line breaks", "First line  \nSecond line\\\nThird line"],
    ["GFM table with escaped pipes", "| Name | Expression |\n| :--- | ---: |\n| A \\| B | `x|y` |\n| C | ~~old~~ |"],
    ["HTML comments and inline tags", "Text <span>with HTML</span>.\n\n<!-- keep this comment -->\n\nAfter"],
    ["details HTML block", "Before\n\n<details><summary>More</summary>Hidden text</details>\n\nAfter"],
    ["footnote with continuation", "Text[^note].\n\n[^note]: First line\n    Continued line"],
    ["unicode punctuation and emoji", "# บันทึก — สรุป\n\nภาษาไทย 🙂 • English — punctuation…"],
    ["alternative thematic breaks", "Before\n\n* * *\n\nMiddle\n\n_ _ _\n\nAfter"],
    ["math beside a fenced diagram", "Inline $x^2$\n\n$$\ny = mx + b\n$$\n\n```mermaid\nflowchart LR\n  A-->B\n```"],
  ] as const;

  for (const [name, markdown] of variants) {
    const editor = new Editor({
      extensions: createRichNoteEditorExtensions("en"),
      content: prepareMarkdownForEditor(markdown).markdown,
      contentType: "markdown",
      element: null,
    });
    try {
      assert.equal(canPreserveMarkdownBlocks({
        originalBody: markdown,
        baselineDocument: editor.getJSON(),
        parseDocument: source => editor.storage.markdown.manager.parse(source),
      }), true, `${name} should open in Write mode`);
      const document = editor.getJSON();
      assert.equal(serializeRichEditorMarkdown({
        originalContent: markdown,
        bodyMarkdown: editor.getMarkdown(),
        baselineDocument: JSON.stringify(document),
        currentDocument: JSON.stringify(document),
        parseDocument: source => editor.storage.markdown.manager.parse(source),
        serializeDocument: source => editor.storage.markdown.manager.serialize(source),
      }), markdown, `${name} should retain its original source when untouched`);

      const appendedDocument = structuredClone(document);
      appendedDocument.content?.push({ type: "paragraph", attrs: {}, content: [{ type: "text", text: "Added after the original note.", marks: [] }] });
      const appended = serializeRichEditorMarkdown({
        originalContent: markdown,
        bodyMarkdown: editor.getMarkdown(),
        baselineDocument: JSON.stringify(document),
        currentDocument: JSON.stringify(appendedDocument),
        parseDocument: source => editor.storage.markdown.manager.parse(source),
        serializeDocument: source => editor.storage.markdown.manager.serialize(source),
      });
      assert.equal(
        appended.trimEnd(),
        `${markdown.trimEnd()}\n\nAdded after the original note.`,
        `${name} should keep all original Markdown when text is added`,
      );
    } finally {
      editor.destroy();
    }
  }
});

test("GFM alerts stay readable and preserve their exact source when nearby prose changes", () => {
  const alert = "> [!WARNING]\n> Keep **important** details visible.\n>\n> Add a second paragraph.";
  const original = `Before the alert.\n\n${alert}\n\nAfter the alert.`;
  const editor = new Editor({
    extensions: createRichNoteEditorExtensions("en"),
    content: prepareMarkdownForEditor(original).markdown,
    contentType: "markdown",
    element: null,
  });

  try {
    const baseline = editor.getJSON();
    assert.equal(canPreserveMarkdownBlocks({
      originalBody: original,
      baselineDocument: baseline,
      parseDocument: source => editor.storage.markdown.manager.parse(source),
    }), true);
    assert.equal(baseline.content?.[1]?.type, "opaqueMarkdown");
    assert.equal(serializeRichEditorMarkdown({
      originalContent: original,
      bodyMarkdown: editor.getMarkdown(),
      baselineDocument: JSON.stringify(baseline),
      currentDocument: JSON.stringify(baseline),
      parseDocument: source => editor.storage.markdown.manager.parse(source),
      serializeDocument: document => editor.storage.markdown.manager.serialize(document),
    }), original);

    const changed = structuredClone(baseline);
    const firstText = changed.content?.[0]?.content?.[0] as { text?: string } | undefined;
    assert.equal(firstText?.text, "Before the alert.");
    if (!firstText) throw new Error("Expected the alert fixture to start with a paragraph.");
    firstText.text = "Updated before the alert.";
    const saved = serializeRichEditorMarkdown({
      originalContent: original,
      bodyMarkdown: editor.getMarkdown(),
      baselineDocument: JSON.stringify(baseline),
      currentDocument: JSON.stringify(changed),
      parseDocument: source => editor.storage.markdown.manager.parse(source),
      serializeDocument: document => editor.storage.markdown.manager.serialize(document),
    });
    assert.equal(saved, original.replace("Before the alert.", "Updated before the alert."));

    const changedAlert = alert.replace("WARNING", "TIP").replace("important", "useful");
    const editedAlertDocument = structuredClone(baseline);
    const alertNode = editedAlertDocument.content?.[1] as { attrs?: Record<string, unknown> } | undefined;
    assert.equal(alertNode?.attrs?.markdown, alert);
    if (!alertNode?.attrs) throw new Error("Expected the GFM alert source block.");
    alertNode.attrs.markdown = changedAlert;
    const savedAlert = serializeRichEditorMarkdown({
      originalContent: original,
      bodyMarkdown: editor.getMarkdown(),
      baselineDocument: JSON.stringify(baseline),
      currentDocument: JSON.stringify(editedAlertDocument),
      parseDocument: source => editor.storage.markdown.manager.parse(source),
      serializeDocument: document => editor.storage.markdown.manager.serialize(document),
    });
    assert.equal(savedAlert, original.replace(alert, changedAlert));
  } finally {
    editor.destroy();
  }
});

test("frontmatter and forward reference links survive a real editor session", () => {
  const original = [
    "---",
    "title: Keep the frontmatter",
    "tags: [legacy, markdown]",
    "---",
    "",
    "Read [the guide][guide].",
    "",
    "[guide]: https://example.com/docs \"Guide\"",
  ].join("\n");
  const { cleanContent } = parseNoteTheme(original);
  const editor = new Editor({
    extensions: createRichNoteEditorExtensions("en"),
    content: prepareMarkdownForEditor(cleanContent).markdown,
    contentType: "markdown",
    element: null,
  });
  try {
    const baseline = editor.getJSON();
    assert.equal(canPreserveMarkdownBlocks({
      originalBody: cleanContent,
      baselineDocument: baseline,
      parseDocument: source => editor.storage.markdown.manager.parse(source),
    }), true);
    const saved = serializeRichEditorMarkdown({
      originalContent: original,
      bodyMarkdown: editor.getMarkdown(),
      baselineDocument: JSON.stringify(baseline),
      currentDocument: JSON.stringify(baseline),
      parseDocument: source => editor.storage.markdown.manager.parse(source),
      serializeDocument: source => editor.storage.markdown.manager.serialize(source),
    });
    assert.equal(saved, original);

    const changed = structuredClone(baseline);
    changed.content?.push({ type: "paragraph", attrs: {}, content: [{ type: "text", text: "Appended paragraph.", marks: [] }] });
    const edited = serializeRichEditorMarkdown({
      originalContent: original,
      bodyMarkdown: editor.getMarkdown(),
      baselineDocument: JSON.stringify(baseline),
      currentDocument: JSON.stringify(changed),
      parseDocument: source => editor.storage.markdown.manager.parse(source),
      serializeDocument: source => editor.storage.markdown.manager.serialize(source),
    });
    assert.equal(edited.trimEnd(), `${original.trimEnd()}\n\nAppended paragraph.`);
  } finally {
    editor.destroy();
  }
});
