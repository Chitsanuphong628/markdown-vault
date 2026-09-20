import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const folderId = searchParams.get("folderId");

  let query = supabaseAdmin
    .from("Note")
    .select("id, title, folderId, createdAt, updatedAt")
    .eq("userId", user.id)
    .order("updatedAt", { ascending: false });

  if (folderId) {
    query = query.eq("folderId", folderId);
  }

  if (q) {
    query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);
  }

  const { data: notes, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ notes: notes || [] });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { title, content, folderId } = await req.json();
    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const { data: note, error } = await supabaseAdmin
      .from("Note")
      .insert([
        {
          title: title.trim(),
          content: content || "",
          folderId: folderId || null,
          userId: user.id,
        },
      ])
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ note }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create note" }, { status: 500 });
  }
}
