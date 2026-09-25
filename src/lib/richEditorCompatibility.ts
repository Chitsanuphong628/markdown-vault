import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { applyNoteBodyChange, parseNoteTheme } from "@/lib/noteTheme";

export type RichEditorUnsupportedReason = "table" | "image" | "code" | "math" | "html" | "advanced";
export type RichEditorCompatibility = { supported: true } | { supported: false; reason: RichEditorUnsupportedReason };

type MarkdownNode = {
  type: string;
  depth?: number;
  ordered?: boolean;
  start?: number | null;
  checked?: boolean | null;
  title?: string | null;
  url?: string;
  children?: MarkdownNode[];
};

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

const REASON_BY_NODE: Record<string, RichEditorUnsupportedReason> = {
  table: "table",
  image: "image",
  code: "code",
  inlineCode: "code",
  math: "math",
  inlineMath: "math",
  html: "html",
  definition: "advanced",
  footnoteDefinition: "advanced",
  footnoteReference: "advanced",
  linkReference: "advanced",
  imageReference: "advanced",
};

const SUPPORTED_NODES = new Set([
  "root",
  "paragraph",
  "heading",
  "text",
  "emphasis",
  "strong",
  "delete",
  "link",
  "break",
  "blockquote",
  "list",
  "listItem",
  "thematicBreak",
]);

function findUnsupportedNode(node: MarkdownNode): RichEditorUnsupportedReason | null {
  const knownReason = REASON_BY_NODE[node.type];
  if (knownReason) return knownReason;
  if (!SUPPORTED_NODES.has(node.type)) return "advanced";
  if (node.type === "heading" && (node.depth ?? 0) > 3) return "advanced";
  if (node.type === "link" && node.title) return "advanced";
  if (node.type === "link" && !isSupportedRichEditorLinkUrl(node.url || "")) return "advanced";
  if (node.type === "list" && node.ordered && node.start !== null && node.start !== undefined && node.start !== 1) return "advanced";
  if (node.type === "list") {
    const listItems = (node.children || []).filter(child => child.type === "listItem");
    const containsTasks = listItems.some(item => typeof item.checked === "boolean");
    const containsRegularItems = listItems.some(item => typeof item.checked !== "boolean");
    if (containsTasks && containsRegularItems) return "advanced";
  }

  for (const child of node.children || []) {
    const reason = findUnsupportedNode(child);
    if (reason) return reason;
  }

  return null;
}

export function isSupportedRichEditorLinkUrl(value: string): boolean {
  try {
    const protocol = new URL(value, "https://nota.invalid").protocol;
    return protocol === "http:" || protocol === "https:" || protocol === "mailto:" || protocol === "tel:";
  } catch {
    return false;
  }
}

/**
 * Visual editing only accepts Markdown constructs the rich editor can round-trip.
 * Frontmatter is kept outside the editor and therefore does not affect eligibility.
 */
export function getRichEditorCompatibility(markdown: string): RichEditorCompatibility {
  const { cleanContent } = parseNoteTheme(markdown);
  try {
    const tree = parser.parse(cleanContent) as unknown as MarkdownNode;
    const reason = findUnsupportedNode(tree);
    return reason ? { supported: false, reason } : { supported: true };
  } catch {
    return { supported: false, reason: "advanced" };
  }
}

export function serializeRichEditorMarkdown(input: {
  originalContent: string;
  bodyMarkdown: string;
  baselineDocument: string;
  currentDocument: string;
}): string {
  if (input.currentDocument === input.baselineDocument) return input.originalContent;
  return applyNoteBodyChange(input.originalContent, input.bodyMarkdown, parseNoteTheme(input.originalContent).color);
}
