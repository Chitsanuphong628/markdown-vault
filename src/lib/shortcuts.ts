export type ShortcutActionId =
  | "search"
  | "settings"
  | "newNote"
  | "findInNote"
  | "voice"
  | "toggleEdit"
  | "saveNote";

export interface ShortcutMeta {
  id: ShortcutActionId;
  label: { en: string; th: string };
  desc: { en: string; th: string };
  defaultKey: string;
}

export const DEFAULT_SHORTCUTS: Record<ShortcutActionId, ShortcutMeta> = {
  search: {
    id: "search",
    label: { en: "Search notes", th: "ค้นหาโน้ต" },
    desc: { en: "Focus search across note titles and content", th: "ค้นหาจากชื่อและเนื้อหาโน้ต" },
    defaultKey: "mod+k",
  },
  settings: {
    id: "settings",
    label: { en: "Open settings", th: "เปิดการตั้งค่า" },
    desc: { en: "Open settings", th: "เปิดการตั้งค่า" },
    defaultKey: "mod+,",
  },
  newNote: {
    id: "newNote",
    label: { en: "New note", th: "โน้ตใหม่" },
    desc: { en: "Create a note in the current folder", th: "สร้างโน้ตในโฟลเดอร์ปัจจุบัน" },
    defaultKey: "mod+n",
  },
  findInNote: {
    id: "findInNote",
    label: { en: "Find in note", th: "ค้นหาในโน้ต" },
    desc: { en: "Find text in the open note", th: "ค้นหาคำในโน้ตที่เปิดอยู่" },
    defaultKey: "mod+f",
  },
  voice: {
    id: "voice",
    label: { en: "Voice input", th: "จดด้วยเสียง" },
    desc: { en: "Start or stop voice input", th: "เริ่มหรือหยุดจดด้วยเสียง" },
    defaultKey: "alt+space",
  },
  toggleEdit: {
    id: "toggleEdit",
    label: { en: "Switch writing mode", th: "สลับโหมดเขียน" },
    desc: { en: "Switch between Write and Markdown", th: "สลับระหว่างโหมดเขียนกับ Markdown" },
    defaultKey: "mod+e",
  },
  saveNote: {
    id: "saveNote",
    label: { en: "Save note", th: "บันทึกโน้ต" },
    desc: { en: "Save the open note", th: "บันทึกโน้ตที่เปิดอยู่" },
    defaultKey: "mod+s",
  },
};

const STORAGE_KEY = "nota_custom_shortcuts_v1";

export function isMac(): boolean {
  if (typeof window === "undefined" || !window.navigator) return false;
  return /Mac|iPod|iPhone|iPad/.test(window.navigator.userAgent);
}

/**
 * Reads customized shortcuts from localStorage or returns default keys
 */
export function getShortcuts(): Record<ShortcutActionId, string> {
  const result: Record<ShortcutActionId, string> = {
    search: DEFAULT_SHORTCUTS.search.defaultKey,
    settings: DEFAULT_SHORTCUTS.settings.defaultKey,
    newNote: DEFAULT_SHORTCUTS.newNote.defaultKey,
    findInNote: DEFAULT_SHORTCUTS.findInNote.defaultKey,
    voice: DEFAULT_SHORTCUTS.voice.defaultKey,
    toggleEdit: DEFAULT_SHORTCUTS.toggleEdit.defaultKey,
    saveNote: DEFAULT_SHORTCUTS.saveNote.defaultKey,
  };

  if (typeof window === "undefined") return result;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const key of Object.keys(result) as ShortcutActionId[]) {
        if (typeof parsed[key] === "string" && parsed[key].trim()) {
          result[key] = parsed[key].trim().toLowerCase();
        }
      }
    }
  } catch {
    // Ignore JSON parse errors and return defaults
  }

  return result;
}

/**
 * Saves a customized shortcut key combination
 */
