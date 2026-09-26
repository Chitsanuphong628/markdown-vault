import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Markdown } from "@tiptap/markdown";
import { Node, mergeAttributes, type Extensions, type JSONContent, type MarkdownParseHelpers, type MarkdownToken } from "@tiptap/core";
import { CodeBlock } from "@tiptap/extension-code-block";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { createElement } from "react";
import type { Language } from "@/lib/i18n";
import { CodeBlockView, FootnoteDefinitionView, FootnoteReferenceView, InlineMathView, MathBlockView, NoteImageView, OpaqueMarkdownView } from "@/components/NoteBlockEditor";

const VisualCodeBlock = (lang: Language) => CodeBlock.extend({
  addNodeView() { return ReactNodeViewRenderer(props => createElement(CodeBlockView, { ...props, lang })); },
});

const OpaqueMarkdownBlock = (lang: Language) => Node.create({
  name: "opaqueMarkdown",
  group: "block",
  atom: true,
  selectable: true,
  addAttributes() { return { markdown: { default: "" } }; },
  parseHTML() { return [{ tag: 'div[data-type="nota-opaque-markdown"]' }]; },
  renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes(HTMLAttributes, { "data-type": "nota-opaque-markdown" })]; },
  addNodeView() { return ReactNodeViewRenderer(props => createElement(OpaqueMarkdownView, { ...props, lang })); },
  markdownTokenName: "notaOpaqueV1",
  markdownTokenizer: {
    name: "notaOpaqueV1",
    level: "block" as const,
    start: (source: string) => source.indexOf(":::nota-opaque-v1 "),
    tokenize(source: string) {
      const match = source.match(/^:::nota-opaque-v1 ([^\r\n]+)\r?\n:::/);
      if (!match) return undefined;
      return { type: "notaOpaqueV1", raw: match[0], markdown: decodeURIComponent(match[1] || "") };
    },
  },
  parseMarkdown(token, helpers) {
    return helpers.createNode("opaqueMarkdown", { markdown: String(token.markdown || "") });
  },
  renderMarkdown: node => String(node.attrs?.markdown || ""),
});

const FootnoteReference = (lang: Language) => Node.create({
  name: "footnoteReference",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() { return { label: { default: "" } }; },
  parseHTML() { return [{ tag: 'sup[data-type="nota-footnote-reference"]' }]; },
  renderHTML({ node, HTMLAttributes }) {
    return ["sup", mergeAttributes(HTMLAttributes, { "data-type": "nota-footnote-reference" }), String(node.attrs.label || "")];
  },
  addNodeView() { return ReactNodeViewRenderer(props => createElement(FootnoteReferenceView, { ...props, lang })); },
  markdownTokenName: "notaFootnoteReferenceV1",
  markdownTokenizer: {
    name: "notaFootnoteReferenceV1",
    level: "inline" as const,
    start: (source: string) => source.indexOf("[^"),
    tokenize(source: string) {
      const match = source.match(/^\[\^([^\]\r\n]+)\]/);
      if (!match || source[match[0].length] === ":") return undefined;
      return { type: "notaFootnoteReferenceV1", raw: match[0], label: match[1] };
    },
  },
  parseMarkdown(token, helpers) {
    const footnote = token as MarkdownToken & { label?: string };
    return helpers.createNode("footnoteReference", { label: footnote.label || "" });
  },
  renderMarkdown: node => `[^${String(node.attrs?.label || "")}]`,
});

const FootnoteDefinition = (lang: Language) => Node.create({
  name: "footnoteDefinition",
  group: "block",
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      label: { default: "" },
      text: { default: "" },
    };
  },
  parseHTML() { return [{ tag: 'div[data-type="nota-footnote-definition"]' }]; },
  renderHTML({ node, HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "nota-footnote-definition" }), `${String(node.attrs.label || "")}: ${String(node.attrs.text || "")}`];
  },
  addNodeView() { return ReactNodeViewRenderer(props => createElement(FootnoteDefinitionView, { ...props, lang })); },
  markdownTokenName: "notaFootnoteDefinitionV1",
  markdownTokenizer: {
    name: "notaFootnoteDefinitionV1",
    level: "block" as const,
    start(source: string) {
      const match = /(?:^|\n)\[\^[^\]\r\n]+\]:/.exec(source);
      return match ? match.index + (match[0].startsWith("\n") ? 1 : 0) : -1;
    },
    tokenize(source: string) {
      const match = source.match(/^\[\^([^\]\r\n]+)\]:[\t ]*(.*(?:\r?\n(?: {2,}|\t)[^\r\n]*)*)/);
      if (!match) return undefined;
      const text = match[0]
        .replace(/^\[\^[^\]\r\n]+\]:[\t ]*/, "")
        .replace(/\r?\n(?: {2,}|\t)/g, "\n");
      return { type: "notaFootnoteDefinitionV1", raw: match[0], label: match[1], text };
    },
  },
  parseMarkdown(token, helpers) {
    const footnote = token as MarkdownToken & { label?: string; text?: string };
    return helpers.createNode("footnoteDefinition", { label: footnote.label || "", text: footnote.text || "" });
  },
  renderMarkdown: node => `[^${String(node.attrs?.label || "")}]: ${String(node.attrs?.text || "").replace(/\r?\n/g, "\n    ")}`,
});

