import assert from "node:assert/strict";
import test from "node:test";
import { getVisibleFolderRows } from "../src/modules/notes/client/folderTree";

const folders = [
  { id: "work", name: "Work", parentId: null },
  { id: "ideas", name: "Ideas", parentId: "work" },
  { id: "drafts", name: "Drafts", parentId: "ideas" },
  { id: "personal", name: "Personal", parentId: null },
];

test("moved folders appear beneath their parent when it is open", () => {
  assert.deepEqual(getVisibleFolderRows(folders, new Set()).map(({ folder }) => folder.id), ["work", "personal"]);
  assert.deepEqual(
    getVisibleFolderRows(folders, new Set(["work", "ideas"]))
      .map(({ folder, depth }) => [folder.id, depth]),
    [["work", 0], ["ideas", 1], ["drafts", 2], ["personal", 0]],
  );

  const moved = folders.map(folder => folder.id === "ideas" ? { ...folder, parentId: "personal" } : folder);
  assert.deepEqual(
    getVisibleFolderRows(moved, new Set(["personal", "ideas"]))
      .map(({ folder, depth }) => [folder.id, depth]),
    [["work", 0], ["personal", 0], ["ideas", 1], ["drafts", 2]],
  );
});

test("orphaned and cyclic folders remain reachable", () => {
  const unusual = [
    { id: "orphan", name: "Orphan", parentId: "missing" },
    { id: "child", name: "Child", parentId: "orphan" },
    { id: "cycle-a", name: "A", parentId: "cycle-b" },
    { id: "cycle-b", name: "B", parentId: "cycle-a" },
  ];
  assert.deepEqual(
    getVisibleFolderRows(unusual, new Set(["orphan", "cycle-a", "cycle-b"]))
      .map(({ folder }) => folder.id),
    ["orphan", "child", "cycle-a", "cycle-b"],
  );
});
