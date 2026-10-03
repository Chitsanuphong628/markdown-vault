import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/identity/server";
import { rejectCrossOrigin } from "@/platform/server";
import { setNoteSharingForOwner } from "@/modules/notes/server";
import { z } from "zod";

const shareSchema = z.object({ isShared: z.boolean() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.emailVerified !== true) return NextResponse.json({ error: "Please verify your email before sharing publicly" }, { status: 403 });
  const { id } = await params;

  try {
    const parsed = shareSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid sharing state" }, { status: 400 });
    const note = await setNoteSharingForOwner(user.id, id, parsed.data.isShared);
    if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });
    return NextResponse.json({ success: true, note });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Note not found" }, { status: 404 });
  }
}
