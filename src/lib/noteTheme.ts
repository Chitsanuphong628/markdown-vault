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

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const COLOR_FIELD_REGEX = /^[ \t]*color:[ \t]*["']?([a-zA-Z]+)["']?[ \t]*$/im;

interface NoteFrontmatter {
  body: string;
  cleanContent: string;
  lineOffset: number;
}

function readNoteFrontmatter(rawContent: string): NoteFrontmatter | null {
  const match = rawContent.match(FRONTMATTER_REGEX);
  if (!match) return null;

  return {
    body: match[1],
    cleanContent: rawContent.slice(match[0].length),
    lineOffset: (match[0].match(/\r?\n/g) || []).length,
  };
}

function updateFrontmatterColor(frontmatterBody: string, newColor: NoteColorKey): string {
  if (newColor === "default") {
    return frontmatterBody.replace(COLOR_FIELD_REGEX, "").trim();
  }

  if (COLOR_FIELD_REGEX.test(frontmatterBody)) {
    return frontmatterBody.replace(COLOR_FIELD_REGEX, `color: ${newColor}`).trim();
  }

  return `color: ${newColor}\n${frontmatterBody}`.trim();
}

function formatFrontmatter(frontmatterBody: string, cleanContent: string): string {
  if (!frontmatterBody) return cleanContent;
  return `---\n${frontmatterBody}\n---\n\n${cleanContent}`;
}

/**
 * Extracts note theme color and clean content without raw frontmatter
 */
export function parseNoteTheme(rawContent: string): { color: NoteColorKey; cleanContent: string; lineOffset: number } {
  if (!rawContent) return { color: "default", cleanContent: "", lineOffset: 0 };

  const frontmatter = readNoteFrontmatter(rawContent);
  if (!frontmatter) {
    return { color: "default", cleanContent: rawContent, lineOffset: 0 };
  }

  const colorMatch = frontmatter.body.match(COLOR_FIELD_REGEX);
  const colorKey = colorMatch ? (colorMatch[1].toLowerCase() as NoteColorKey) : "default";

  if (colorKey in NOTE_THEMES) {
    return { color: colorKey, cleanContent: frontmatter.cleanContent, lineOffset: frontmatter.lineOffset };
  }

  return { color: "default", cleanContent: frontmatter.cleanContent, lineOffset: frontmatter.lineOffset };
}

/**
 * Applies or updates the theme color in frontmatter while preserving existing content
 */
export function applyNoteTheme(rawContent: string, newColor: NoteColorKey): string {
  const frontmatter = readNoteFrontmatter(rawContent);
  if (frontmatter) {
    return formatFrontmatter(updateFrontmatterColor(frontmatter.body, newColor), frontmatter.cleanContent);
  }

  if (newColor === "default") {
    return rawContent;
  }

  return `---\ncolor: ${newColor}\n---\n\n${rawContent}`;
}

/**
 * Replaces the editable body while retaining every non-theme frontmatter field.
 * Visual editors receive the body without YAML metadata, so applying the theme
 * to the editor output alone would otherwise discard titles, tags, and dates.
 */
export function applyNoteBodyChange(
  originalContent: string,
  cleanContent: string,
  newColor: NoteColorKey,
): string {
  const frontmatter = readNoteFrontmatter(originalContent);
  if (!frontmatter) return applyNoteTheme(cleanContent, newColor);

  return formatFrontmatter(updateFrontmatterColor(frontmatter.body, newColor), cleanContent);
}
