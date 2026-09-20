import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { error } = await supabaseAdmin
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
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { name, parentId } = await req.json();

    const updateData: any = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updateData.name = name.trim();
    if (parentId !== undefined) updateData.parentId = parentId || null;

    const { data: folder, error } = await supabaseAdmin
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
