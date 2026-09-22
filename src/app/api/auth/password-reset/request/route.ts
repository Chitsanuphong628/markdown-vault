import { NextResponse } from "next/server";
import { createOneTimeCode, hashOneTimeCode } from "@/lib/auth";
import { sendPasswordResetCode } from "@/lib/email";
import { enforceAuthRateLimit, getAccountRateLimitKey } from "@/lib/rate-limit";
import { getClientAddress, rejectCrossOrigin } from "@/lib/security";
import { getSupabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const schema = z.object({ email: z.string().trim().email().max(254) });
const neutralResponse = { success: true, message: "หากมีบัญชีนี้ในระบบ เราได้ส่งรหัสรีเซ็ตรหัสผ่านแล้ว" };

export async function POST(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  if (!(await enforceAuthRateLimit(`password-reset:${getClientAddress(req)}`))) {
    return NextResponse.json(neutralResponse, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json(neutralResponse);

  const email = parsed.data.email.toLowerCase();
  if (!(await enforceAuthRateLimit(getAccountRateLimitKey("password-reset", email)))) {
    return NextResponse.json(neutralResponse, { status: 429 });
  }
  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase.from("User").select("id, email").eq("email", email).maybeSingle();
  if (!user) return NextResponse.json(neutralResponse);

  const code = createOneTimeCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error } = await supabase.from("User").update({
    passwordResetCodeHash: hashOneTimeCode(code),
    passwordResetExpiresAt: expiresAt,
    passwordResetAttempts: 0,
  }).eq("id", user.id);
  if (error) return NextResponse.json({ error: "ไม่สามารถเริ่มรีเซ็ตรหัสผ่านได้" }, { status: 500 });

  try {
    await sendPasswordResetCode(user.email, code);
  } catch {
    // Keep the public response neutral: delivery configuration must not become
    // an account-existence oracle.
    return NextResponse.json(neutralResponse);
  }
  return NextResponse.json(neutralResponse);
}
