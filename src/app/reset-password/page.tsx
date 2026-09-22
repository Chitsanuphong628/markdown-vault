"use client";

import { useState } from "react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      });
      const body = await response.json();
      setSent(true);
      setMessage(body.message || "ตรวจสอบอีเมลของคุณเพื่อรับรหัสรีเซ็ต");
    } finally { setLoading(false); }
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, otp, password }),
      });
      const body = await response.json();
      setMessage(response.ok ? "เปลี่ยนรหัสผ่านสำเร็จแล้ว เข้าสู่ระบบได้เลย" : body.error || "ไม่สามารถเปลี่ยนรหัสผ่านได้");
    } finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4">
    <section className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/80 p-8">
      <h1 className="text-xl font-bold">รีเซ็ตรหัสผ่าน</h1>
      <p className="mt-2 text-sm text-neutral-400">เราจะส่งรหัส 6 หลักไปยังอีเมลของคุณ</p>
      {!sent ? <form className="mt-6 space-y-4" onSubmit={requestCode}>
        <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
        <button className="w-full rounded-lg bg-indigo-600 p-3 text-sm font-medium disabled:opacity-50" disabled={loading}>{loading ? "กำลังส่ง..." : "ส่งรหัสรีเซ็ต"}</button>
      </form> : <form className="mt-6 space-y-4" onSubmit={resetPassword}>
        <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3" type="text" inputMode="numeric" maxLength={6} required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} placeholder="รหัส 6 หลัก" />
        <input className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร" />
        <button className="w-full rounded-lg bg-indigo-600 p-3 text-sm font-medium disabled:opacity-50" disabled={loading}>{loading ? "กำลังบันทึก..." : "ตั้งรหัสผ่านใหม่"}</button>
      </form>}
      {message && <p className="mt-4 text-sm text-neutral-300">{message}</p>}
      <Link className="mt-6 block text-sm text-indigo-300" href="/login">กลับไปเข้าสู่ระบบ</Link>
    </section>
  </main>;
}
