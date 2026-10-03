import assert from "node:assert/strict";
import test from "node:test";
import {
  NotesOperationError,
  updateNoteSharingWithStore,
  updateNoteWithStore,
  type NoteShareStore,
  type NoteUpdateStore,
} from "../src/modules/notes/server";
import { updateOwnedFolder } from "../src/modules/notes/server/folderLifecycle";

interface TestNote {
  id: string;
  userId: string;
  title: string;
  content: string;
  folderId: string | null;
  revision: number;
}

function makeStore() {
  const note: TestNote = {
    id: "note-a",
    userId: "owner-a",
    title: "Original",
    content: "Original body",
    folderId: null,
    revision: 7,
  };
  let folderOwner = "owner-a";
  const calls: Array<{ userId: string; noteId: string; expectedRevision: number; changes: Record<string, unknown> }> = [];
  const store: NoteUpdateStore<TestNote> = {
    async isFolderOwned(userId, folderId) {
      return folderId === "folder-a" && userId === folderOwner;
    },
    async updateAtRevision(input) {
      calls.push(input);
      if (note.userId !== input.userId || note.id !== input.noteId || note.revision !== input.expectedRevision) {
        return { note: null };
      }
      Object.assign(note, input.changes);
      return { note: { ...note } };
    },
  };
  return { note, calls, store, setFolderOwner: (userId: string) => { folderOwner = userId; } };
}

test("Notes update checks folder ownership before writing", async () => {
  const state = makeStore();
  state.setFolderOwner("owner-b");

  await assert.rejects(
    () => updateNoteWithStore("owner-a", "note-a", { revision: 7, folderId: "folder-a" }, state.store),
    (error: unknown) => error instanceof NotesOperationError && error.code === "folder_not_found",
  );
  assert.equal(state.calls.length, 0);
});

test("Notes update uses owner and expected revision and increments revision once", async () => {
  const state = makeStore();
  const updated = await updateNoteWithStore("owner-a", "note-a", {
    revision: 7,
    content: "Updated body",
  }, state.store);

  assert.equal(state.calls[0].userId, "owner-a");
  assert.equal(state.calls[0].noteId, "note-a");
  assert.equal(state.calls[0].expectedRevision, 7);
  assert.equal(state.calls[0].changes.revision, 8);
  assert.equal(state.calls[0].changes.content, "Updated body");
  assert.equal(state.calls[0].changes.themeColor, "default");
  assert.equal(typeof state.calls[0].changes.updatedAt, "string");
  assert.equal(updated?.revision, 8);
  assert.equal(updated?.title, "Original");
  assert.equal(updated?.content, "Updated body");
});

test("Notes update returns a conflict result when owner or revision no longer matches", async () => {
  const state = makeStore();
  const result = await updateNoteWithStore("owner-b", "note-a", {
    revision: 7,
    title: "Attacker edit",
  }, state.store);

  assert.equal(result, null);
  assert.equal(state.note.title, "Original");
  assert.equal(state.note.revision, 7);
});

test("Notes update maps a database update error to the established 409 conflict", async () => {
  const store: NoteUpdateStore<TestNote> = {
    async isFolderOwned() { return true; },
    async updateAtRevision() { return { note: null, error: new Error("database unavailable") }; },
  };

  await assert.rejects(
    () => updateNoteWithStore("owner-a", "note-a", { revision: 7, title: "Updated" }, store),
    (error: unknown) => error instanceof NotesOperationError
      && error.status === 409
      && error.code === "note_update_failed",
  );
});

test("Notes share revocation is owner-scoped and clears both share identifiers", async () => {
  let request: Parameters<NoteShareStore<{ id: string }>['updateOwnedNote']>[0] | undefined;
  const store: NoteShareStore<{ id: string }> = {
    async updateOwnedNote(input) {
      request = input;
      return { note: { id: input.noteId } };
    },
  };

  await updateNoteSharingWithStore("owner-a", "note-a", false, store, { clearLegacyShareId: true });

  assert.equal(request?.userId, "owner-a");
  assert.equal(request?.noteId, "note-a");
  assert.equal(request?.changes.isShared, false);
  assert.equal(request?.changes.shareToken, null);
  assert.equal(request?.changes.legacyShareId, null);
  assert.equal(typeof request?.changes.updatedAt, "string");
});

test("Notes creates an opaque share token when link sharing is enabled", async () => {
  let changes: Record<string, string | boolean | null | undefined> | undefined;
  const store: NoteShareStore<{ id: string }> = {
    async updateOwnedNote(input) {
      changes = input.changes;
      return { note: { id: input.noteId } };
    },
  };

  await updateNoteSharingWithStore("owner-a", "note-a", true, store, { clearLegacyShareId: true });

  assert.equal(changes?.isShared, true);
  assert.match(String(changes?.shareToken), /^[a-f0-9]{64}$/);
  assert.equal(changes?.legacyShareId, null);
});

test("Notes folder moves pass the authenticated owner and requested parent to the atomic RPC", async () => {
  let call: { name: string; args: Record<string, unknown> } | undefined;
  const folder = { id: "folder-a", parentId: "folder-b" };
  const result = await updateOwnedFolder("owner-a", "folder-a", { parentId: "folder-b" }, {
    async rpc(name, args) {
      call = { name, args };
      return { data: folder, error: null };
    },
  });

  assert.equal(result, folder);
  assert.equal(call?.name, "update_nota_folder");
  assert.equal(call?.args.target_folder_id, "folder-a");
  assert.equal(call?.args.target_user_id, "owner-a");
  assert.equal(call?.args.target_parent_id, "folder-b");
  assert.equal(call?.args.parent_provided, true);
});

test("Notes surfaces the database cycle rejection when a folder move would create a loop", async () => {
  const cycleError = Object.assign(new Error("FOLDER_CYCLE"), { code: "P0001" });
  await assert.rejects(
    () => updateOwnedFolder("owner-a", "folder-a", { parentId: "descendant-a" }, {
      async rpc() { return { data: null, error: cycleError }; },
    }),
    error => error === cycleError,
  );
});
