import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createOneTimeCode, hashOneTimeCode, hashPassword } from "@/lib/auth";
import { sendVerificationCode } from "@/lib/email";
import { enforceAuthRateLimit, getAccountRateLimitKey } from "@/lib/rate-limit";
import { getClientAddress, rejectCrossOrigin } from "@/lib/security";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(100).optional(),
});

export async function POST(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  if (!(await enforceAuthRateLimit(`register:${getClientAddress(req)}`))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const parsed = registerSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "ข้อมูลสมัครสมาชิกไม่ถูกต้อง" }, { status: 400 });
    const { email, password, name } = parsed.data;
    const cleanEmail = email.toLowerCase();

    if (!(await enforceAuthRateLimit(getAccountRateLimitKey("register", cleanEmail)))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // Check existing user
    const supabaseAdmin = getSupabaseAdmin();
    const { data: existingUser } = await supabaseAdmin
      .from("User")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: "อีเมลนี้ถูกใช้งานแล้ว" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const verificationCode = createOneTimeCode();
    const verificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { data: user, error } = await supabaseAdmin
      .from("User")
      .insert([
        {
          email: cleanEmail,
          passwordHash,
          name: name || cleanEmail.split("@")[0],
          emailVerified: false,
          verificationCodeHash: hashOneTimeCode(verificationCode),
          verificationExpiresAt,
          verificationAttempts: 0,
        },
      ])
      .select("id, email, name, emailVerified")
      .single();

    if (error || !user) {
      throw new Error(error?.message || "Failed to create user");
    }

    await sendVerificationCode(user.email, verificationCode);
    return NextResponse.json(
      {
        success: true,
        message: "ลงทะเบียนสำเร็จ กรุณายืนยันอีเมลของคุณ",
        requiresVerification: true,
        email: user.email,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Registration error:", error);
    const message = error instanceof Error ? error.message : "Failed to register";
    const status = message === "Email delivery is not configured" || message === "Unable to send verification email" ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "ยังไม่สามารถส่งอีเมลยืนยันได้" : "ไม่สามารถสมัครสมาชิกได้" }, { status });
  }
}
