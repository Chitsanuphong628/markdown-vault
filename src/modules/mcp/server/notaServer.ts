import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  countVaultForOwner,
  createFolderForOwner,
  createNoteForOwner,
  deleteEmptyFolderForOwner,
  deleteNoteForOwner,
  getNoteForMcp,
  listFoldersForMcp,
  listNotesForMcp,
  setNoteSharingForOwner,
  updateNoteForOwner,
} from "@/modules/notes/server";

const defaultNotesOperations = {
  countVaultForOwner,
  createFolderForOwner,
  createNoteForOwner,
  deleteEmptyFolderForOwner,
  deleteNoteForOwner,
  getNoteForMcp,
  listFoldersForMcp,
  listNotesForMcp,
  setNoteSharingForOwner,
  updateNoteForOwner,
};

export type NotaMcpOperations = typeof defaultNotesOperations;

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

/** One factory is shared by stdio and HTTP. Every operation receives one verified owner. */
export function createNotaMcpServer(
  userId: string,
  authorize?: () => Promise<boolean>,
  notes: NotaMcpOperations = defaultNotesOperations,
): McpServer {
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
  const server = new McpServer({ name: "nota-vault", version: "2.0.0" }, {
    instructions: "Operate only on the authenticated user's Nota vault. Destructive tools require user confirmation from the host.",
  });

  server.registerTool("list_notes", {
    description: "List or search your Markdown notes. Returns at most 100 notes.",
    inputSchema: z.object({ folderId: id.optional(), searchQuery: z.string().max(200).optional(), limit: z.number().int().min(1).max(100).default(50) }),
    annotations: { readOnlyHint: true },
  }, ({ folderId, searchQuery, limit }) => guarded(async () => {
    return notes.listNotesForMcp(userId, { folderId, searchQuery, limit });
  }));

  server.registerTool("get_note", {
    description: "Read one of your Markdown notes by ID.", inputSchema: z.object({ id }), annotations: { readOnlyHint: true },
  }, ({ id: noteId }) => guarded(async () => {
    const note = await notes.getNoteForMcp(userId, noteId);
    return note ?? "Note not found";
  }));

  server.registerTool("create_note", {
    description: "Create a Markdown note in your vault.",
    inputSchema: z.object({ title, content: content.default(""), folderId: id.nullable().optional() }),
  }, ({ title, content, folderId }) => guarded(async () => {
    try {
      const note = await notes.createNoteForOwner(userId, { title, content, folderId });
      return { id: note.id, title: note.title, revision: note.revision };
    } catch (error) {
      if (error instanceof Error && error.message === "Folder not found") return "Folder not found";
      throw error;
    }
  }));

  server.registerTool("update_note", {
    description: "Update your note. Pass its current revision to prevent overwriting newer edits.",
    inputSchema: z.object({ id, revision: z.number().int().nonnegative(), title: title.optional(), content: content.optional(), folderId: id.nullable().optional() })
      .refine(v => v.title !== undefined || v.content !== undefined || v.folderId !== undefined),
  }, ({ id: noteId, revision, title, content, folderId }) => guarded(async () => {
    try {
      const note = await notes.updateNoteForOwner(userId, noteId, { revision, title, content, folderId });
      return note ? { id: note.id, title: note.title, revision: note.revision } : "Note not found or revision conflict";
    } catch (error) {
      if (error instanceof Error && error.message === "Folder not found") return "Folder not found";
      throw error;
    }
  }));

  server.registerTool("delete_note", {
    description: "Permanently delete one of your notes.", inputSchema: z.object({ id }),
    annotations: { destructiveHint: true, idempotentHint: false },
  }, ({ id: noteId }) => guarded(async () => {
    const note = await notes.deleteNoteForOwner(userId, noteId);
    return note ? { deleted: note.id } : "Note not found";
  }));

  server.registerTool("list_folders", {
    description: "List your folders and parent IDs.", inputSchema: z.object({}), annotations: { readOnlyHint: true },
  }, () => guarded(() => notes.listFoldersForMcp(userId)));

  server.registerTool("create_folder", {
    description: "Create a folder in your vault.",
    inputSchema: z.object({ name: z.string().trim().min(1).max(240), parentId: id.nullable().optional() }),
  }, ({ name, parentId }) => guarded(async () => {
    try {
      const folder = await notes.createFolderForOwner(userId, name, parentId);
      return { id: folder.id, name: folder.name, parentId: folder.parentId };
    } catch (error) {
      if (error instanceof Error && error.message === "Parent folder not found") return "Parent folder not found";
      throw error;
    }
  }));

  server.registerTool("delete_folder", {
    description: "Delete an empty folder you own. Child folders and notes must be moved or deleted first.",
    inputSchema: z.object({ id }), annotations: { destructiveHint: true, idempotentHint: false },
  }, ({ id: folderId }) => guarded(async () => {
    const deleted = await notes.deleteEmptyFolderForOwner(userId, folderId);
    return deleted ? { deleted: folderId } : "Folder not found or not empty";
  }));

  server.registerTool("share_note", {
    description: "Enable or disable a public read-only link for your note.",
    inputSchema: z.object({ id, isShared: z.boolean() }), annotations: { destructiveHint: true },
  }, ({ id: noteId, isShared }) => guarded(async () => {
    const note = await notes.setNoteSharingForOwner(userId, noteId, isShared, { clearLegacyShareId: true });
    if (!note) return "Note not found";
    return { id: note.id, title: note.title, isShared: note.isShared,
      sharePath: note.shareToken ? `/share/${note.shareToken}` : null };
  }));

  server.registerTool("scan_and_cleanup", {
    description: "Read-only summary of your vault; this tool does not clean up data.",
    inputSchema: z.object({}), annotations: { readOnlyHint: true },
  }, () => guarded(() => notes.countVaultForOwner(userId)));

  return server;
}
