"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, KeyRound, Mail, User, ArrowRight, ShieldCheck } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "สมัครสมาชิกไม่สำเร็จ");
      }

      // If email verification is required, navigate to verification page with demoOtp hint
      if (data.requiresVerification) {
        const otpQuery = data.demoOtp ? `&otp=${data.demoOtp}` : "";
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}${otpQuery}`);
      } else {
        router.push("/");
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-neutral-900/80 border border-neutral-800 backdrop-blur-xl p-8 rounded-2xl shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/25 mb-3">
            <BookOpen className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">สร้างบัญชีใหม่</h1>
          <p className="text-neutral-400 text-sm mt-1">เริ่มต้นจัดการโน้ต Markdown ของคุณอย่างเป็นระเบียบ</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">ชื่อแสดงผล</label>
            <div className="relative">
              <User className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ชื่อของคุณ"
                className="w-full bg-neutral-950/60 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">อีเมล</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-neutral-950/60 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">รหัสผ่าน</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-neutral-950/60 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              />
            </div>
          </div>

          <div className="p-3 bg-neutral-950/40 border border-neutral-800/80 rounded-xl flex items-center gap-2.5 text-xs text-neutral-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>มีขั้นตอนยืนยันความปลอดภัยทางอีเมลหลังสมัครสมาชิก</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 disabled:opacity-50 cursor-pointer"
          >
            {loading ? "กำลังสร้างบัญชี..." : "สร้างบัญชีและดำเนินการต่อ"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-neutral-400">
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/login" className="text-purple-400 hover:text-purple-300 font-medium">
            เข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}
