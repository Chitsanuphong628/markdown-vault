"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MailCheck, KeyRound, ArrowRight, ShieldCheck, RefreshCw } from "lucide-react";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    const tokenParam = searchParams.get("token");
    const otpParam = searchParams.get("otp");

    if (emailParam) setEmail(emailParam);
    if (otpParam) setOtp(otpParam);

    // Auto verify if token is in query string
    if (emailParam && tokenParam) {
      handleVerify(emailParam, undefined, tokenParam);
    }
  }, [searchParams]);

  const handleVerify = async (targetEmail: string, targetOtp?: string, targetToken?: string) => {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: targetEmail || email,
          otp: targetOtp || otp,
          token: targetToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "การยืนยันอีเมลล้มเหลว");
      }

      setSuccess("ยืนยันอีเมลสำเร็จแล้ว! กำลังนำคุณเข้าสู่ระบบ...");
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify(email, otp);
  };

  return (
    <div className="w-full max-w-md bg-neutral-900/80 border border-neutral-800 backdrop-blur-xl p-8 rounded-2xl shadow-2xl relative z-10">
      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 mb-3">
          <MailCheck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">ยืนยันอีเมลของคุณ</h1>
        <p className="text-neutral-400 text-sm mt-1 text-center">
          กรอกรหัสยืนยัน 6 หลัก (OTP) ที่ได้รับเพื่อเปิดใช้งานบัญชี
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">อีเมล</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full bg-neutral-950/60 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
            รหัสยืนยัน 6 หลัก (OTP)
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
            <input
              type="text"
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="w-full bg-neutral-950/60 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-center font-mono tracking-widest text-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || otp.length < 6}
          className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
        >
          {loading ? "กำลังตรวจสอบ..." : "ยืนยันรหัส OTP"}
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-neutral-400">
        ต้องการกลับไปหน้าเข้าสู่ระบบ?{" "}
        <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
          เข้าสู่ระบบ
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <Suspense fallback={<div className="text-neutral-400">กำลังโหลด...</div>}>
        <VerifyEmailForm />
      </Suspense>
    </div>
  );
}