const MathBlock = (lang: Language) => Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  selectable: true,
  addAttributes() { return { latex: { default: "" } }; },
  parseHTML() { return [{ tag: 'div[data-type="nota-math-block"]' }]; },
  renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes(HTMLAttributes, { "data-type": "nota-math-block" })]; },
  addNodeView() { return ReactNodeViewRenderer(props => createElement(MathBlockView, { ...props, lang })); },
  markdownTokenName: "notaMathBlockV1",
  markdownTokenizer: {
    name: "notaMathBlockV1",
    level: "block" as const,
    start: (source: string) => source.indexOf(":::nota-math-block-v1 "),
    tokenize(source: string) {
      const match = source.match(/^:::nota-math-block-v1 ([^\r\n]+)\r?\n:::/);
      if (!match) return undefined;
      return { type: "notaMathBlockV1", raw: match[0], latex: decodeURIComponent(match[1] || "") };
    },
  },
  parseMarkdown(token, helpers) {
    return helpers.createNode("mathBlock", { latex: String(token.latex || "") });
  },
  renderMarkdown: node => `$$\n${String(node.attrs?.latex || "")}\n$$`,
});

const InlineMath = (lang: Language) => Node.create({
  name: "inlineMath",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() { return { latex: { default: "" } }; },
  parseHTML() { return [{ tag: 'span[data-type="nota-inline-math"]' }]; },
  renderHTML({ HTMLAttributes }) { return ["span", mergeAttributes(HTMLAttributes, { "data-type": "nota-inline-math" })]; },
  addNodeView() { return ReactNodeViewRenderer(props => createElement(InlineMathView, { ...props, lang })); },
  markdownTokenName: "notaMathInlineV1",
  markdownTokenizer: {
    name: "notaMathInlineV1",
    level: "inline" as const,
    start: (source: string) => source.indexOf("[[nota-math-inline-v1:"),
    tokenize(source: string) {
      const match = source.match(/^\[\[nota-math-inline-v1:([^\]]+)\]\]/);
      if (!match) return undefined;
      return { type: "notaMathInlineV1", raw: match[0], latex: decodeURIComponent(match[1] || "") };
    },
  },
  parseMarkdown(token, helpers) {
    return helpers.createNode("inlineMath", { latex: String(token.latex || "") });
  },
  renderMarkdown: node => `$${String(node.attrs?.latex || "")}$`,
});

const NoteImage = (lang: Language) => Node.create({
  name: "noteImage",
  group: "inline",
  inline: true,
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      title: { default: null },
    };
  },
  parseHTML() { return [{ tag: "img[src]", getAttrs: element => ({ src: (element as HTMLElement).getAttribute("src"), alt: (element as HTMLElement).getAttribute("alt") || "", title: (element as HTMLElement).getAttribute("title") }) }]; },
  renderHTML({ node, HTMLAttributes }) { return ["img", mergeAttributes(HTMLAttributes, { src: node.attrs.src, alt: node.attrs.alt, title: node.attrs.title })]; },
  addNodeView() { return ReactNodeViewRenderer(props => createElement(NoteImageView, { ...props, lang })); },
  markdownTokenName: "image",
  parseMarkdown(token, helpers) {
    return helpers.createNode("noteImage", { src: token.href || "", alt: token.text || "", title: token.title || null });
  },
  renderMarkdown: node => {
    const alt = String(node.attrs?.alt || "").replace(/([\\[\]])/g, "\\$1");
    const src = String(node.attrs?.src || "").replace(/[()]/g, character => character === "(" ? "%28" : "%29");
    const title = node.attrs?.title ? ` ${JSON.stringify(String(node.attrs.title))}` : "";
    return `![${alt}](${src}${title})`;
  },
});

