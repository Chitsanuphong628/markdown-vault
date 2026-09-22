import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const isOpaqueToken = /^[a-f0-9]{64}$/i.test(id);
  const isLegacyNoteId = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id);
  if (!isOpaqueToken && !isLegacyNoteId) {
    return NextResponse.json({ error: "ไม่พบโน้ตนี้ หรือลิงก์ไม่ถูกต้อง" }, { status: 404 });
  }

  const { data: note, error } = await getSupabaseAdmin()
    .from("Note")
    .select("id, title, content, updatedAt")
    .eq("isShared", true)
    .or(`shareToken.eq.${id},legacyShareId.eq.${id}`)
    .maybeSingle();

  if (error || !note) return NextResponse.json({ error: "ไม่พบโน้ตนี้ หรือลิงก์ไม่ถูกต้อง" }, { status: 404 });

  return NextResponse.json({ note });
}
