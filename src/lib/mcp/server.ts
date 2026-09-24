import { randomBytes } from "node:crypto";
import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { escapePostgrestSearch } from "@/lib/security";
import { parseNoteTheme } from "@/lib/noteTheme";
import { deleteEmptyFolder } from "@/lib/folderLifecycle";

const id = z.string().uuid();
const title = z.string().trim().min(1).max(240);
const content = z.string().max(1_000_000);

function success(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }] };
}

function failure(error: unknown): CallToolResult {
  // Database details and service credentials must not enter an LLM context.
  console.error("MCP tool failed:", error);
  return { isError: true, content: [{ type: "text", text: "Operation failed" }] };
}

async function ownedFolder(folderId: string | null | undefined, userId: string): Promise<boolean> {
  if (!folderId) return true;
  const { data, error } = await getSupabaseAdmin().from("Folder")
    .select("id").eq("id", folderId).eq("userId", userId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** One factory is shared by stdio and HTTP. Every operation receives one verified owner. */
export function createNotaMcpServer(userId: string, authorize?: () => Promise<boolean>): McpServer {
  if (!userId) throw new Error("MCP principal is required");
  function guarded<T>(operation: () => Promise<T>): Promise<CallToolResult> {
    return (async () => {
      if (authorize && !(await authorize())) {
        const denied: CallToolResult = { isError: true, content: [{ type: "text", text: "MCP credential revoked or expired" }] };
        return denied;
      }
      return success(await operation());
    })().catch(failure);
  }
  const db = getSupabaseAdmin();
  const server = new McpServer({ name: "nota-vault", version: "2.0.0" }, {
    instructions: "Operate only on the authenticated user's Nota vault. Destructive tools require user confirmation from the host.",
  });

  server.registerTool("list_notes", {
    description: "List or search your Markdown notes. Returns at most 100 notes.",
    inputSchema: z.object({ folderId: id.optional(), searchQuery: z.string().max(200).optional(), limit: z.number().int().min(1).max(100).default(50) }),
    annotations: { readOnlyHint: true },
  }, ({ folderId, searchQuery, limit }) => guarded(async () => {
    let query = db.from("Note").select("id, title, folderId, isShared, createdAt, updatedAt, revision")
      .eq("userId", userId).order("updatedAt", { ascending: false }).limit(limit);
    if (folderId) query = query.eq("folderId", folderId);
    if (searchQuery) {
      const term = escapePostgrestSearch(searchQuery);
      query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }));

  server.registerTool("get_note", {
    description: "Read one of your Markdown notes by ID.", inputSchema: z.object({ id }), annotations: { readOnlyHint: true },
  }, ({ id: noteId }) => guarded(async () => {
    const { data, error } = await db.from("Note").select("id, title, content, folderId, isShared, createdAt, updatedAt, revision")
      .eq("id", noteId).eq("userId", userId).maybeSingle();
    if (error) throw error;
    if (!data) return "Note not found";
    return data;
  }));

  server.registerTool("create_note", {
    description: "Create a Markdown note in your vault.",
    inputSchema: z.object({ title, content: content.default(""), folderId: id.nullable().optional() }),
  }, ({ title, content, folderId }) => guarded(async () => {
    if (!(await ownedFolder(folderId, userId))) return "Folder not found";
    const { data, error } = await db.from("Note").insert({ title, content, folderId: folderId ?? null,
      themeColor: parseNoteTheme(content).color, userId }).select("id, title, revision").single();
    if (error) throw error;
    return data;
  }));

  server.registerTool("update_note", {
    description: "Update your note. Pass its current revision to prevent overwriting newer edits.",
    inputSchema: z.object({ id, revision: z.number().int().nonnegative(), title: title.optional(), content: content.optional(), folderId: id.nullable().optional() })
      .refine(v => v.title !== undefined || v.content !== undefined || v.folderId !== undefined),
  }, ({ id: noteId, revision, title, content, folderId }) => guarded(async () => {
    if (folderId !== undefined && !(await ownedFolder(folderId, userId))) return "Folder not found";
    const changes: Record<string, string | number | null> = { updatedAt: new Date().toISOString(), revision: revision + 1 };
    if (title !== undefined) changes.title = title;
    if (content !== undefined) { changes.content = content; changes.themeColor = parseNoteTheme(content).color; }
    if (folderId !== undefined) changes.folderId = folderId;
    const { data, error } = await db.from("Note").update(changes).eq("id", noteId).eq("userId", userId)
      .eq("revision", revision).select("id, title, revision").maybeSingle();
    if (error) throw error;
    return data ?? "Note not found or revision conflict";
  }));

  server.registerTool("delete_note", {
    description: "Permanently delete one of your notes.", inputSchema: z.object({ id }),
    annotations: { destructiveHint: true, idempotentHint: false },
  }, ({ id: noteId }) => guarded(async () => {
    const { data, error } = await db.from("Note").delete().eq("id", noteId).eq("userId", userId).select("id").maybeSingle();
    if (error) throw error;
    return data ? { deleted: data.id } : "Note not found";
  }));

  server.registerTool("list_folders", {
    description: "List your folders and parent IDs.", inputSchema: z.object({}), annotations: { readOnlyHint: true },
  }, () => guarded(async () => {
    const { data, error } = await db.from("Folder").select("id, name, parentId, createdAt, updatedAt")
      .eq("userId", userId).order("name", { ascending: true }).limit(1000);
    if (error) throw error;
    return data ?? [];
  }));

  server.registerTool("create_folder", {
    description: "Create a folder in your vault.",
    inputSchema: z.object({ name: z.string().trim().min(1).max(240), parentId: id.nullable().optional() }),
  }, ({ name, parentId }) => guarded(async () => {
    if (!(await ownedFolder(parentId, userId))) return "Parent folder not found";
    const { data, error } = await db.from("Folder").insert({ name, parentId: parentId ?? null, userId })
      .select("id, name, parentId").single();
    if (error) throw error;
    return data;
  }));

  server.registerTool("delete_folder", {
    description: "Delete an empty folder you own. Child folders and notes must be moved or deleted first.",
    inputSchema: z.object({ id }), annotations: { destructiveHint: true, idempotentHint: false },
  }, ({ id: folderId }) => guarded(async () => {
    const result = await deleteEmptyFolder(userId, folderId, db);
    return result.deleted ? { deleted: folderId } : "Folder not found or not empty";
  }));

  server.registerTool("share_note", {
    description: "Enable or disable a public read-only link for your note.",
    inputSchema: z.object({ id, isShared: z.boolean() }), annotations: { destructiveHint: true },
  }, ({ id: noteId, isShared }) => guarded(async () => {
    const { data, error } = await db.from("Note").update({ isShared,
      shareToken: isShared ? randomBytes(32).toString("hex") : null,
      legacyShareId: null, updatedAt: new Date().toISOString() })
      .eq("id", noteId).eq("userId", userId).select("id, title, isShared, shareToken").maybeSingle();
    if (error) throw error;
    if (!data) return "Note not found";
    return { id: data.id, title: data.title, isShared: data.isShared,
      sharePath: data.shareToken ? `/share/${data.shareToken}` : null };
  }));

  server.registerTool("scan_and_cleanup", {
    description: "Read-only summary of your vault; this tool does not clean up data.",
    inputSchema: z.object({}), annotations: { readOnlyHint: true },
  }, () => guarded(async () => {
    const [folders, notes] = await Promise.all([
      db.from("Folder").select("id", { count: "exact", head: true }).eq("userId", userId),
      db.from("Note").select("id", { count: "exact", head: true }).eq("userId", userId),
    ]);
    if (folders.error || notes.error) throw folders.error ?? notes.error;
    return { totalFolders: folders.count ?? 0, totalNotes: notes.count ?? 0 };
  }));

  return server;
}
