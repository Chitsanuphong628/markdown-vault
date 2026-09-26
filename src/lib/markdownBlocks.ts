import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { convertHtmlToMarkdown } from "@/lib/htmlToMarkdown";
import { parseGfmAlert } from "@/lib/gfmAlerts";

export { GFM_ALERT_TYPES, parseGfmAlert, type GfmAlertType } from "@/lib/gfmAlerts";

export type MarkdownBlockKind = "richText" | "table" | "image" | "code" | "mermaid" | "math" | "opaque";

export interface MarkdownBlock {
  kind: MarkdownBlockKind;
  source: string;
  start: number;
  end: number;
  language?: string;
  reason?: string;
  editorMarkdown?: string;
}

interface MarkdownNode {
  type: string;
  lang?: string | null;
  depth?: number;
  ordered?: boolean;
  start?: number | null;
  identifier?: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
  position?: { start?: { offset?: number }; end?: { offset?: number } };
}

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

const SUPPORTED_INLINE_NODES = new Set([
  "text", "emphasis", "strong", "delete", "link", "image", "inlineCode", "inlineMath", "break", "footnoteReference", "linkReference", "imageReference",
]);
const SUPPORTED_BLOCK_NODES = new Set([
  "paragraph", "heading", "blockquote", "list", "listItem", "table", "tableRow", "tableCell", "thematicBreak", "code", "math", "footnoteDefinition", "definition",
]);

function normalizeReferenceIdentifier(identifier: string): string {
  return identifier.trim().replace(/\s+/g, " ").toLowerCase();
}

function getSafeLinkDefinitions(tree: MarkdownNode): { identifiers: Set<string>; offsets: Set<number> } {
  const identifiers = new Set<string>();
  const offsets = new Set<number>();
  const seen = new Set<string>();
  for (const node of tree.children || []) {
    if (node.type !== "definition" || !node.identifier) continue;
    const identifier = normalizeReferenceIdentifier(node.identifier);
    if (!identifier || seen.has(identifier)) continue;
    seen.add(identifier);
    if (isSafeNoteLink(node.url || "")) {
      identifiers.add(identifier);
      const start = node.position?.start?.offset;
      if (Number.isInteger(start)) offsets.add(start!);
    }
  }
  return { identifiers, offsets };
}

function nodeRange(node: MarkdownNode): { start: number; end: number } | null {
  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;
  return Number.isInteger(start) && Number.isInteger(end) && end! >= start!
    ? { start: start!, end: end! }
    : null;
}

function findUnsupported(node: MarkdownNode, safeReferenceIds: Set<string>): MarkdownNode | null {
  if ((node.type === "linkReference" || node.type === "imageReference")
    && (!node.identifier || !safeReferenceIds.has(normalizeReferenceIdentifier(node.identifier)))) {
    return node;
  }
  if (!SUPPORTED_INLINE_NODES.has(node.type) && !SUPPORTED_BLOCK_NODES.has(node.type) && node.type !== "root") {
    return node;
  }
  for (const child of node.children || []) {
    const unsupported = findUnsupported(child, safeReferenceIds);
    if (unsupported) return unsupported;
  }
  if (node.type === "link" && !isSafeNoteLink(node.url || "")) return node;
  return null;
}

function containsOnlyImages(node: MarkdownNode): boolean {
  return node.type === "paragraph" && node.children?.length === 1 && node.children[0]?.type === "image";
}

function containsOnlyTextAndHtml(node: MarkdownNode): boolean {
  if (node.type === "text" || node.type === "html") return true;
  if (node.type === "root" || node.type === "paragraph") {
    return (node.children || []).every(containsOnlyTextAndHtml);
  }
  return false;
}

function toBlock(
  node: MarkdownNode,
  source: string,
  safeDefinitionOffsets: Set<number>,
  safeReferenceIds: Set<string>,
): MarkdownBlock | null {
  const range = nodeRange(node);
  if (!range) return null;
  const start = range.start;
  const end = range.end;
  const raw = source.slice(start, end);
  if (node.type === "definition") {
    return {
      kind: "opaque",
      source: raw,
      start,
      end,
      reason: safeDefinitionOffsets.has(start) ? "definition" : "unsafe-definition",
    };
  }
  if (node.type === "blockquote" && parseGfmAlert(raw)) {
    return { kind: "opaque", source: raw, start, end, reason: "gfm-alert" };
  }
  const unsupported = findUnsupported(node, safeReferenceIds);
  if (unsupported) {
    if (unsupported.type === "html" && containsOnlyTextAndHtml(node)) {
      const editorMarkdown = convertHtmlToMarkdown(raw);
      if (editorMarkdown) return { kind: "richText", source: raw, start, end, editorMarkdown };
    }
    return { kind: "opaque", source: raw, start, end, reason: unsupported.type };
  }
  if (node.type === "table") return { kind: "table", source: raw, start, end };
  if (node.type === "math") return { kind: "math", source: raw, start, end };
  if (node.type === "code") {
    const language = node.lang || "";
    return { kind: language.toLowerCase() === "mermaid" ? "mermaid" : "code", source: raw, start, end, language };
  }
  if (containsOnlyImages(node)) return { kind: "image", source: raw, start, end };
  return { kind: "richText", source: raw, start, end };
}