const TableCell = Node.create({
  name: "tableCell",
  content: "block+",
  isolating: true,
  addAttributes() { return { align: { default: null } }; },
  parseHTML() { return [{ tag: "td" }]; },
  renderHTML({ node, HTMLAttributes }) { return ["td", mergeAttributes(HTMLAttributes, node.attrs.align ? { style: `text-align:${node.attrs.align}` } : {}), 0]; },
});

const TableHeader = Node.create({
  name: "tableHeader",
  content: "block+",
  isolating: true,
  addAttributes() { return { align: { default: null } }; },
  parseHTML() { return [{ tag: "th" }]; },
  renderHTML({ node, HTMLAttributes }) { return ["th", mergeAttributes(HTMLAttributes, node.attrs.align ? { style: `text-align:${node.attrs.align}` } : {}), 0]; },
});

const TableRow = Node.create({
  name: "tableRow",
  content: "(tableHeader|tableCell)+",
  parseHTML() { return [{ tag: "tr" }]; },
  renderHTML({ HTMLAttributes }) { return ["tr", HTMLAttributes, 0]; },
});

function parseTableCell(cell: { tokens?: MarkdownToken[]; text?: string }, type: string, align: string | null, helpers: MarkdownParseHelpers): JSONContent {
  const content = cell.tokens ? helpers.parseInline(cell.tokens) : cell.text ? [helpers.createTextNode(cell.text)] : [];
  return helpers.createNode(type, { align }, [helpers.createNode("paragraph", {}, content)]);
}

const MarkdownTable = Node.create({
  name: "markdownTable",
  group: "block",
  content: "tableRow+",
  isolating: true,
  parseHTML() { return [{ tag: "table" }]; },
  renderHTML({ HTMLAttributes }) { return ["table", mergeAttributes(HTMLAttributes, { class: "nota-editor-table" }), ["tbody", 0]]; },
  markdownTokenName: "table",
  parseMarkdown(token, helpers) {
    const table = token as unknown as { header?: Array<{ text?: string; tokens?: MarkdownToken[] }>; rows?: Array<Array<{ text?: string; tokens?: MarkdownToken[] }>>; align?: Array<string | null> };
    const align = table.align || [];
    const header = (table.header || []).map((cell, index) => parseTableCell(cell, "tableHeader", align[index] || null, helpers));
    const rows = (table.rows || []).map(row => row.map((cell, index) => parseTableCell(cell, "tableCell", align[index] || null, helpers)));
    return helpers.createNode("markdownTable", {}, [helpers.createNode("tableRow", {}, header), ...rows.map(row => helpers.createNode("tableRow", {}, row))]);
  },
  renderMarkdown(node, helpers) {
    const rows = (node.content || []).map((row: JSONContent) => (row.content || []).map((cell: JSONContent) => {
      const text = helpers.renderChildren(cell.content || []).replace(/\r?\n/g, "<br>");
      return text.replace(/(?<!\\)\|/g, "\\|");
    }));
    if (!rows.length) return "";
    const alignments = ((node.content?.[0]?.content || []) as JSONContent[]).map(cell => {
      const align = cell.attrs?.align;
      return align === "center" ? ":---:" : align === "right" ? "---:" : align === "left" ? ":---" : "---";
    });
    const delimiter = alignments.length ? alignments : rows[0]!.map(() => "---");
    const lines = [rows[0]!, delimiter, ...rows.slice(1)].map(row => `| ${row.join(" | ")} |`);
    return lines.join("\n");
  },
});

export function createRichNoteEditorExtensions(lang: Language): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: { openOnClick: false },
      codeBlock: false,
    }),
    VisualCodeBlock(lang),
    OpaqueMarkdownBlock(lang),
    FootnoteReference(lang),
    FootnoteDefinition(lang),
    MathBlock(lang),
    InlineMath(lang),
    NoteImage(lang),
    MarkdownTable,
    TableRow,
    TableHeader,
    TableCell,
    Placeholder.configure({
      placeholder: lang === "th" ? "เริ่มพิมพ์บันทึกของคุณ..." : "Start writing your note...",
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown,
  ];
}
