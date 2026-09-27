import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { assertOwnedFolder } from "@/lib/ownership";
import { rejectCrossOrigin } from "@/lib/security";
import { z } from "zod";

const folderSchema = z.object({ name: z.string().trim().min(1).max(120), parentId: z.string().uuid().nullable().optional() });

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: folders, error } = await getSupabaseAdmin()
    .from("Folder")
    .select("*")
    .eq("userId", user.id)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ folders: folders || [] });
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create folder" }, { status: 500 });
  }
}
