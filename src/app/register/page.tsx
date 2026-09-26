"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  KeyRound,
  Mail,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Search,
  Share2,
  Loader2,
} from "lucide-react";
import LanguageToggle from "@/components/LanguageToggle";
import { AUTH_COPY, getRegisterError } from "@/lib/authCopy";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

export default function RegisterPage() {
  const router = useRouter();
  const [lang, setLang] = useLanguagePreference();
  const t = AUTH_COPY[lang];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Dynamic Password Strength calculation
  const passwordStrength = useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;
    return score; // 0 to 4
  }, [password]);

  const strengthLabel = useMemo(() => {
    switch (passwordStrength) {
      case 1:
        return { text: t.passwordWeak, color: "bg-rose-500", textColor: "text-rose-400" };
      case 2:
        return { text: t.passwordFair, color: "bg-amber-500", textColor: "text-amber-400" };
      case 3:
        return { text: t.passwordGood, color: "bg-blue-500", textColor: "text-blue-400" };
      case 4:
        return { text: t.passwordStrong, color: "bg-emerald-500", textColor: "text-emerald-400" };
      default:
        return { text: "", color: "bg-neutral-800", textColor: "text-neutral-500" };
    }
  }, [passwordStrength, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(getRegisterError(res.status, lang));
        return;
      }

      if (data.requiresVerification) {
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
      } else {
        router.push("/");
      }
      router.refresh();
    } catch {
      setError(t.registerError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#090a0f] text-neutral-100 flex flex-col lg:flex-row overflow-x-hidden font-sans select-none">
      {/* Product summary */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0e1017] via-[#090a0f] to-[#1a1129] border-r border-neutral-800/70 p-12 flex-col justify-between relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-600/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />

        {/* Top Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-950/90 border border-neutral-800 flex items-center justify-center p-2 shadow-lg shadow-indigo-500/10">
            <Image
              src="/logo.png"
              alt="Nota Logo"
              width={28}
              height={28}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-white">
              Nota
            </span>
            <span className="text-[11px] text-neutral-400">{t.productLabel}</span>
          </div>
        </div>

        {/* Center Content */}
        <div className="relative z-10 my-auto py-10 max-w-lg">
          <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
            {t.registerTitle}
          </h1>

          <p className="text-neutral-400 text-sm sm:text-base leading-relaxed mb-8">
            {t.registerDescription}
          </p>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-md flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                <Search className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-200">{t.registerFeatureOne}</h3>
                <p className="text-xs text-neutral-400 mt-0.5">{t.registerFeatureOneDescription}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-md flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
                <Share2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-200">{t.registerFeatureTwo}</h3>
                <p className="text-xs text-neutral-400 mt-0.5">{t.registerFeatureTwoDescription}</p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* RIGHT PANE: Registration Form */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-12 lg:p-16 relative">
        {/* Top Language Switcher */}
        <div className="flex items-center justify-between w-full max-w-md mx-auto">
          <div className="flex lg:hidden items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center p-1.5 shadow-sm">
              <Image
                src="/logo.png"
                alt="Nota Logo"
                width={20}
                height={20}
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-sm font-bold text-white">Nota</span>
          </div>

          <div className="ml-auto">
            <LanguageToggle lang={lang} setLang={setLang} />
          </div>
        </div>

        {/* Form Container */}
        <div className="w-full max-w-md mx-auto my-auto py-8">
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              {t.registerTitle}
            </h2>
            <p className="text-neutral-400 text-sm">{t.registerFormDescription}</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs leading-relaxed animate-in fade-in duration-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-2">
                {t.nameLabel}
              </label>
              <div className="relative group">
                <User className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5 transition-colors group-focus-within:text-purple-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-2">
                {t.emailLabel}
              </label>
              <div className="relative group">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5 transition-colors group-focus-within:text-purple-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Password Field with Strength Meter */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-neutral-300">
                  {t.passwordLabel}
                </label>
                {password && (
                  <span className={`text-[11px] font-semibold ${strengthLabel.textColor}`}>
                    {strengthLabel.text}
                  </span>
                )}
              </div>
              <div className="relative group">
                <KeyRound className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5 transition-colors group-focus-within:text-purple-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordMinLength}
                  className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl pl-10 pr-11 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t.hidePassword : t.showPassword}
                  title={showPassword ? t.hidePassword : t.showPassword}
                  className="absolute right-3.5 top-3.5 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Bars */}
              {password && (
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        passwordStrength >= level ? strengthLabel.color : "bg-neutral-800"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Security Notice */}
            <div className="p-3 bg-neutral-950/60 border border-neutral-800/80 rounded-xl flex items-center gap-2.5 text-[11px] text-neutral-400">
              <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
              <span>{t.verificationNotice}</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.creatingAccount}</span>
                </>
              ) : (
                <>
                  <span>{t.createAccountContinue}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-8 text-center text-xs text-neutral-400">
            {t.hasAccount}{" "}
            <Link
              href="/login"
              className="text-purple-400 hover:text-purple-300 font-semibold underline underline-offset-4"
            >
              {t.signInLink}
            </Link>
          </div>
        </div>

        {/* Global Footer Legal */}
        <div className="w-full max-w-md mx-auto pt-6 text-center text-[11px] text-neutral-600">
          {t.footer}
        </div>
      </div>
    </div>
  );
}
