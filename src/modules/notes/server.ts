import crypto from "node:crypto";
import { escapePostgrestSearch, getSupabaseAdmin } from "@/platform/server";
import { isNoteColorKey, parseNoteTheme } from "@/modules/content/shared";
import { buildNoteSearchExcerpt } from "@/modules/notes/shared";
import { deleteEmptyFolder, updateOwnedFolder } from "./server/folderLifecycle";

export const NOTES_PAGE_SIZE = 50;

export class NotesOperationError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "NotesOperationError";
  }
}

export interface NoteListOptions {
  query?: string;
  folderId?: string | null;
  page?: number;
}

/** Notes is the only module allowed to query the Note table. */
export async function listNotesForOwner(userId: string, options: NoteListOptions = {}) {
  const page = options.page ?? 0;
  const queryText = options.query ?? "";
  let query = getSupabaseAdmin()
    .from("Note")
    .select(queryText
      ? "id, title, content, themeColor, folderId, createdAt, updatedAt, revision"
      : "id, title, themeColor, folderId, createdAt, updatedAt, revision")
    .eq("userId", userId)
    .order("updatedAt", { ascending: false });

  if (options.folderId) query = query.eq("folderId", options.folderId);
  if (queryText) {
    const searchTerm = escapePostgrestSearch(queryText);
    query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`);
  }

  const { data, error } = await query.range(page * NOTES_PAGE_SIZE, page * NOTES_PAGE_SIZE + NOTES_PAGE_SIZE - 1);
  if (error) throw error;

  const notes = (data || []).map((note: {
    id: string;
    title: string;
    themeColor?: string | null;
    folderId: string | null;
    createdAt: string;
    updatedAt: string;
    revision: number;
    content?: string;
  }) => ({
    id: note.id,
    title: note.title,
    folderId: note.folderId,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    revision: note.revision,
    color: isNoteColorKey(note.themeColor) ? note.themeColor : "default",
    ...(queryText ? { excerpt: buildNoteSearchExcerpt(note.content || "", queryText) } : {}),
  }));

  return { notes, page, pageSize: NOTES_PAGE_SIZE, hasMore: notes.length === NOTES_PAGE_SIZE };
}

/** MCP keeps its established tool response fields while sharing Notes-owned queries. */
export async function listNotesForMcp(userId: string, options: {
  folderId?: string;
  searchQuery?: string;
  limit: number;
}) {
  let query = getSupabaseAdmin().from("Note")
    .select("id, title, folderId, isShared, createdAt, updatedAt, revision")
    .eq("userId", userId).order("updatedAt", { ascending: false }).limit(options.limit);
  if (options.folderId) query = query.eq("folderId", options.folderId);
  if (options.searchQuery) {
    const term = escapePostgrestSearch(options.searchQuery);
    query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getNoteForMcp(userId: string, noteId: string) {
  const { data, error } = await getSupabaseAdmin().from("Note")
    .select("id, title, content, folderId, isShared, createdAt, updatedAt, revision")
    .eq("id", noteId).eq("userId", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getNoteForOwner(userId: string, noteId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("Note")
    .select("*, folder:Folder(name)")
    .eq("id", noteId)
    .eq("userId", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function assertOwnedFolder(userId: string, folderId: string | null | undefined, missingMessage = "Folder not found") {
  if (!folderId) return;
  const { data, error } = await getSupabaseAdmin().from("Folder")
    .select("id").eq("id", folderId).eq("userId", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotesOperationError(missingMessage, 404, "folder_not_found");
}

export async function createNoteForOwner(userId: string, input: {
  title: string;
  content: string;
  folderId?: string | null;
}) {
  await assertOwnedFolder(userId, input.folderId);
  const { data, error } = await getSupabaseAdmin().from("Note").insert([{
    title: input.title,
    content: input.content,
    themeColor: parseNoteTheme(input.content).color,
    folderId: input.folderId || null,
    userId,
  }]).select("*").single();
  if (error) throw error;
  return data;
}

export interface NoteUpdateStore<TNote> {
  isFolderOwned(userId: string, folderId: string): Promise<boolean>;
  updateAtRevision(input: {
    userId: string;
    noteId: string;
    expectedRevision: number;
    changes: Record<string, string | number | null>;
  }): Promise<{ note: TNote | null; error?: unknown }>;
}

/** Use case shared by the API and MCP. Store implementations must compare owner and revision atomically. */
export async function updateNoteWithStore<TNote>(userId: string, noteId: string, patch: {
  title?: string;
  content?: string;
  folderId?: string | null;
  revision: number;
}, store: NoteUpdateStore<TNote>) {
  if (patch.folderId && !(await store.isFolderOwned(userId, patch.folderId))) {
    throw new NotesOperationError("Folder not found", 404, "folder_not_found");
  }

  const changes: Record<string, string | number | null> = {
    updatedAt: new Date().toISOString(),
    revision: patch.revision + 1,
  };
  if (patch.title !== undefined) changes.title = patch.title;
  if (patch.content !== undefined) {
    changes.content = patch.content;
    changes.themeColor = parseNoteTheme(patch.content).color;
  }
  if (patch.folderId !== undefined) changes.folderId = patch.folderId || null;

  const result = await store.updateAtRevision({
    userId,
    noteId,
    expectedRevision: patch.revision,
    changes,
  });
  // The existing PATCH contract treats both a compare-and-swap miss and a
  // failed update query as a conflict. Keep that response stable for callers.
  if (result.error) {
    throw new NotesOperationError("Note was changed by another session", 409, "note_update_failed");
  }
  return result.note;
}

export async function updateNoteForOwner(userId: string, noteId: string, patch: {
  title?: string;
  content?: string;
  folderId?: string | null;
  revision: number;
}) {
  const db = getSupabaseAdmin();
  return updateNoteWithStore(userId, noteId, patch, {
    async isFolderOwned(ownerId, folderId) {
      const { data, error } = await db.from("Folder").select("id")
        .eq("id", folderId).eq("userId", ownerId).maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async updateAtRevision({ userId: ownerId, noteId: targetId, expectedRevision, changes }) {
      const { data, error } = await db.from("Note").update(changes)
        .eq("id", targetId).eq("userId", ownerId).eq("revision", expectedRevision)
        .select("*, folder:Folder(name)").maybeSingle();
      return { note: data, error: error || undefined };
    },
  });
}

export async function deleteNoteForOwner(userId: string, noteId: string) {
  const { data, error } = await getSupabaseAdmin().from("Note")
    .delete().eq("id", noteId).eq("userId", userId).select("id").maybeSingle();
  if (error) throw error;
  return data;
}

export async function setNoteSharingForOwner(userId: string, noteId: string, isShared: boolean, options: {
  clearLegacyShareId?: boolean;
} = {}) {
  const db = getSupabaseAdmin();
  return updateNoteSharingWithStore(userId, noteId, isShared, {
    async updateOwnedNote(input) {
      const { data, error } = await db.from("Note")
        .update(input.changes)
        .eq("id", input.noteId).eq("userId", input.userId)
        .select("id, title, isShared, shareToken").maybeSingle();
      return { note: data, error: error || undefined };
    },
  }, options);
}

export interface NoteShareStore<TNote> {
  updateOwnedNote(input: {
    userId: string;
    noteId: string;
    changes: Record<string, string | boolean | null | undefined>;
  }): Promise<{ note: TNote | null; error?: unknown }>;
}

/** Sharing changes are owner-scoped and shared between web and MCP callers. */
export async function updateNoteSharingWithStore<TNote>(
  userId: string,
  noteId: string,
  isShared: boolean,
  store: NoteShareStore<TNote>,
  options: { clearLegacyShareId?: boolean } = {},
) {
  const result = await store.updateOwnedNote({
    userId,
    noteId,
    changes: {
      isShared,
      shareToken: isShared ? crypto.randomBytes(32).toString("hex") : null,
      legacyShareId: isShared && !options.clearLegacyShareId ? undefined : null,
      updatedAt: new Date().toISOString(),
    },
  });
  if (result.error) throw result.error;
  return result.note;
}

export async function getSharedNote(shareId: string) {
  const isOpaqueToken = /^[a-f0-9]{64}$/i.test(shareId);
  const isLegacyNoteId = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(shareId);
  if (!isOpaqueToken && !isLegacyNoteId) return null;

  const { data, error } = await getSupabaseAdmin().from("Note")
    .select("id, title, content, updatedAt")
    .eq("isShared", true)
    .or(`shareToken.eq.${shareId},legacyShareId.eq.${shareId}`)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listFoldersForOwner(userId: string) {
  const { data, error } = await getSupabaseAdmin().from("Folder")
    .select("*").eq("userId", userId).order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listFoldersForMcp(userId: string) {
  const { data, error } = await getSupabaseAdmin().from("Folder")
    .select("id, name, parentId, createdAt, updatedAt")
    .eq("userId", userId).order("name", { ascending: true }).limit(1000);
  if (error) throw error;
  return data ?? [];
}

export async function createFolderForOwner(userId: string, name: string, parentId?: string | null) {
  await assertOwnedFolder(userId, parentId, "Parent folder not found");
  const { data, error } = await getSupabaseAdmin().from("Folder").insert([{
    name,
    parentId: parentId || null,
    userId,
  }]).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateFolderForOwner(userId: string, folderId: string, input: {
  name?: string;
  parentId?: string | null;
}) {
  return updateOwnedFolder(userId, folderId, input);
}

export async function deleteEmptyFolderForOwner(userId: string, folderId: string) {
  const result = await deleteEmptyFolder(userId, folderId);
  return result.deleted;
}

export async function countVaultForOwner(userId: string) {
  const db = getSupabaseAdmin();
  const [folders, notes] = await Promise.all([
    db.from("Folder").select("id", { count: "exact", head: true }).eq("userId", userId),
    db.from("Note").select("id", { count: "exact", head: true }).eq("userId", userId),
  ]);
  if (folders.error || notes.error) throw folders.error ?? notes.error;
  return { totalFolders: folders.count ?? 0, totalNotes: notes.count ?? 0 };
}
