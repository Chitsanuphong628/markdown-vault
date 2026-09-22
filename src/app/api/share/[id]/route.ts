import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^[a-f0-9]{64}$/i.test(id)) {
    return NextResponse.json({ error: "ไม่พบโน้ตนี้ หรือลิงก์ไม่ถูกต้อง" }, { status: 404 });
  }

  const { data: note, error } = await getSupabaseAdmin()
    .from("Note")
    .select("id, title, content, updatedAt")
    .eq("shareToken", id)
    .eq("isShared", true)
    .maybeSingle();

  if (error || !note) return NextResponse.json({ error: "ไม่พบโน้ตนี้ หรือลิงก์ไม่ถูกต้อง" }, { status: 404 });

  return NextResponse.json({ note });
}
