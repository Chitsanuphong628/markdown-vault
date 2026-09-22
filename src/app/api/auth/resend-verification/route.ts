import { NextResponse } from "next/server";
import { createOneTimeCode, hashOneTimeCode } from "@/lib/auth";
import { sendVerificationCode } from "@/lib/email";
import { enforceAuthRateLimit, getAccountRateLimitKey } from "@/lib/rate-limit";
import { getClientAddress, rejectCrossOrigin } from "@/lib/security";
import { getSupabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const schema = z.object({ email: z.string().trim().email().max(254) });
const response = { success: true, message: "หากบัญชียังไม่ได้ยืนยัน เราได้ส่งรหัสใหม่แล้ว" };

export async function POST(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  if (!(await enforceAuthRateLimit(`resend-verification:${getClientAddress(req)}`))) {
    return NextResponse.json(response, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json(response);
  const email = parsed.data.email.toLowerCase();
  if (!(await enforceAuthRateLimit(getAccountRateLimitKey("resend-verification", email)))) {
    return NextResponse.json(response, { status: 429 });
  }
  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase.from("User")
    .select("id, email, emailVerified").eq("email", email).maybeSingle();
  if (!user || user.emailVerified) return NextResponse.json(response);

  const code = createOneTimeCode();
  const { error } = await supabase.from("User").update({
    verificationCodeHash: hashOneTimeCode(code),
    verificationExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    verificationAttempts: 0,
  }).eq("id", user.id);
  if (error) return NextResponse.json({ error: "ไม่สามารถส่งรหัสใหม่ได้" }, { status: 500 });
  try {
    await sendVerificationCode(user.email, code);
  } catch {
    return NextResponse.json({ error: "ยังไม่สามารถส่งอีเมลยืนยันได้" }, { status: 503 });
  }
  return NextResponse.json(response);
}
