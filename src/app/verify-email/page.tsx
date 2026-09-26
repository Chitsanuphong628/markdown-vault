"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MailCheck, KeyRound, ArrowRight, ShieldCheck } from "lucide-react";
import { AUTH_COPY } from "@/lib/authCopy";
import LanguageToggle from "@/components/LanguageToggle";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

function VerifyEmailForm({ lang }: { lang: "en" | "th" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = AUTH_COPY[lang];

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) setEmail(emailParam);
  }, [searchParams]);

  const handleVerify = async (targetEmail: string, targetOtp?: string) => {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: targetEmail || email,
          otp: targetOtp || otp,
        }),
      });

      await res.json();
      if (!res.ok) {
        setError(res.status === 429 ? t.verificationRateLimited : t.verificationError);
        return;
      }

      setSuccess(t.verificationSuccess);
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1500);
    } catch {
      setError(t.verificationError);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify(email, otp);
  };

  const resendCode = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      });
      await res.json();
      if (!res.ok && res.status !== 429) {
        setError(t.resendError);
        return;
      }
      setSuccess(t.resendSuccess);
    } catch {
      setError(t.resendError);
    } finally { setLoading(false); }
  };

  return (
    <div className="w-full max-w-md bg-neutral-900/80 border border-neutral-800 backdrop-blur-xl p-8 rounded-2xl shadow-2xl relative z-10">
      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 mb-3">
          <MailCheck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{t.verifyTitle}</h1>
        <p className="text-neutral-400 text-sm mt-1 text-center">
          {t.verifyDescription}
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
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">{t.emailLabel}</label>
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
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">{t.verifyCode}</label>
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
          {loading ? t.verifying : t.verify}
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      <button type="button" disabled={loading || !email} onClick={resendCode} className="mt-4 w-full text-sm text-emerald-400 hover:text-emerald-300 disabled:opacity-50">
        {loading ? t.resendingCode : t.resendCode}
      </button>

      <div className="mt-6 text-center text-sm text-neutral-400">
        {lang === "th" ? "กลับไปหน้าเข้าสู่ระบบ?" : "Back to sign in?"}{" "}
        <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
          {t.signInLink}
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  const [lang, setLang] = useLanguagePreference();
  const t = AUTH_COPY[lang];
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      <div className="absolute right-4 top-4 z-10"><LanguageToggle lang={lang} setLang={setLang} /></div>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <Suspense fallback={<div className="text-neutral-400">{t.loading}</div>}>
        <VerifyEmailForm lang={lang} />
      </Suspense>
    </div>
  );
}
