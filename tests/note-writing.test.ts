import assert from "node:assert/strict";
import test from "node:test";
import { NoteWriteCoordinator, type EditableNote } from "../src/lib/noteWriting";

const initial: EditableNote = { id: "note-a", title: "A", content: "start", folderId: null, revision: 0 };

test("concurrent content edits serialize and each sees the latest saved note", async () => {
  const requests: Array<{ revision: number; content?: string }> = [];
  const writes = new NoteWriteCoordinator(async (_id, patch, revision) => {
    requests.push({ revision, content: patch.content });
    return { ...initial, ...patch, revision: revision + 1 };
  });
  writes.observeNote(initial);
  const first = writes.write("note-a", (current) => ({ content: `${current.content}\nvoice` }));
  const second = writes.write("note-a", (current) => ({ content: `${current.content}\nchart` }));
  await Promise.all([first, second]);
  assert.deepEqual(requests, [
    { revision: 0, content: "start\nvoice" },
    { revision: 1, content: "start\nvoice\nchart" },
  ]);
});

test("a failed save keeps the last confirmed revision for the next write", async () => {
  let attempts = 0;
  const writes = new NoteWriteCoordinator(async (_id, patch, revision) => {
    attempts += 1;
    assert.equal(revision, 0);
    if (attempts === 1) throw new Error("network failed");
    return { ...initial, ...patch, revision: 1 };
  });
  writes.observeNote(initial);
  await assert.rejects(writes.write("note-a", { content: "unsaved" }), /network failed/);
  const saved = await writes.write("note-a", { content: "confirmed" });
  assert.equal(saved.content, "confirmed");
  assert.equal(saved.revision, 1);
});

test("an older detail response cannot replace a newer saved revision", async () => {
  const writes = new NoteWriteCoordinator(async () => ({ ...initial, content: "newer", revision: 2 }));
  writes.observeNote(initial);
  await writes.write("note-a", { content: "newer" });
  assert.equal(writes.observeNote({ ...initial, content: "stale" }), false);
  assert.equal(writes.getNote("note-a")?.content, "newer");
});

test("a newer summary invalidates stale cached content before a content edit", async () => {
  const writes = new NoteWriteCoordinator(async () => { throw new Error("must not persist stale content"); });
  writes.observeNote(initial);
  writes.observeRevision("note-a", 2);
  await assert.rejects(writes.write("note-a", (current) => ({ content: `${current.content}\nnew` })), /reload before editing/);
});

test("an older write response does not replace a newer observed revision", async () => {
  let release: ((note: EditableNote) => void) | undefined;
  const writes = new NoteWriteCoordinator(() => new Promise((resolve) => { release = resolve; }));
  writes.observeNote(initial);
  const pending = writes.write("note-a", { content: "saved" });
  await new Promise((resolve) => setImmediate(resolve));
  writes.observeRevision("note-a", 3);
  release?.({ ...initial, content: "saved", revision: 1 });
  await assert.rejects(pending, /newer note version/);
  assert.equal(writes.getNote("note-a"), undefined);
});

test("write failure is reported once through the coordinator interface", async () => {
  const failures: string[] = [];
  const writes = new NoteWriteCoordinator(async () => { throw new Error("conflict"); }, undefined,
    (_id, error) => failures.push(error.message));
  writes.observeNote(initial);
  await assert.rejects(writes.write("note-a", { title: "B" }), /conflict/);
  assert.deepEqual(failures, ["conflict"]);
});
