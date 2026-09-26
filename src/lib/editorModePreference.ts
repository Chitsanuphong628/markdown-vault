export type EditorMode = "visual" | "markdown";

export const LEGACY_EDITOR_MODE_KEY = "nota_preferred_editor_mode";
export const EDITOR_MODE_USAGE_KEY = "nota_editor_mode_usage_v1";

type ModeUsage = Record<EditorMode, number>;
type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

function parseCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function readUsage(storage: Pick<Storage, "getItem">): ModeUsage {
  try {
    const raw = storage.getItem(EDITOR_MODE_USAGE_KEY);
    if (!raw) return { visual: 0, markdown: 0 };
    const parsed = JSON.parse(raw) as Partial<Record<EditorMode, unknown>>;
    return { visual: parseCount(parsed.visual), markdown: parseCount(parsed.markdown) };
  } catch {
    return { visual: 0, markdown: 0 };
  }
}

export function readPreferredEditorMode(storage: Pick<Storage, "getItem">): EditorMode {
  const usage = readUsage(storage);
  return usage.markdown > usage.visual ? "markdown" : "visual";
}

export function recordEditorModeChoice(storage: PreferenceStorage, mode: EditorMode): void {
  try {
    const usage = readUsage(storage);
    usage[mode] = Math.min(usage[mode] + 1, Number.MAX_SAFE_INTEGER);
    storage.setItem(EDITOR_MODE_USAGE_KEY, JSON.stringify(usage));
  } catch {
    // The current selection remains active if browser storage is unavailable.
  }
}
