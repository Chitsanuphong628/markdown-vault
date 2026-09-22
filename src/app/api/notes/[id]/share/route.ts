import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { rejectCrossOrigin } from "@/lib/security";
import { z } from "zod";

const shareSchema = z.object({ isShared: z.boolean() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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
    const { isShared } = parsed.data;
    const shareToken = isShared ? crypto.randomBytes(32).toString("hex") : null;

    const { data: note, error } = await getSupabaseAdmin()
      .from("Note")
      .update({ isShared, shareToken, legacyShareId: isShared ? undefined : null, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .eq("userId", user.id)
      .select("id, title, isShared, shareToken")
      .single();

    if (error || !note) {
      return NextResponse.json({ error: error?.message || "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, note });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