export function saveShortcut(id: ShortcutActionId, keyCombo: string): void {
  if (typeof window === "undefined") return;
  const current = getShortcuts();
  current[id] = keyCombo.trim().toLowerCase();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  window.dispatchEvent(new CustomEvent("nota:shortcuts-changed", { detail: current }));
}

/**
 * Resets all shortcuts to default configuration
 */
export function resetShortcuts(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  const defaults = getShortcuts();
  window.dispatchEvent(new CustomEvent("nota:shortcuts-changed", { detail: defaults }));
}

/**
 * Normalizes KeyboardEvent into a shortcut string (e.g. "mod+k", "alt+space", "mod+shift+p")
 */
export function eventToKeyCombo(e: KeyboardEvent): string | null {
  const isModifierOnly = ["Control", "Meta", "Alt", "Shift"].includes(e.key);
  if (isModifierOnly) return null;

  const parts: string[] = [];

  // Mod (Cmd on Mac, Ctrl on others)
  const mac = isMac();
  const hasMod = mac ? e.metaKey : e.ctrlKey;
  if (hasMod) parts.push("mod");

  // Explicit ctrl if on Mac and Ctrl is pressed
  if (mac && e.ctrlKey) parts.push("ctrl");

  // Alt/Option
  if (e.altKey) parts.push("alt");

  // Shift
  if (e.shiftKey) parts.push("shift");

  // Key normalization
  let key = e.key.toLowerCase();
  if (e.code === "Space" || key === " ") key = "space";
  if (key === "escape") key = "esc";

  // Require at least one modifier key or an F-key to avoid hijacking normal typing
  const isFunctionKey = /^f\d{1,2}$/.test(key);
  if (parts.length === 0 && !isFunctionKey) {
    return null;
  }

  parts.push(key);
  return parts.join("+");
}

/**
 * Checks whether a KeyboardEvent matches a normalized combo string
 */
export function matchesShortcut(e: KeyboardEvent, combo: string): boolean {
  if (!combo) return false;
  const parts = combo.toLowerCase().split("+").map((p) => p.trim());
  const mac = isMac();

  const reqMod = parts.includes("mod");
  const reqCtrl = parts.includes("ctrl");
  const reqAlt = parts.includes("alt");
  const reqShift = parts.includes("shift");

  const expectedKey = parts.filter((p) => !["mod", "ctrl", "alt", "shift"].includes(p))[0];
  if (!expectedKey) return false;

  // Check Modifiers
  const actualMod = mac ? e.metaKey : e.ctrlKey;
  if (reqMod !== actualMod) return false;

  if (mac) {
    if (reqCtrl !== e.ctrlKey) return false;
  }
  if (reqAlt !== e.altKey) return false;
  if (reqShift !== e.shiftKey) return false;

  // Check Key
  let actualKey = e.key.toLowerCase();
  if (e.code === "Space" || actualKey === " ") actualKey = "space";
  if (actualKey === "escape") actualKey = "esc";

  return actualKey === expectedKey;
}

/**
 * Formats a combo string into human-readable symbols (e.g. "mod+k" -> "⌘K" on Mac, "Ctrl+K" on Windows)
 */
export function formatComboDisplay(combo: string): string {
  if (!combo) return "";
  const parts = combo.toLowerCase().split("+").map((p) => p.trim());
  const mac = isMac();

  const symbols: string[] = [];

  if (parts.includes("mod")) {
    symbols.push(mac ? "⌘" : "Ctrl");
  }
  if (mac && parts.includes("ctrl")) {
    symbols.push("⌃");
  }
  if (parts.includes("alt")) {
    symbols.push(mac ? "⌥" : "Alt");
  }
  if (parts.includes("shift")) {
    symbols.push(mac ? "⇧" : "Shift");
  }

  const keyPart = parts.filter((p) => !["mod", "ctrl", "alt", "shift"].includes(p))[0];
  if (keyPart) {
    if (keyPart === "space") symbols.push("Space");
    else if (keyPart === "esc") symbols.push("Esc");
    else symbols.push(keyPart.toUpperCase());
  }

  return symbols.join(mac ? "" : "+");
}
