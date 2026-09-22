import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { matchesOneTimeCode, signToken } from "@/lib/auth";
import { enforceAuthRateLimit, getAccountRateLimitKey } from "@/lib/rate-limit";
import { getClientAddress, rejectCrossOrigin } from "@/lib/security";
import { z } from "zod";

const verifySchema = z.object({ email: z.string().trim().email().max(254), otp: z.string().regex(/^\d{6}$/) });

export async function POST(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  if (!(await enforceAuthRateLimit(`verify:${getClientAddress(req)}`))) {
    return NextResponse.json({ error: "ลองใหม่ภายหลัง" }, { status: 429 });
  }
  try {
    const parsed = verifySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "ระบุอีเมลไม่ถูกต้อง" }, { status: 400 });
    }
    const { email, otp } = parsed.data;

    const cleanEmail = email.toLowerCase().trim();

    if (!(await enforceAuthRateLimit(getAccountRateLimitKey("verify", cleanEmail)))) {
      return NextResponse.json({ error: "ลองใหม่ภายหลัง" }, { status: 429 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: user, error } = await supabaseAdmin
      .from("User")
      .select("id, email, name, verificationCodeHash, verificationExpiresAt, verificationAttempts, emailVerified")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error || !user) return NextResponse.json({ error: "รหัสยืนยันไม่ถูกต้องหรือหมดอายุ" }, { status: 400 });

    if (user.emailVerified) {
      return NextResponse.json({ error: "อีเมลนี้ได้รับการยืนยันแล้ว" }, { status: 400 });
    }

    const expired = !user.verificationExpiresAt || new Date(user.verificationExpiresAt).getTime() < Date.now();
    const valid = !expired && (user.verificationAttempts ?? 0) < 5 && matchesOneTimeCode(otp, user.verificationCodeHash);
    if (!valid) {
      const attempts = user.verificationAttempts ?? 0;
      if (attempts < 5) {
        await supabaseAdmin.from("User")
          .update({ verificationAttempts: attempts + 1 })
          .eq("id", user.id)
          .eq("verificationAttempts", attempts)
          .lt("verificationAttempts", 5);
      }
      return NextResponse.json({ error: "รหัส OTP หรือลิงก์ยืนยันไม่ถูกต้อง" }, { status: 400 });
    }

    // Mark as verified and clear OTP
    const { data: consumedUser, error: updateError } = await supabaseAdmin
      .from("User")
      .update({
        emailVerified: true,
        verificationCodeHash: null,
        verificationExpiresAt: null,
        verificationAttempts: 0,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", user.id)
      .eq("emailVerified", false)
      .eq("verificationCodeHash", user.verificationCodeHash)
      .gt("verificationExpiresAt", new Date().toISOString())
      .lt("verificationAttempts", 5)
      .select("id")
      .maybeSingle();

    if (updateError || !consumedUser) {
      return NextResponse.json({ error: "รหัส OTP ถูกใช้แล้วหรือหมดอายุ" }, { status: 400 });
    }

    // Auto-login session upon successful verification
    const authToken = signToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({
      success: true,
      message: "ยืนยันอีเมลสำเร็จ",
      user: { id: user.id, email: user.email, name: user.name },
    });

    response.cookies.set("token", authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err: unknown) {
    console.error("Verification error:", err);
    return NextResponse.json({ error: "ไม่สามารถยืนยันอีเมลได้" }, { status: 500 });
  }
}
