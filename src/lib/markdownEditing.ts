export type MarkdownAction =
  | "bold" | "italic" | "strike" | "heading" | "bullet" | "numbered"
  | "task" | "quote" | "code" | "codeBlock" | "table" | "math"
  | "mathBlock" | "mermaid" | "link" | "image";

export type MarkdownEdit = { text: string; selectionStart: number; selectionEnd: number };

export function isSafeImageUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isNoteDraftDirty(
  saved: { title: string; content: string },
  draft: { title: string; content: string },
): boolean {
  return saved.title !== draft.title || saved.content !== draft.content;
}

export function editMarkdownSelection(
  source: string,
  start: number,
  end: number,
  action: MarkdownAction,
  url?: string,
): MarkdownEdit {
  const from = Math.max(0, Math.min(start, source.length));
  const to = Math.max(from, Math.min(end, source.length));
  const selected = source.slice(from, to);
  let inserted = "";
  let selectionStart = from;
  let selectionEnd = from;

  const wrap = (before: string, after: string, placeholder: string) => {
    const inner = selected || placeholder;
    inserted = `${before}${inner}${after}`;
    selectionStart = from + before.length;
    selectionEnd = selectionStart + inner.length;
  };

  switch (action) {
    case "bold": wrap("**", "**", "ข้อความ"); break;
    case "italic": wrap("*", "*", "ข้อความ"); break;
    case "strike": wrap("~~", "~~", "ข้อความ"); break;
    case "code": wrap("`", "`", "code"); break;
    case "math": wrap("$", "$", "x^2"); break;
    case "link":
    case "image": {
      if (!url || !isSafeImageUrl(url)) throw new Error("ใช้ URL แบบ HTTPS เท่านั้น");
      const label = selected || (action === "image" ? "รูปภาพ" : "ข้อความลิงก์");
      const marker = action === "image" ? "![" : "[";
      const markdownUrl = new URL(url.trim()).href.replace(/[()]/g, character => character === "(" ? "%28" : "%29");
      inserted = `${marker}${label}](${markdownUrl})`;
      selectionStart = from + marker.length;
      selectionEnd = selectionStart + label.length;
      break;
    }
    case "heading":
    case "bullet":
    case "numbered":
    case "task":
    case "quote": {
      const prefix = {
        heading: "## ", bullet: "- ", numbered: "1. ", task: "- [ ] ", quote: "> ",
      }[action];
      const lineStart = source.lastIndexOf("\n", from - 1) + 1;
      const selectionEnd = to > from && source[to - 1] === "\n" ? to - 1 : to;
      const lineEndIndex = source.indexOf("\n", selectionEnd);
      const lineEnd = lineEndIndex === -1 ? source.length : lineEndIndex;
      const lines = source.slice(lineStart, lineEnd).split("\n");
      inserted = lines.map(line => `${prefix}${line}`).join("\n");
      const text = source.slice(0, lineStart) + inserted + source.slice(lineEnd);
      return { text, selectionStart: lineStart + prefix.length, selectionEnd: lineStart + inserted.length };
    }
    case "codeBlock": wrap("```\n", "\n```", "code"); break;
    case "mathBlock": wrap("$$\n", "\n$$", "x^2"); break;
    case "mermaid": wrap("```mermaid\n", "\n```", "graph TD\n  A-->B"); break;
    case "table": {
      inserted = "| หัวข้อ | รายละเอียด |\n| --- | --- |\n| รายการ | ข้อความ |";
      selectionStart = from;
      selectionEnd = from + inserted.length;
      break;
    }
  }

  return { text: source.slice(0, from) + inserted + source.slice(to), selectionStart, selectionEnd };
}
