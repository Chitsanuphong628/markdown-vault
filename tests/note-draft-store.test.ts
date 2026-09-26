import assert from "node:assert/strict";
import test from "node:test";
import { claimEditorTabId, discardNoteDraft, getNoteDraftKey, isNoteDraftFromCurrentEditor, listNoteDrafts, readNoteDraft, refreshEditorTabLease, releaseEditorTabLease, saveNoteDraft, selectNoteDraftForEditor, type NoteDraftRecord, type StorageLike } from "../src/lib/noteDraftStore";

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key: index => Array.from(values.keys())[index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
}

const draft: NoteDraftRecord = {
  userId: "user-1",
  noteId: "note-1",
  title: "Local title",
  content: "Local body",
  baseRevision: 4,
  baseTitle: "Saved title",
  baseContent: "Saved body",
  editorTabId: "stable-tab-1",
  updatedAt: "2026-09-25T00:00:00.000Z",
};

test("stores drafts under a user and note specific key", () => {
  const storage = memoryStorage();
  saveNoteDraft(storage, draft);

  assert.equal(readNoteDraft(storage, "user-1", "note-1")?.content, "Local body");
  assert.equal(readNoteDraft(storage, "user-2", "note-1"), null);
  assert.equal(getNoteDraftKey("user-1", "note-1"), "nota:draft:v1:user-1:note-1");
});

test("removes a draft after the server confirms its save", () => {
  const storage = memoryStorage();
  saveNoteDraft(storage, draft);
  discardNoteDraft(storage, "user-1", "note-1");

  assert.equal(readNoteDraft(storage, "user-1", "note-1"), null);
});

test("ignores malformed or mismatched draft records", () => {
  const storage = memoryStorage();
  storage.setItem(getNoteDraftKey("user-1", "note-1"), JSON.stringify({ ...draft, userId: "user-2" }));

  assert.equal(readNoteDraft(storage, "user-1", "note-1"), null);
});

test("lists only the user's drafts newest first", () => {
  const storage = memoryStorage();
  saveNoteDraft(storage, { ...draft, updatedAt: "2026-09-24T00:00:00.000Z" });
  saveNoteDraft(storage, { ...draft, noteId: "local:second", updatedAt: "2026-09-25T00:00:00.000Z" });
  saveNoteDraft(storage, { ...draft, userId: "user-2", noteId: "other", updatedAt: "2026-09-26T00:00:00.000Z" });

  assert.deepEqual(listNoteDrafts(storage, "user-1").map(item => item.noteId), ["local:second", "note-1"]);
});

test("keeps drafts from separate tabs under separate keys", () => {
  const storage = memoryStorage();
  saveNoteDraft(storage, { ...draft, tabId: "tab-a", content: "First tab" });
  saveNoteDraft(storage, { ...draft, tabId: "tab-b", content: "Second tab" });

  assert.equal(readNoteDraft(storage, "user-1", "note-1", "tab-a")?.content, "First tab");
  assert.equal(readNoteDraft(storage, "user-1", "note-1", "tab-b")?.content, "Second tab");
  assert.deepEqual(new Set(listNoteDrafts(storage, "user-1").map(item => item.content)), new Set(["First tab", "Second tab"]));
});

test("recognizes a recovered draft from the same session tab after a page reload", () => {
  const previousDocumentDraft = { ...draft, tabId: "document-owner-before-reload", editorTabId: "stable-session-tab" };

  assert.equal(selectNoteDraftForEditor([previousDocumentDraft], "document-owner-after-reload", "stable-session-tab"), previousDocumentDraft);
  assert.equal(isNoteDraftFromCurrentEditor(previousDocumentDraft, "document-owner-after-reload", "stable-session-tab", true), true);
  assert.equal(isNoteDraftFromCurrentEditor(previousDocumentDraft, "document-owner-after-reload", "stable-session-tab", false), false);
});

test("prefers the current document's isolated draft when editor session ids were copied", () => {
  const otherPageDraft = { ...draft, tabId: "document-owner-other", editorTabId: "copied-session-tab", content: "Other draft" };
  const currentPageDraft = { ...draft, tabId: "document-owner-current", editorTabId: "copied-session-tab", content: "Current draft" };

  assert.equal(selectNoteDraftForEditor([otherPageDraft, currentPageDraft], "document-owner-current", "copied-session-tab"), currentPageDraft);
  assert.equal(isNoteDraftFromCurrentEditor(otherPageDraft, "document-owner-current", "copied-session-tab", false), false);
});

