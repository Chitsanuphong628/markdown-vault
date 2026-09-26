import { applyNoteBodyChange, parseNoteTheme } from "@/lib/noteTheme";
import { parseMarkdownBlocks, serializeWithOriginalBlocks } from "@/lib/markdownBlocks";

export type RichEditorUnsupportedReason = "table" | "image" | "code" | "math" | "html" | "advanced";
export type RichEditorCompatibility =
  | { supported: true; coverage: "full" | "partial"; opaqueReasons: string[] }
  | { supported: false; reason: RichEditorUnsupportedReason };

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
  const blocks = parseMarkdownBlocks(cleanContent);
  const opaqueReasons = [...new Set(blocks
    .filter(block => block.kind === "opaque" && block.reason !== "definition")
    .map(block => block.reason || "advanced"))];
  return {
    supported: true,
    coverage: opaqueReasons.length ? "partial" : "full",
    opaqueReasons,
  };
}

export function serializeRichEditorMarkdown(input: {
  originalContent: string;
  bodyMarkdown: string;
  baselineDocument: string;
  currentDocument: string;
  parseDocument?: (markdown: string) => { content?: Array<Record<string, unknown>> };
  serializeDocument?: (document: { type: string; content: Array<Record<string, unknown>> }) => string;
}): string {
  if (input.currentDocument === input.baselineDocument) return input.originalContent;
  const { cleanContent, color } = parseNoteTheme(input.originalContent);
  let bodyMarkdown = input.bodyMarkdown;
  if (input.serializeDocument) {
    try {
      bodyMarkdown = serializeWithOriginalBlocks({
        originalBody: cleanContent,
        baselineDocument: JSON.parse(input.baselineDocument),
        currentDocument: JSON.parse(input.currentDocument),
        parseDocument: input.parseDocument,
        serializeDocument: input.serializeDocument,
      });
    } catch (error) {
      if (input.parseDocument) throw error;
      // Callers without the editor parser retain the legacy body serialization path.
    }
  }
  const frontmatter = input.originalContent.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (frontmatter) {
    const originalBodySpacing = cleanContent.match(/^[\t \r\n]*/)?.[0] || "";
    const preservedBody = bodyMarkdown.startsWith(originalBodySpacing)
      ? bodyMarkdown
      : `${originalBodySpacing}${bodyMarkdown}`;
    return `${frontmatter[0]}${preservedBody}`;
  }
  return applyNoteBodyChange(input.originalContent, bodyMarkdown, color);
}
