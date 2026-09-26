import assert from "node:assert/strict";
import test from "node:test";
import { buildNoteSearchExcerpt } from "../src/lib/noteSearch";

test("returns a short plain-text excerpt around a content match", () => {
  const excerpt = buildNoteSearchExcerpt("---\ntags: [x]\n---\n\n# Heading\n\nIntro **text** and target phrase near the middle.", "target phrase", 32);

  assert.match(excerpt, /target phrase/);
  assert.doesNotMatch(excerpt, /\*\*|^#|tags:/);
  assert.ok(excerpt.length <= 34);
});

test("returns a useful leading excerpt for title-only matches", () => {
  assert.equal(buildNoteSearchExcerpt("First paragraph.\n\nSecond paragraph.", "title"), "First paragraph. Second paragraph.");
});
