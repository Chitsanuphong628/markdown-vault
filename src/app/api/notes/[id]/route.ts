import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { assertOwnedFolder } from "@/lib/ownership";
import { rejectCrossOrigin } from "@/lib/security";
import { parseNoteTheme } from "@/lib/noteTheme";
import { z } from "zod";

const notePatchSchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  content: z.string().max(1_000_000).optional(),
  folderId: z.string().uuid().nullable().optional(),
  revision: z.number().int().nonnegative(),
}).refine((value) => value.title !== undefined || value.content !== undefined || value.folderId !== undefined, "No updates provided");

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: note, error } = await getSupabaseAdmin()
    .from("Note")
    .select("*, folder:Folder(name)")
    .eq("id", id)
    .eq("userId", user.id)
    .single();

  if (error || !note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

  return NextResponse.json({ note });
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
    const parsed = notePatchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid note update" }, { status: 400 });
    const { title, content, folderId, revision } = parsed.data;
    if (folderId !== undefined && !(await assertOwnedFolder(folderId, user.id))) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const updateData: Record<string, string | number | null> = { updatedAt: new Date().toISOString(), revision: revision + 1 };
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) {
      updateData.content = content;
      updateData.themeColor = parseNoteTheme(content).color;
    }
    if (folderId !== undefined) updateData.folderId = folderId || null;

    const { data: note, error } = await getSupabaseAdmin()
      .from("Note")
      .update(updateData)
      .eq("id", id)
      .eq("userId", user.id)
      .eq("revision", revision)
      .select("*")
      .single();

    if (error || !note) return NextResponse.json({ error: "Note was changed by another session" }, { status: 409 });
    return NextResponse.json({ note });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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
      .from("Note")
      .delete()
      .eq("id", id)
      .eq("userId", user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
