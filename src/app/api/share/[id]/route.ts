import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: note, error } = await supabaseAdmin
    .from("Note")
    .select("id, title, content, updatedAt, isShared, user:User(name, email)")
    .eq("id", id)
    .single();

  if (error || !note) {
    return NextResponse.json({ error: "ไม่พบโน้ตนี้ หรือลิงก์ไม่ถูกต้อง" }, { status: 404 });
  }

  if (!note.isShared) {
    return NextResponse.json(
      { error: "โน้ตนี้ถูกปิดการเข้าถึงสาธารณะ หรือเจ้าของไม่ได้เปิดแชร์" },
      { status: 403 }
    );
  }

  return NextResponse.json({ note });
}
