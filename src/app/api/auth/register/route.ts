import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { hashPassword } from "@/lib/auth";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "กรุณาระบุอีเมลและรหัสผ่าน" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check existing user
    const { data: existingUser } = await supabaseAdmin
      .from("User")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: "อีเมลนี้ถูกใช้งานแล้ว" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    
    // Generate 6-digit OTP and Verification Token
    const verificationOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const { data: user, error } = await supabaseAdmin
      .from("User")
      .insert([
        {
          email: cleanEmail,
          passwordHash,
          name: name || cleanEmail.split("@")[0],
          emailVerified: false,
          verificationToken,
          verificationOtp,
        },
      ])
      .select("id, email, name, emailVerified")
      .single();

    if (error || !user) {
      throw new Error(error?.message || "Failed to create user");
    }

    // In a production environment with SMTP/Resend, you would send an email here.
    // For easy testing and demonstration, we return the demo OTP.
    return NextResponse.json(
      {
        success: true,
        message: "ลงทะเบียนสำเร็จ กรุณายืนยันอีเมลของคุณ",
        requiresVerification: true,
        email: user.email,
        demoOtp: verificationOtp,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: error.message || "Failed to register" }, { status: 500 });
  }
}
