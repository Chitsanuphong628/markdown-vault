import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/identity/server";
import { rejectCrossOrigin } from "@/platform/server";
import { deleteEmptyFolderForOwner, updateFolderForOwner } from "@/modules/notes/server";
import { z } from "zod";

const folderPatchSchema = z.object({ name: z.string().trim().min(1).max(120).optional(), parentId: z.string().uuid().nullable().optional() })
  .refine((value) => value.name !== undefined || value.parentId !== undefined, "No updates provided");

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid folder ID" }, { status: 400 });

  try {
    const deleted = await deleteEmptyFolderForOwner(user.id, id);
    if (!deleted) return NextResponse.json({ error: "Folder not found or not empty" }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Could not delete folder" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const parsed = folderPatchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid folder update" }, { status: 400 });
    const folder = await updateFolderForOwner(user.id, id, parsed.data);
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    return NextResponse.json({ folder });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "P0002") return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    if (code === "P0003") return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
    if (code === "P0001") return NextResponse.json({ error: "Folder cannot be its own ancestor" }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update folder" }, { status: 500 });
  }
}
