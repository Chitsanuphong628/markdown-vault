import { parseNoteTheme } from "@/lib/noteTheme";

export function buildNoteSearchExcerpt(markdown: string, query: string, maxLength = 140): string {
  const plainText = parseNoteTheme(markdown).cleanContent
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(```|~~~)[^\n]*$/gm, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}[-*+]\s+(?:\[[ xX]\]\s+)?/gm, "")
    .replace(/^\s{0,3}\d+[.)]\s+/gm, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[*_~`]/g, "")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
  if (plainText.length <= maxLength) return plainText;

  const term = query.trim().toLocaleLowerCase();
  const index = term ? plainText.toLocaleLowerCase().indexOf(term) : -1;
  const center = index < 0 ? 0 : index;
  const start = Math.max(0, Math.min(center - Math.floor(maxLength / 3), plainText.length - maxLength));
  const end = Math.min(plainText.length, start + maxLength);
  return `${start > 0 ? "…" : ""}${plainText.slice(start, end).trim()}${end < plainText.length ? "…" : ""}`;
}
