import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Root } from "mdast";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

// Stylesheets have no meaning to the server-side DOM assertions below.
const loadComponent = createRequire(__filename);
const originalCssLoader = loadComponent.extensions[".css"];
loadComponent.extensions[".css"] = () => {};
const { MarkdownContent, getTaskMarkerOffset } = loadComponent("../src/modules/content/client/components/MarkdownContent") as typeof import("../src/modules/content/client/components/MarkdownContent");
if (originalCssLoader) loadComponent.extensions[".css"] = originalCssLoader;
else delete loadComponent.extensions[".css"];

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
const parse = (markdown: string): Root => parser.parse(markdown);
const render = (markdown: string, tree?: Root, showFootnoteAppendix?: boolean) => renderToStaticMarkup(
  React.createElement(MarkdownContent, { markdown, tree, lang: "en", showFootnoteAppendix }),
);

test("prepared fragments retain full-note references without rendering other note content or mutating the AST", () => {
  const markdown = "Not in this fragment\n\n[guide][docs] and note[^one]\n\n[docs]: https://example.com/guide\n\n[^one]: Full-note explanation";
  const complete = parse(markdown);
  const tree: Root = { type: "root", children: complete.children.slice(1) };
  const before = JSON.stringify(tree);
  const html = render(markdown, tree);
  assert.match(html, /href="https:\/\/example.com\/guide"/);
  assert.match(html, /data-footnote-ref/);
  assert.doesNotMatch(html, /Not in this fragment|data-footnotes|Full-note explanation/);
  assert.equal(JSON.stringify(tree), before);
  assert.match(render(markdown, tree, true), /Full-note explanation/);
});

test("alerts preserve context, shared code rendering, safe images and exact task offsets", () => {
  const markdown = "Earlier\n\n> [!NOTE]\n> [guide][docs]\n>\n> - [ ] nested task\n\n[docs]: https://example.com/docs";
  const complete = parse(markdown);
  const tree: Root = { type: "root", children: complete.children.slice(1) };
  const html = renderToStaticMarkup(React.createElement(MarkdownContent, {
    markdown, tree, lang: "en", onToggleTask: () => {},
  }));
  assert.match(html, /role="note"/);
  assert.match(html, /href="https:\/\/example.com\/docs"/);
  assert.match(html, /aria-label="Toggle task"/);
  assert.doesNotMatch(html, /\[!NOTE\]|disabled=""/);
  const marker = getTaskMarkerOffset(markdown, markdown.indexOf("- [ ]"));
  assert.equal(marker, markdown.indexOf("[ ]") + 1);
  assert.equal(getTaskMarkerOffset("12. [X] item\r\n", 0), 5);
  assert.equal(getTaskMarkerOffset("- ordinary item", 0), null);
});

test("raw HTML remains inert and unsafe image or link protocols never render", () => {
  const html = render('[bad](javascript:alert%281%29)\n\n![unsafe](http://example.com/img.png)\n\n![safe](https://example.com/img.png)\n\n<script>alert(1)</script>');
  assert.doesNotMatch(html, /href="javascript:|src="http:|<script>/);
  assert.match(html, /src="https:\/\/example.com\/img.png"/);
  assert.match(html, /referrerPolicy="no-referrer"|referrerpolicy="no-referrer"/);
  assert.match(html, /&lt;script&gt;/);
});

test("code fences share escaped highlighting and math uses the shared KaTeX renderer", () => {
  const html = render('```html\n<img src=x onerror=alert(1)>\n```\n\n$x^2$');
  assert.match(html, /language-html/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /class="katex"/);
});

test("loose lists and alert headings with trailing whitespace keep interactive task rendering", () => {
  const markdown = "> [!TIP]  \n> useful\n\n- [ ] first\n\n  paragraph\n\n- [x] second";
  const html = renderToStaticMarkup(React.createElement(MarkdownContent, {
    markdown, lang: "en", onToggleTask: () => {},
  }));
  assert.match(html, /role="note"/);
  assert.doesNotMatch(html, /\[!TIP\]|disabled=""/);
  assert.equal((html.match(/aria-label="Toggle task"/g) || []).length, 2);
});

test("editor footnote definitions use whole-note numbering without duplicate appendices or dangling links", () => {
  const markdown = "first[^a], second[^b]\n\n[^a]: Alpha with nested[^b]\n\n[^b]: Beta";
  const complete = parse(markdown);
  const definition = complete.children.find(node => node.type === "footnoteDefinition" && node.identifier === "a");
  assert.ok(definition?.type === "footnoteDefinition");
  const tree: Root = { type: "root", children: [...definition.children, ...complete.children.filter(node => node.type === "footnoteDefinition")] };
  const html = renderToStaticMarkup(React.createElement(MarkdownContent, {
    markdown, tree, lang: "en", showFootnoteAppendix: false, footnoteNumbers: new Map([["a", 1], ["b", 2]]),
  }));
  assert.match(html, /<span title="\[\^b\]">2<\/span>/);
  assert.doesNotMatch(html, /data-footnotes|href="#user-content-fn-|Beta/);
});
