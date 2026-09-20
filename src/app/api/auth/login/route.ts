import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { comparePassword, signToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanPassword = password.trim();

    const { data: user, error } = await supabaseAdmin
      .from("User")
      .select("id, email, passwordHash, name, emailVerified")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json({ error: "ไม่พบบัญชีอีเมลนี้ในระบบ (" + cleanEmail + ")" }, { status: 401 });
    }

    // Compare clean password and original password
    const isMatch = (await comparePassword(cleanPassword, user.passwordHash)) || (await comparePassword(password, user.passwordHash));
    if (!isMatch) {
      return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง" }, { status: 401 });
    }

    // Check if email is verified
    if (user.emailVerified === false) {
      return NextResponse.json(
        {
          error: "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ",
          requiresVerification: true,
          email: user.email,
        },
        { status: 403 }
      );
    }

    const token = signToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json({ error: error.message || "Failed to login" }, { status: 500 });
  }
}
