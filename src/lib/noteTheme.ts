export type NoteColorKey = "default" | "sage" | "ocean" | "lavender" | "peach" | "rose";

export interface NoteThemeOption {
  key: NoteColorKey;
  label: { en: string; th: string };
  dotColor: string;
  cardBg: string;
  cardBorder: string;
  editorBg: string;
  badgeBg: string;
  badgeText: string;
}

export const NOTE_THEMES: Record<NoteColorKey, NoteThemeOption> = {
  default: {
    key: "default",
    label: { en: "Default Dark", th: "ค่าเริ่มต้น" },
    dotColor: "bg-neutral-600",
    cardBg: "bg-neutral-900/60 hover:bg-neutral-800/80",
    cardBorder: "border-neutral-800/80 hover:border-neutral-700",
    editorBg: "bg-neutral-950",
    badgeBg: "bg-neutral-800 text-neutral-400",
    badgeText: "text-neutral-400",
  },
  sage: {
    key: "sage",
    label: { en: "Matcha Sage", th: "เขียวมัทฉะ" },
    dotColor: "bg-emerald-400",
    cardBg: "bg-emerald-950/20 hover:bg-emerald-950/35",
    cardBorder: "border-emerald-800/40 hover:border-emerald-600/50",
    editorBg: "bg-[#091510]",
    badgeBg: "bg-emerald-950/80 text-emerald-300 border border-emerald-800/40",
    badgeText: "text-emerald-400",
  },
  ocean: {
    key: "ocean",
    label: { en: "Ocean Blue", th: "ฟ้าน้ำทะเล" },
    dotColor: "bg-sky-400",
    cardBg: "bg-sky-950/20 hover:bg-sky-950/35",
    cardBorder: "border-sky-800/40 hover:border-sky-600/50",
    editorBg: "bg-[#08131d]",
    badgeBg: "bg-sky-950/80 text-sky-300 border border-sky-800/40",
    badgeText: "text-sky-400",
  },
  lavender: {
    key: "lavender",
    label: { en: "Lavender", th: "ม่วงลาเวนเดอร์" },
    dotColor: "bg-purple-400",
    cardBg: "bg-purple-950/20 hover:bg-purple-950/35",
    cardBorder: "border-purple-800/40 hover:border-purple-600/50",
    editorBg: "bg-[#140b1e]",
    badgeBg: "bg-purple-950/80 text-purple-300 border border-purple-800/40",
    badgeText: "text-purple-400",
  },
  peach: {
    key: "peach",
    label: { en: "Warm Peach", th: "ส้มพีชอุ่น" },
    dotColor: "bg-amber-400",
    cardBg: "bg-amber-950/20 hover:bg-amber-950/35",
    cardBorder: "border-amber-800/40 hover:border-amber-600/50",
    editorBg: "bg-[#191107]",
    badgeBg: "bg-amber-950/80 text-amber-300 border border-amber-800/40",
    badgeText: "text-amber-400",
  },
  rose: {
    key: "rose",
    label: { en: "Gentle Rose", th: "กุหลาบชมพู" },
    dotColor: "bg-rose-400",
    cardBg: "bg-rose-950/20 hover:bg-rose-950/35",
    cardBorder: "border-rose-800/40 hover:border-rose-600/50",
    editorBg: "bg-[#1a0c10]",
    badgeBg: "bg-rose-950/80 text-rose-300 border border-rose-800/40",
    badgeText: "text-rose-400",
  },
};

export function isNoteColorKey(value: unknown): value is NoteColorKey {
  return typeof value === "string" && value in NOTE_THEMES;
}

/**
 * Extracts note theme color and clean content without raw frontmatter
 */
export function parseNoteTheme(rawContent: string): { color: NoteColorKey; cleanContent: string } {
  if (!rawContent) return { color: "default", cleanContent: "" };

  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
  const match = rawContent.match(frontmatterRegex);

  if (!match) {
    return { color: "default", cleanContent: rawContent };
  }

  const frontmatterBody = match[1];
  const cleanContent = rawContent.slice(match[0].length);

  const colorMatch = frontmatterBody.match(/color:\s*["']?([a-zA-Z]+)["']?/);
  const colorKey = colorMatch ? (colorMatch[1].toLowerCase() as NoteColorKey) : "default";

  if (colorKey in NOTE_THEMES) {
    return { color: colorKey, cleanContent };
  }

  return { color: "default", cleanContent };
}

/**
 * Applies or updates the theme color in frontmatter while preserving existing content
 */
export function applyNoteTheme(rawContent: string, newColor: NoteColorKey): string {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
  const match = rawContent.match(frontmatterRegex);

  if (match) {
    let frontmatterBody = match[1];
    const cleanContent = rawContent.slice(match[0].length);

    if (newColor === "default") {
      // Remove color field
      frontmatterBody = frontmatterBody
        .replace(/color:\s*["']?[a-zA-Z]+["']?\r?\n?/, "")
        .trim();
      if (!frontmatterBody) {
        return cleanContent;
      }
      return `---\n${frontmatterBody}\n---\n\n${cleanContent}`;
    }

    if (/color:\s*["']?[a-zA-Z]+["']?/.test(frontmatterBody)) {
      frontmatterBody = frontmatterBody.replace(/color:\s*["']?[a-zA-Z]+["']?/, `color: ${newColor}`);
    } else {
      frontmatterBody = `color: ${newColor}\n${frontmatterBody}`;
    }

    return `---\n${frontmatterBody.trim()}\n---\n\n${cleanContent}`;
  }

  if (newColor === "default") {
    return rawContent;
  }

  return `---\ncolor: ${newColor}\n---\n\n${rawContent}`;
}
