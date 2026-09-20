import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: note, error } = await supabaseAdmin
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
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { title, content, folderId } = await req.json();

    const updateData: any = { updatedAt: new Date().toISOString() };
    if (title !== undefined) updateData.title = title.trim();
    if (content !== undefined) updateData.content = content;
    if (folderId !== undefined) updateData.folderId = folderId || null;

    const { data: note, error } = await supabaseAdmin
      .from("Note")
      .update(updateData)
      .eq("id", id)
      .eq("userId", user.id)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ note });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { error } = await supabaseAdmin
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
