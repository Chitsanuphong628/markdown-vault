import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: folders, error } = await supabaseAdmin
    .from("Folder")
    .select("*")
    .eq("userId", user.id)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ folders: folders || [] });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, parentId } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
    }

    const { data: folder, error } = await supabaseAdmin
      .from("Folder")
      .insert([
        {
          name: name.trim(),
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
