import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { assertOwnedFolder } from "@/lib/ownership";
import { rejectCrossOrigin } from "@/lib/security";
import { isMissingSortOrderColumn } from "@/lib/sidebarOrdering";
import { z } from "zod";

const folderSchema = z.object({ name: z.string().trim().min(1).max(120), parentId: z.string().uuid().nullable().optional() });

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const fetchFolders = (includeSortOrder: boolean) => {
    let query = supabase.from("Folder").select("*").eq("userId", user.id);
    query = includeSortOrder
      ? query.order("sortOrder", { ascending: true }).order("name", { ascending: true })
      : query.order("name", { ascending: true });
    return query;
  };
  let result = await fetchFolders(true);
  if (isMissingSortOrderColumn(result.error)) result = await fetchFolders(false);
  const { data: folders, error } = result;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ folders: (folders || []).map((folder: Record<string, unknown> & { sortOrder?: number | null }) => ({ ...folder, sortOrder: folder.sortOrder ?? 0 })) });
}

export async function POST(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = folderSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
    const { name, parentId } = parsed.data;
    if (!(await assertOwnedFolder(parentId, user.id))) return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });

    const { data: folder, error } = await getSupabaseAdmin()
      .from("Folder")
      .insert([
        {
          name,
          parentId: parentId || null,
          userId: user.id,
        },
      ])
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create folder" }, { status: 500 });
  }
}
