"use client";

import { useState } from "react";
import Link from "next/link";
import { AUTH_COPY } from "@/lib/authCopy";
import LanguageToggle from "@/components/LanguageToggle";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

export default function ResetPasswordPage() {
  const [lang, setLang] = useLanguagePreference();
  const t = AUTH_COPY[lang];
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (response.ok || response.status === 429) {
        setSent(true);
        setMessage(t.resetRequestSuccess);
        setMessageIsError(false);
      } else {
        setMessage(t.resetError);
        setMessageIsError(true);
      }
    } catch {
      setMessage(t.resetError);
      setMessageIsError(true);
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, password }),
      });
      if (response.ok) {
        setMessage(t.resetSuccess);
        setMessageIsError(false);
      } else {
        setMessage(response.status === 429 ? t.resetRateLimited : response.status === 400 ? t.resetInvalidCode : t.resetError);
        setMessageIsError(true);
      }
    } catch {
      setMessage(t.resetError);
      setMessageIsError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6 sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{t.resetTitle}</h1>
            <p className="mt-2 text-sm text-neutral-400">{t.resetDescription}</p>
          </div>
          <LanguageToggle lang={lang} setLang={setLang} />
        </div>

        {!sent ? (
          <form className="space-y-4" onSubmit={requestCode}>
            <label className="block text-sm text-neutral-300" htmlFor="reset-email">{t.emailLabel}</label>
            <input
              id="reset-email"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t.emailPlaceholder}
            />
            <button className="w-full rounded-lg bg-indigo-600 p-3 text-sm font-medium disabled:opacity-50" disabled={loading}>
              {loading ? t.sending : t.sendResetCode}
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={resetPassword}>
            <label className="block text-sm text-neutral-300" htmlFor="reset-code">{t.verificationCode}</label>
            <input
              id="reset-code"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3"
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
              placeholder="123456"
            />
            <label className="block text-sm text-neutral-300" htmlFor="reset-new-password">{t.newPassword}</label>
            <input
              id="reset-new-password"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3"
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t.passwordMinLength}
            />
            <button className="w-full rounded-lg bg-indigo-600 p-3 text-sm font-medium disabled:opacity-50" disabled={loading}>
              {loading ? t.sending : t.setNewPassword}
            </button>
          </form>
        )}

        {message && (
          <p role={messageIsError ? "alert" : "status"} className={`mt-4 text-sm ${messageIsError ? "text-rose-300" : "text-neutral-300"}`}>
            {message}
          </p>
        )}
        <Link className="mt-6 block text-sm text-indigo-300" href="/login">{t.backToSignIn}</Link>
      </section>
    </main>
  );
}
