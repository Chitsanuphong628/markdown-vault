import { getSupabaseAdmin } from "./supabase";

export async function assertOwnedFolder(folderId: string | null | undefined, userId: string): Promise<boolean> {
  if (!folderId) return true;
  const { data } = await getSupabaseAdmin()
    .from("Folder")
    .select("id")
    .eq("id", folderId)
    .eq("userId", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function wouldCreateFolderCycle(folderId: string, parentId: string | null, userId: string): Promise<boolean> {
  let cursor = parentId;
  for (let depth = 0; cursor && depth < 100; depth += 1) {
    if (cursor === folderId) return true;
    const { data } = await getSupabaseAdmin()
      .from("Folder")
      .select("parentId")
      .eq("id", cursor)
      .eq("userId", userId)
      .maybeSingle();
    if (!data) return true;
    cursor = data.parentId;
  }
  return Boolean(cursor);
}