test("treats duplicate drafts with one stable session id as ambiguous after a reload", () => {
  const firstDocumentDraft = { ...draft, tabId: "document-owner-first", editorTabId: "copied-session-tab" };
  const secondDocumentDraft = { ...draft, tabId: "document-owner-second", editorTabId: "copied-session-tab", content: "Second version" };

  assert.equal(selectNoteDraftForEditor([firstDocumentDraft, secondDocumentDraft], "new-document-owner", "copied-session-tab"), firstDocumentDraft);
  assert.equal(isNoteDraftFromCurrentEditor(firstDocumentDraft, "new-document-owner", "copied-session-tab", true, 2), false);
  assert.equal(isNoteDraftFromCurrentEditor(firstDocumentDraft, "new-document-owner", "copied-session-tab", true, 1), true);
});

test("recognizes legacy drafts keyed by the stable editor session id", () => {
  const legacyDraft = { ...draft, tabId: "stable-session-tab", editorTabId: undefined };

  assert.equal(selectNoteDraftForEditor([legacyDraft], "new-document-owner", "stable-session-tab"), legacyDraft);
  assert.equal(isNoteDraftFromCurrentEditor(legacyDraft, "new-document-owner", "stable-session-tab", true), true);
});

test("reuses an editor tab id after its previous page releases the lease for reload", () => {
  const sessionStorage = memoryStorage();
  const sharedStorage = memoryStorage();
  let nextId = 0;
  const createId = () => `tab-${++nextId}`;

  assert.equal(claimEditorTabId(sessionStorage, sharedStorage, createId, "owner-a", 100), "tab-1");
  releaseEditorTabLease(sharedStorage, "tab-1", "owner-a");
  assert.equal(claimEditorTabId(sessionStorage, sharedStorage, createId, "owner-b", 200), "tab-1");
  assert.equal(nextId, 1);
});

test("uses separate session storage to distinguish concurrent tabs", () => {
  const sharedStorage = memoryStorage();
  let nextId = 0;
  const createId = () => `tab-${++nextId}`;

  assert.equal(claimEditorTabId(memoryStorage(), sharedStorage, createId, "owner-a", 100), "tab-1");
  assert.equal(claimEditorTabId(memoryStorage(), sharedStorage, createId, "owner-b", 100), "tab-2");
});

test("assigns a new id when a duplicated tab inherits another active tab's session storage", () => {
  const sharedStorage = memoryStorage();
  const firstSession = memoryStorage();
  const duplicateSession = memoryStorage();
  let nextId = 0;
  const createId = () => `tab-${++nextId}`;

  const firstTabId = claimEditorTabId(firstSession, sharedStorage, createId, "owner-a", 100);
  duplicateSession.setItem("nota:editor-tab:v1", firstSession.getItem("nota:editor-tab:v1")!);
  const duplicateTabId = claimEditorTabId(duplicateSession, sharedStorage, createId, "owner-b", 101);

  assert.equal(firstTabId, "tab-1");
  assert.equal(duplicateTabId, "tab-2");
  assert.equal(refreshEditorTabLease(sharedStorage, firstTabId, "owner-a", 102), true);
});

test("allows reuse after an editor tab lease expires", () => {
  const sessionStorage = memoryStorage();
  const sharedStorage = memoryStorage();
  let nextId = 0;
  const createId = () => `tab-${++nextId}`;

  assert.equal(claimEditorTabId(sessionStorage, sharedStorage, createId, "owner-a", 100), "tab-1");
  assert.equal(claimEditorTabId(sessionStorage, sharedStorage, createId, "owner-b", 60_101), "tab-1");
});

test("lets a resumed tab rotate its id after a duplicate claimed its expired lease", () => {
  const sharedStorage = memoryStorage();
  const originalSession = memoryStorage();
  const duplicateSession = memoryStorage();
  let nextId = 0;
  const createId = () => `tab-${++nextId}`;

  const originalId = claimEditorTabId(originalSession, sharedStorage, createId, "owner-a", 100);
  duplicateSession.setItem("nota:editor-tab:v1", originalSession.getItem("nota:editor-tab:v1")!);
  const duplicateId = claimEditorTabId(duplicateSession, sharedStorage, createId, "owner-b", 60_101);
  assert.equal(duplicateId, originalId);

  assert.equal(refreshEditorTabLease(sharedStorage, originalId, "owner-a", 60_102), false);
  const resumedId = claimEditorTabId(originalSession, sharedStorage, createId, "owner-a", 60_102);
  assert.equal(resumedId, "tab-2");
  assert.equal(refreshEditorTabLease(sharedStorage, resumedId, "owner-a", 60_103), true);
});

test("keeps an in-memory editor id when shared browser storage is unavailable", () => {
  const unavailableStorage: StorageLike = {
    getItem: () => { throw new Error("Storage disabled"); },
    setItem: () => { throw new Error("Storage disabled"); },
    removeItem: () => { throw new Error("Storage disabled"); },
  };
  let nextId = 0;
  const tabId = claimEditorTabId(memoryStorage(), unavailableStorage, () => `tab-${++nextId}`, "owner-a", 100);

  assert.equal(typeof tabId, "string");
  assert.ok(tabId.length > 0);
});
