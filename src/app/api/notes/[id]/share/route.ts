import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { isShared } = await req.json();

    const { data: note, error } = await supabaseAdmin
      .from("Note")
      .update({ isShared: Boolean(isShared), updatedAt: new Date().toISOString() })
      .eq("id", id)
      .eq("userId", user.id)
      .select("id, title, isShared")
      .single();

    if (error || !note) {
      return NextResponse.json({ error: error?.message || "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, note });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