export function isSafeNoteLink(value: string): boolean {
  try {
    const protocol = new URL(value, "https://nota.invalid").protocol;
    return protocol === "http:" || protocol === "https:" || protocol === "mailto:" || protocol === "tel:";
  } catch {
    return false;
  }
}

export function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  if (!source) return [];
  try {
    const tree = parser.parse(source) as unknown as MarkdownNode;
    const { identifiers, offsets } = getSafeLinkDefinitions(tree);
    return (tree.children || [])
      .map(node => {
        return toBlock(node, source, offsets, identifiers);
      })
      .filter((block): block is MarkdownBlock => Boolean(block));
  } catch {
    return [{ kind: "opaque", source, start: 0, end: source.length, reason: "parse-error" }];
  }
}

function collectMathPlaceholders(node: MarkdownNode, source: string, ranges: MarkdownBlock[]): void {
  for (const child of node.children || []) {
    if (child.type === "inlineMath") {
      const range = nodeRange(child);
      if (range && !ranges.some(parent => parent.start <= range.start && parent.end >= range.end)) {
        ranges.push({ kind: "math", source: source.slice(range.start, range.end), ...range, reason: "inline" });
      }
    } else {
      collectMathPlaceholders(child, source, ranges);
    }
  }
}

function encodePlaceholder(value: string): string {
  return encodeURIComponent(value);
}

function createOpaquePlaceholder(source: string): string {
  return `:::nota-opaque-v1 ${encodePlaceholder(source)}\n:::`;
}

/**
 * Gives advanced or unrecognized source blocks safe, reversible tokens before
 * Tiptap parses them. The original source is stored as token data, never HTML.
 */
export function prepareMarkdownForEditor(source: string): { markdown: string; blocks: MarkdownBlock[] } {
  const blocks = parseMarkdownBlocks(source);
  const safeDefinitions = blocks
    .filter(block => block.kind === "opaque" && block.reason === "definition")
    .map(block => block.source);
  let mathRanges: MarkdownBlock[] = [];
  try {
    const tree = parser.parse(source) as unknown as MarkdownNode;
    collectMathPlaceholders(tree, source, mathRanges);
  } catch {
    mathRanges = [];
  }

  const replacements: Array<{ start: number; end: number; text: string }> = [];
  for (const block of blocks) {
    if (block.editorMarkdown) {
      replacements.push({ start: block.start, end: block.end, text: prepareMarkdownForEditor(block.editorMarkdown).markdown });
      continue;
    }
    if (block.kind === "opaque") {
      // Safe link definitions are reference metadata. Keep them in the source
      // passed to Marked so links elsewhere in the document can be rendered.
      // Move them before uses because Marked does not resolve forward references.
      if (block.reason === "definition") {
        let end = block.end;
        while (end < source.length && /\s/.test(source[end]!)) end += 1;
        replacements.push({ start: block.start, end, text: "" });
        continue;
      }
      replacements.push({
        start: block.start,
        end: block.end,
        text: createOpaquePlaceholder(block.source),
      });
    } else if (block.kind === "math" && block.reason !== "inline") {
      const latex = block.source.replace(/^\$\$\s*\r?\n?/, "").replace(/\r?\n?\$\$\s*$/, "");
      replacements.push({ start: block.start, end: block.end, text: `:::nota-math-block-v1 ${encodePlaceholder(latex)}\n:::` });
    }
  }
  for (const block of mathRanges) {
    if (replacements.some(parent => parent.start <= block.start && parent.end >= block.end)) continue;
    const latex = block.source.replace(/^\$|\$$/g, "");
    replacements.push({ start: block.start, end: block.end, text: `[[nota-math-inline-v1:${encodePlaceholder(latex)}]]` });
  }

  let markdown = source;
  replacements.sort((a, b) => b.start - a.start);
  let lastStart = Number.POSITIVE_INFINITY;
  for (const replacement of replacements) {
    if (replacement.end > lastStart) continue;
    markdown = `${markdown.slice(0, replacement.start)}${replacement.text}${markdown.slice(replacement.end)}`;
    lastStart = replacement.start;
  }
  if (safeDefinitions.length) markdown = `${safeDefinitions.join("\n\n")}\n\n${markdown}`;
  return { markdown, blocks };
}

