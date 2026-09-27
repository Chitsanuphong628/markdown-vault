import test from "node:test";
import assert from "node:assert/strict";
import { afterIdForMove, beforeIdAtDropPosition, beforeIdForMove, sidebarReorderSchema } from "../src/lib/sidebarOrdering";

const ids = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"];

test("sidebar reorder input distinguishes note folder targets from folder parents", () => {
  assert.equal(sidebarReorderSchema.safeParse({ kind: "note", id: ids[0], targetFolderId: null, beforeId: ids[1] }).success, true);
  assert.equal(sidebarReorderSchema.safeParse({ kind: "note", id: ids[0], targetFolderId: null, afterId: ids[1] }).success, true);
  assert.equal(sidebarReorderSchema.safeParse({ kind: "note", id: ids[0], targetFolderId: null, beforeId: ids[1], afterId: ids[2] }).success, false);
  assert.equal(sidebarReorderSchema.safeParse({ kind: "folder", id: ids[0], targetParentId: ids[1], beforeId: null }).success, true);
  assert.equal(sidebarReorderSchema.safeParse({ kind: "note", id: ids[0], targetParentId: null }).success, false);
  assert.equal(sidebarReorderSchema.safeParse({ kind: "folder", id: ids[0], targetParentId: "not-a-uuid" }).success, false);
});

test("drop placement resolves before, after, and append positions", () => {
  const siblings = ids.map((id) => ({ id }));
  assert.equal(beforeIdAtDropPosition(siblings, ids[1], false), ids[1]);
  assert.equal(beforeIdAtDropPosition(siblings, ids[1], true), ids[2]);
  assert.equal(beforeIdAtDropPosition(siblings, ids[2], true), null);
  assert.equal(beforeIdAtDropPosition(siblings, "missing", false), null);
});

test("reordering removes the dragged row before resolving the after target", () => {
  const siblings = ids.map((id) => ({ id }));
  assert.equal(beforeIdForMove(siblings, ids[2], ids[1], true), null);
  assert.equal(beforeIdForMove(siblings, ids[0], ids[1], true), ids[2]);
  assert.equal(beforeIdForMove(siblings, ids[0], ids[1], false), ids[1]);
});

test("after placement stays anchored to the visible sibling, including the loaded page boundary", () => {
  const siblings = ids.map((id) => ({ id }));
  assert.equal(afterIdForMove(siblings, ids[0], ids[2]), ids[2]);
  assert.equal(afterIdForMove(siblings, ids[0], ids[0]), null);
  assert.equal(afterIdForMove(siblings, ids[0], "missing"), null);
});
