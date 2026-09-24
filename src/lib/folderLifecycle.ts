import { getSupabaseAdmin } from "./supabase";

type DeleteResult = { data: boolean | null; error: Error | null };
type FolderDeletionStore = {
  rpc: (name: string, args: { target_folder_id: string; target_user_id: string }) => Promise<DeleteResult>;
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
