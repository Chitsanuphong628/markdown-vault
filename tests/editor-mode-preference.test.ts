import assert from "node:assert/strict";
import test from "node:test";
import {
  EDITOR_MODE_USAGE_KEY,
  LEGACY_EDITOR_MODE_KEY,
  readPreferredEditorMode,
  recordEditorModeChoice,
} from "../src/lib/editorModePreference";

class MemoryStorage {
  constructor(private readonly values: Map<string, string> = new Map()) {}

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

test("a legacy last-used Markdown value does not change the first-load Write default", () => {
  const storage = new MemoryStorage(new Map([[LEGACY_EDITOR_MODE_KEY, "markdown"]]));

  assert.equal(readPreferredEditorMode(storage), "visual");
});

test("Write is the default until the user makes a mode choice", () => {
  assert.equal(readPreferredEditorMode(new MemoryStorage()), "visual");
});

test("the more frequently selected mode wins even when it was not selected last", () => {
  const storage = new MemoryStorage();
  recordEditorModeChoice(storage, "markdown");
  recordEditorModeChoice(storage, "markdown");
  recordEditorModeChoice(storage, "visual");

  assert.deepEqual(JSON.parse(storage.getItem(EDITOR_MODE_USAGE_KEY) || "{}"), { visual: 1, markdown: 2 });
  assert.equal(readPreferredEditorMode(storage), "markdown");
});

test("a tie between mode choices returns to Write", () => {
  const storage = new MemoryStorage();
  recordEditorModeChoice(storage, "markdown");
  recordEditorModeChoice(storage, "visual");

  assert.equal(readPreferredEditorMode(storage), "visual");
});
