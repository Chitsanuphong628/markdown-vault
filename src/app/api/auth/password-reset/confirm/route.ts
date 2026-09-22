import { NextResponse } from "next/server";
import { hashPassword, matchesOneTimeCode } from "@/lib/auth";
import { enforceAuthRateLimit, getAccountRateLimitKey } from "@/lib/rate-limit";
import { getClientAddress, rejectCrossOrigin } from "@/lib/security";
import { getSupabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email().max(254),
  otp: z.string().regex(/^\d{6}$/),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  if (!(await enforceAuthRateLimit(`password-reset-confirm:${getClientAddress(req)}`))) {
    return NextResponse.json({ error: "ลองใหม่ภายหลัง" }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลรีเซ็ตรหัสผ่านไม่ถูกต้อง" }, { status: 400 });

  const { email, otp, password } = parsed.data;
  const cleanEmail = email.toLowerCase();
  if (!(await enforceAuthRateLimit(getAccountRateLimitKey("password-reset-confirm", cleanEmail)))) {
    return NextResponse.json({ error: "ลองใหม่ภายหลัง" }, { status: 429 });
  }
  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase.from("User")
    .select("id, passwordResetCodeHash, passwordResetExpiresAt, passwordResetAttempts, sessionVersion")
    .eq("email", cleanEmail).maybeSingle();
  const expired = !user?.passwordResetExpiresAt || new Date(user.passwordResetExpiresAt).getTime() < Date.now();
  const valid = Boolean(user) && !expired && (user.passwordResetAttempts ?? 0) < 5
    && matchesOneTimeCode(otp, user.passwordResetCodeHash);
  if (!valid) {
    if (user) {
      const attempts = user.passwordResetAttempts ?? 0;
      if (attempts < 5) {
        await supabase.from("User")
          .update({ passwordResetAttempts: attempts + 1 })
          .eq("id", user.id)
          .eq("passwordResetAttempts", attempts)
          .lt("passwordResetAttempts", 5);
      }
    }
    return NextResponse.json({ error: "รหัสรีเซ็ตไม่ถูกต้องหรือหมดอายุ" }, { status: 400 });
  }
  const { data: consumedUser, error } = await supabase.from("User").update({
    passwordHash: await hashPassword(password),
    passwordResetCodeHash: null,
    passwordResetExpiresAt: null,
    passwordResetAttempts: 0,
    sessionVersion: user.sessionVersion + 1,
    updatedAt: new Date().toISOString(),
  }).eq("id", user.id)
    .eq("passwordResetCodeHash", user.passwordResetCodeHash)
    .eq("sessionVersion", user.sessionVersion)
    .gt("passwordResetExpiresAt", new Date().toISOString())
    .lt("passwordResetAttempts", 5)
    .select("id")
    .maybeSingle();
  if (error || !consumedUser) return NextResponse.json({ error: "รหัสรีเซ็ตถูกใช้แล้วหรือหมดอายุ" }, { status: 400 });
  return NextResponse.json({ success: true });
}
