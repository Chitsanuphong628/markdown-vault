import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { comparePassword, signToken } from "@/lib/auth";
import { enforceAuthRateLimit, getAccountRateLimitKey } from "@/lib/rate-limit";
import { getClientAddress, rejectCrossOrigin } from "@/lib/security";
import { z } from "zod";

const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) });

export async function POST(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  if (!(await enforceAuthRateLimit(`login:${getClientAddress(req)}`))) {
    return NextResponse.json({ error: "เข้าสู่ระบบไม่สำเร็จ" }, { status: 429 });
  }
  try {
    const parsed = loginSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน" }, { status: 400 });
    }
    const { email, password } = parsed.data;

    const cleanEmail = email.toLowerCase().trim();
    const cleanPassword = password.trim();

    if (!(await enforceAuthRateLimit(getAccountRateLimitKey("login", cleanEmail)))) {
      return NextResponse.json({ error: "เข้าสู่ระบบไม่สำเร็จ" }, { status: 429 });
    }

    const { data: user, error } = await getSupabaseAdmin()
      .from("User")
      .select("id, email, passwordHash, name, emailVerified, sessionVersion")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json({ error: "เข้าสู่ระบบไม่สำเร็จ" }, { status: 401 });
    }

    // Compare clean password and original password
    const isMatch = (await comparePassword(cleanPassword, user.passwordHash)) || (await comparePassword(password, user.passwordHash));
    if (!isMatch) {
      return NextResponse.json({ error: "เข้าสู่ระบบไม่สำเร็จ" }, { status: 401 });
    }

    const token = signToken({ userId: user.id, email: user.email, sessionVersion: user.sessionVersion });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified === true },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "เข้าสู่ระบบไม่สำเร็จ" }, { status: 500 });
  }
}
