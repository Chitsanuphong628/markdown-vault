import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
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

    const { data: folder, error } = await getSupabaseAdmin().rpc("update_nota_folder", {
      target_folder_id: id,
      target_user_id: user.id,
      target_name: name ?? null,
      name_provided: name !== undefined,
      target_parent_id: parentId ?? null,
      parent_provided: parentId !== undefined,
    });

    if (error) {
      if (error.code === "P0002") return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      if (error.code === "P0003") return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
      if (error.code === "P0001") return NextResponse.json({ error: "Folder cannot be its own ancestor" }, { status: 400 });
      throw error;
    }

    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    return NextResponse.json({ folder: Array.isArray(folder) ? folder[0] : folder });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
