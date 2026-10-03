import { NextResponse } from "next/server";
import { getSharedNote } from "@/modules/notes/server";

const NOT_FOUND = "ไม่พบโน้ตนี้ หรือลิงก์ไม่ถูกต้อง";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const note = await getSharedNote(id);
    if (!note) return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
    return NextResponse.json({ note });
  } catch {
    return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
  }
}
