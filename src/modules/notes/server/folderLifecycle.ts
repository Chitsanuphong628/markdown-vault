import { getSupabaseAdmin } from "@/platform/server";

type DeleteResult = { data: boolean | null; error: Error | null };
type FolderDeletionStore = {
  rpc: (name: string, args: { target_folder_id: string; target_user_id: string }) => Promise<DeleteResult>;
};

type FolderUpdateStore = {
  rpc: (name: string, args: {
    target_folder_id: string;
    target_user_id: string;
    target_name: string | null;
    name_provided: boolean;
    target_parent_id: string | null;
    parent_provided: boolean;
  }) => Promise<{ data: unknown; error: Error | null }>;
};

/** Shared web/MCP behavior: the database locks and deletes only an empty owned folder. */
export async function deleteEmptyFolder(userId: string, folderId: string, store: FolderDeletionStore = getSupabaseAdmin()) {
  const { data, error } = await store.rpc("delete_nota_empty_folder", {
    target_folder_id: folderId,
    target_user_id: userId,
  });
  if (error) throw error;
  return { deleted: data === true };
}

/** The database function atomically checks ownership and prevents parent cycles. */
export async function updateOwnedFolder(userId: string, folderId: string, input: {
  name?: string;
  parentId?: string | null;
}, store: FolderUpdateStore = getSupabaseAdmin()) {
  const { data, error } = await store.rpc("update_nota_folder", {
    target_folder_id: folderId,
    target_user_id: userId,
    target_name: input.name ?? null,
    name_provided: input.name !== undefined,
    target_parent_id: input.parentId ?? null,
    parent_provided: input.parentId !== undefined,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}