type BlockGroup = { blockIndex: number; start: number; end: number };

function stableDocumentKey(value: unknown): string {
  return JSON.stringify(value, (key, current: unknown) => {
    if (key === "marks" && Array.isArray(current)) {
      return [...current].sort((left, right) => String(left?.type).localeCompare(String(right?.type)));
    }
    if (!current || typeof current !== "object" || Array.isArray(current)) return current;
    const record = current as Record<string, unknown>;
    const normalized = record.type === "orderedList"
      ? { ...record, attrs: { start: 1, type: null, ...(record.attrs as object | undefined) } }
      : record.type === "link"
        ? { ...record, attrs: { target: "_blank", rel: "noopener noreferrer nofollow", class: null, ...(record.attrs as object | undefined) } }
        : record;
    return Object.fromEntries(Object.keys(normalized).sort().map(field => [field, normalized[field]]));
  });
}

function isEmptyParagraph(node: Record<string, unknown> | undefined): boolean {
  return Boolean(node && node.type === "paragraph"
    && (!Array.isArray(node.content) || node.content.length === 0));
}

function mapOriginalBlocksToDocument(
  originalBody: string,
  baselineNodes: Array<Record<string, unknown>>,
  parseDocument: (markdown: string) => { content?: Array<Record<string, unknown>> },
): BlockGroup[] {
  const originalBlocks = parseMarkdownBlocks(originalBody);
  const safeDefinitions = originalBlocks
    .filter(block => block.kind === "opaque" && block.reason === "definition")
    .map(block => block.source);
  const groups: BlockGroup[] = [];
  const flattenedSourceNodes: Array<Record<string, unknown>> = [];
  let leadingEditorNodes = 0;
  if (originalBody !== originalBody.trimStart()) {
    while (isEmptyParagraph(baselineNodes[leadingEditorNodes])) leadingEditorNodes += 1;
  }
  let nodeOffset = leadingEditorNodes;

  originalBlocks.forEach((block, blockIndex) => {
    if (block.kind === "opaque" && block.reason === "definition") {
      // Tiptap consumes definition tokens as parser metadata; they have no
      // visible editor node, but are retained as zero-width source anchors.
      groups.push({ blockIndex, start: nodeOffset, end: nodeOffset });
      return;
    }
    // Classification must come from the complete source document. Some Markdown
    // syntax, such as GFM footnotes, only parses as a special node when its
    // definition is present elsewhere in the note.
    const preparedBlock = block.kind === "opaque"
      ? createOpaquePlaceholder(block.source)
      : prepareMarkdownForEditor(block.source).markdown;
    const prepared = safeDefinitions.length
      ? `${safeDefinitions.join("\n\n")}\n\n${preparedBlock}`
      : preparedBlock;
    const parsedNodes = parseDocument(prepared).content || [];
    if (parsedNodes.length === 0) throw new Error("Markdown source block did not map to an editor block");
    groups.push({ blockIndex, start: nodeOffset, end: nodeOffset + parsedNodes.length });
    flattenedSourceNodes.push(...parsedNodes);
    nodeOffset += parsedNodes.length;
  });

  // Tiptap may append an editable empty paragraph after the source's last
  // block. It has no Markdown source range and must not prevent visual editing.
  const trailingEditorNodes = baselineNodes.slice(nodeOffset);
  const onlyEmptyTrailingParagraphs = trailingEditorNodes.every(isEmptyParagraph);
  if (!onlyEmptyTrailingParagraphs
    || stableDocumentKey(flattenedSourceNodes) !== stableDocumentKey(baselineNodes.slice(leadingEditorNodes, nodeOffset))) {
    const mismatch = flattenedSourceNodes.findIndex((node, index) => stableDocumentKey(node) !== stableDocumentKey(baselineNodes[leadingEditorNodes + index]));
    const index = mismatch < 0 ? nodeOffset : leadingEditorNodes + mismatch;
    throw new Error(`Markdown source blocks could not be aligned at node ${index} (${String(flattenedSourceNodes[index]?.type || "none")} / ${String(baselineNodes[index]?.type || "none")})`);
  }
  return groups;
}

export function canPreserveMarkdownBlocks(input: {
  originalBody: string;
  baselineDocument: { content?: Array<Record<string, unknown>> };
  parseDocument: (markdown: string) => { content?: Array<Record<string, unknown>> };
}): boolean {
  try {
    mapOriginalBlocksToDocument(input.originalBody, input.baselineDocument.content || [], input.parseDocument);
    return true;
  } catch {
    return false;
  }
}

