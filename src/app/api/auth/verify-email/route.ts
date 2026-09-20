import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { signToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, otp, token } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "ระบุอีเมลไม่ถูกต้อง" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    const { data: user, error } = await supabaseAdmin
      .from("User")
      .select("id, email, name, verificationOtp, verificationToken, emailVerified")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json({ error: "ไม่พบบัญชีผู้ใช้งานนี้" }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: "อีเมลนี้ได้รับการยืนยันแล้ว สามารถเข้าสู่ระบบได้ทันที" }, { status: 400 });
    }

    const isValidOtp = otp && user.verificationOtp === otp.trim();
    const isValidToken = token && user.verificationToken === token.trim();

    if (!isValidOtp && !isValidToken) {
      return NextResponse.json({ error: "รหัส OTP หรือลิงก์ยืนยันไม่ถูกต้อง" }, { status: 400 });
    }

    // Mark as verified and clear OTP
    const { error: updateError } = await supabaseAdmin
      .from("User")
      .update({
        emailVerified: true,
        verificationOtp: null,
        verificationToken: null,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      throw updateError;
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
  } catch (err: any) {
    console.error("Verification error:", err);
    return NextResponse.json({ error: err.message || "Failed to verify email" }, { status: 500 });
  }
}
