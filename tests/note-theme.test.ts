import assert from "node:assert/strict";
import test from "node:test";

import { applyNoteBodyChange, applyNoteTheme, parseNoteTheme } from "../src/lib/noteTheme";

test("visual editor updates the body without dropping note frontmatter", () => {
  const original = "---\ntitle: Original\ntags: [a, b]\ncolor: sage\n---\n\n# Original body";

  const updated = applyNoteBodyChange(original, "# Updated body", "sage");

  assert.match(updated, /^---\ntitle: Original\ntags: \[a, b\]\ncolor: sage\n---/);
  assert.match(updated, /\n# Updated body$/);
});

test("removing a note theme keeps other frontmatter and reports body line offset", () => {
  const original = "---\ntitle: Original\ntags: [a, b]\ncolor: sage\n---\n\n- [ ] Task";

  const parsed = parseNoteTheme(original);
  const updated = applyNoteBodyChange(original, "- [ ] Task", "default");

  assert.equal(parsed.color, "sage");
  assert.equal(parsed.lineOffset, 5);
  assert.match(updated, /^---\ntitle: Original\ntags: \[a, b\]\n---/);
  assert.doesNotMatch(updated, /color:/);
  assert.match(updated, /\n- \[ \] Task$/);
});

test("updating a first frontmatter field keeps the following field separated", () => {
  const original = "---\ncolor: sage\ntitle: Original\n---\n\nBody";
  const updated = applyNoteTheme(original, "ocean");

  assert.match(updated, /^---\ncolor: ocean\ntitle: Original\n---/);
  assert.match(updated, /---\n\n+Body$/);
});