/** Reconstructs the source when only untouched top-level blocks were edited around. */
export function serializeWithOriginalBlocks(input: {
  originalBody: string;
  baselineDocument: { content?: Array<Record<string, unknown>> };
  currentDocument: { content?: Array<Record<string, unknown>> };
  parseDocument?: (markdown: string) => { content?: Array<Record<string, unknown>> };
  serializeDocument: (document: { type: string; content: Array<Record<string, unknown>> }) => string;
}): string {
  const { originalBody, baselineDocument, currentDocument, serializeDocument } = input;
  const originalBlocks = parseMarkdownBlocks(originalBody);
  const baselineNodes = baselineDocument.content || [];
  const currentNodes = currentDocument.content || [];

  let groups: BlockGroup[];
  if (input.parseDocument) {
    groups = mapOriginalBlocksToDocument(originalBody, baselineNodes, input.parseDocument);
  } else {
    if (baselineNodes.length !== originalBlocks.length) {
      throw new Error("Markdown block alignment requires the editor Markdown parser");
    }
    groups = originalBlocks.map((_, blockIndex) => ({ blockIndex, start: blockIndex, end: blockIndex + 1 }));
  }

  const key = (node: Record<string, unknown>) => JSON.stringify(node);
  const same = Array.from({ length: baselineNodes.length + 1 }, () => new Uint32Array(currentNodes.length + 1));
  for (let i = baselineNodes.length - 1; i >= 0; i--) {
    for (let j = currentNodes.length - 1; j >= 0; j--) {
      same[i]![j] = key(baselineNodes[i]!) === key(currentNodes[j]!)
        ? 1 + same[i + 1]![j + 1]!
        : Math.max(same[i + 1]![j]!, same[i]![j + 1]!);
    }
  }

  const currentForBaseline = new Map<number, number>();
  let i = 0;
  let j = 0;
  while (i < baselineNodes.length && j < currentNodes.length) {
    if (key(baselineNodes[i]!) === key(currentNodes[j]!)) {
      currentForBaseline.set(i, j);
      i += 1;
      j += 1;
    } else if (same[i + 1]![j]! >= same[i]![j + 1]!) i += 1;
    else j += 1;
  }

  const anchors = groups.flatMap(group => {
    if (group.start === group.end) {
      const next = currentForBaseline.get(group.start);
      const previous = group.start > 0 ? currentForBaseline.get(group.start - 1) : undefined;
      const position = next ?? (previous === undefined ? 0 : previous + 1);
      return [{ blockIndex: group.blockIndex, start: position, end: position }];
    }
    const mapped = Array.from({ length: group.end - group.start }, (_, offset) => currentForBaseline.get(group.start + offset));
    if (mapped.some(index => index === undefined)) return [];
    const start = mapped[0]!;
    if (mapped.some((index, offset) => index !== start + offset)) return [];
    return [{ blockIndex: group.blockIndex, start, end: start + mapped.length }];
  });

  const pieces: Array<{ markdown: string; blockIndex?: number }> = [];
  let currentOffset = 0;
  for (const anchor of anchors) {
    if (anchor.start < currentOffset) continue;
    if (anchor.start > currentOffset) {
      const markdown = serializeDocument({ type: "doc", content: currentNodes.slice(currentOffset, anchor.start) }).trim();
      if (markdown) pieces.push({ markdown });
    }
    pieces.push({ markdown: originalBlocks[anchor.blockIndex]!.source, blockIndex: anchor.blockIndex });
    currentOffset = anchor.end;
  }
  if (currentOffset < currentNodes.length) {
    const markdown = serializeDocument({ type: "doc", content: currentNodes.slice(currentOffset) }).trim();
    if (markdown) pieces.push({ markdown });
  }

  const first = originalBlocks[0];
  const last = originalBlocks.at(-1);
  const prefix = first ? originalBody.slice(0, first.start) : "";
  const suffix = last ? originalBody.slice(last.end) : "";
  let output = prefix;
  for (let index = 0; index < pieces.length; index += 1) {
    if (index > 0) {
      const prevOriginal = pieces[index - 1]!.blockIndex;
      const nextOriginal = pieces[index]!.blockIndex;
      const originalGap = prevOriginal !== undefined && nextOriginal === prevOriginal + 1
        ? originalBody.slice(originalBlocks[prevOriginal]!.end, originalBlocks[nextOriginal]!.start)
        : "\n\n";
      output += originalGap || "\n\n";
    }
    output += pieces[index]!.markdown;
  }
  output += suffix;
  return output;
}
