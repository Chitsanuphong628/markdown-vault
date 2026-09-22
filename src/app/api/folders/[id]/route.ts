import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { assertOwnedFolder, wouldCreateFolderCycle } from "@/lib/ownership";
import { rejectCrossOrigin } from "@/lib/security";
import { z } from "zod";

const folderPatchSchema = z.object({ name: z.string().trim().min(1).max(120).optional(), parentId: z.string().uuid().nullable().optional() })
  .refine((value) => value.name !== undefined || value.parentId !== undefined, "No updates provided");

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { error } = await getSupabaseAdmin()
      .from("Folder")
      .delete()
      .eq("id", id)
      .eq("userId", user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const parsed = folderPatchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid folder update" }, { status: 400 });
    const { name, parentId } = parsed.data;
    if (parentId !== undefined && !(await assertOwnedFolder(parentId, user.id))) {
      return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
    }
    if (parentId !== undefined && await wouldCreateFolderCycle(id, parentId, user.id)) {
      return NextResponse.json({ error: "Folder cannot be its own ancestor" }, { status: 400 });
    }

    const updateData: Record<string, string | null> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (parentId !== undefined) updateData.parentId = parentId || null;

    const { data: folder, error } = await getSupabaseAdmin()
      .from("Folder")
      .update(updateData)
      .eq("id", id)
      .eq("userId", user.id)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ folder });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
