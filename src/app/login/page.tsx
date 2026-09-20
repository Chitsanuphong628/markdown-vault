"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  KeyRound,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  FileCode,
  Network,
  Shield,
  Loader2,
} from "lucide-react";
import LanguageToggle from "@/components/LanguageToggle";

const I18N = {
  en: {
    heroTag: "Next-Gen Knowledge Base",
    heroTitle: "Write, Visualize & Organize in Pure Markdown",
    heroDesc:
      "Transform flat text into interactive documents with automatic table of contents, live Mermaid diagrams, and instant full-text search.",
    feature1Title: "Interactive Diagram Engine",
    feature1Desc: "Generate flowcharts, sequence diagrams, and class architectures on the fly.",
    feature2Title: "Seamless Cloud Sync",
    feature2Desc: "Instant persistence with Supabase PostgreSQL and end-to-end data isolation.",
    quote: "“The fastest way to turn raw developer thoughts into polished, readable knowledge.”",
    author: "Engineered for high-performing teams",
    signInTitle: "Welcome back",
    signInSub: "Sign in to access your Markdown Vault",
    emailLabel: "Email address",
    emailPlaceholder: "name@company.com",
    passwordLabel: "Password",
    passwordPlaceholder: "••••••••",
    forgotPass: "Forgot password?",
    signInBtn: "Sign in to account",
    signingIn: "Authenticating...",
    noAccount: "Don't have an account yet?",
    signUpLink: "Create an account",
    unverifiedNotice: "Please verify your email address to continue",
    verifyLinkText: "Click here to verify email →",
  },
  th: {
    heroTag: "คลังจัดการความรู้เจเนอเรชันใหม่",
    heroTitle: "เขียน วาดกราฟ และจัดระเบียบใน Markdown",
    heroDesc:
      "เปลี่ยนไฟล์ข้อความธรรมดาให้กลายเป็นเอกสารระดับโปร พร้อมสารบัญเลื่อนตามอัตโนมัติ แผนภาพ Mermaid และระบบค้นหาเนื้อหาทันใจ",
    feature1Title: "ระบบวาดกราฟไดอะแกรมในตัว",
    feature1Desc: "สร้าง Flowchart, Sequence และโครงสร้าง Class ได้ทันทีจากบล็อกโค้ด",
    feature2Title: "ซิงค์ข้อมูลบน Cloud ทันที",
    feature2Desc: "จัดเก็บบน Supabase PostgreSQL พร้อมระบบความปลอดภัยแยกข้อมูลส่วนบุคคล",
    quote: "“วิธีที่เร็วที่สุดในการเปลี่ยนบันทึกข้อความดิบให้เป็นคลังความรู้ที่อ่านง่ายและสวยงาม”",
    author: "ออกแบบมาเพื่อทีมและนักพัฒนายุดใหม่",
    signInTitle: "ยินดีต้อนรับกลับมา",
    signInSub: "ลงชื่อเข้าใช้เพื่อเปิดคลังโน้ต Markdown ของคุณ",
    emailLabel: "อีเมล",
    emailPlaceholder: "name@company.com",
    passwordLabel: "รหัสผ่าน",
    passwordPlaceholder: "••••••••",
    forgotPass: "ลืมรหัสผ่าน?",
    signInBtn: "เข้าสู่ระบบ",
    signingIn: "กำลังเข้าสู่ระบบ...",
    noAccount: "ยังไม่มีบัญชีใช้งาน?",
    signUpLink: "สมัครสมาชิกใหม่",
    unverifiedNotice: "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ",
    verifyLinkText: "คลิกที่นี่เพื่อไปหน้ายืนยันอีเมล →",
  },
};

export default function LoginPage() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "th">("en");
  const t = I18N[lang];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requiresVerification, setRequiresVerification] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setRequiresVerification(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.requiresVerification) {
          setRequiresVerification(true);
        }
        throw new Error(data.error || "Login failed");
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#090a0f] text-neutral-100 flex flex-col lg:flex-row overflow-x-hidden font-sans select-none">
      {/* LEFT PANE: Global Product Hero Showcase (Hidden on small mobile, visible on desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0e1017] via-[#090a0f] to-[#120f24] border-r border-neutral-800/70 p-12 flex-col justify-between relative overflow-hidden">
        {/* Ambient Gradient Glows */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-600/15 rounded-full blur-[140px] pointer-events-none" />

        {/* Top Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Markdown Vault
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                v2.0
              </span>
            </span>
            <span className="text-[11px] text-neutral-400">Intelligent Knowledge Cloud</span>
          </div>
        </div>

        {/* Center: Showcase Content & Interactive Preview Cards */}
        <div className="relative z-10 my-auto py-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t.heroTag}</span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-tight mb-4">
            {t.heroTitle}
          </h1>

          <p className="text-neutral-400 text-sm xl:text-base leading-relaxed mb-8">
            {t.heroDesc}
          </p>

          {/* Feature Highlight Cards */}
          <div className="grid grid-cols-1 gap-3.5">
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-md flex items-start gap-3.5 shadow-sm">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                <Network className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-neutral-200">{t.feature1Title}</h4>
                <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">{t.feature1Desc}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-md flex items-start gap-3.5 shadow-sm">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-neutral-200">{t.feature2Title}</h4>
                <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">{t.feature2Desc}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Social Proof / Testimonial Quote */}
        <div className="relative z-10 pt-6 border-t border-neutral-800/60 flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-300 italic font-medium">{t.quote}</p>
            <p className="text-[11px] text-neutral-500 mt-1">{t.author}</p>
          </div>
        </div>
      </div>

      {/* RIGHT PANE: Authentication Form */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-12 lg:p-16 relative">
        {/* Top Bar with Language Switcher */}
        <div className="flex items-center justify-between w-full max-w-md mx-auto">
          {/* Mobile-only logo */}
          <div className="flex lg:hidden items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold">Markdown Vault</span>
          </div>

          <div className="ml-auto">
            <LanguageToggle lang={lang} setLang={setLang} />
          </div>
        </div>

        {/* Form Container */}
        <div className="w-full max-w-md mx-auto my-auto py-8">
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              {t.signInTitle}
            </h2>
            <p className="text-neutral-400 text-sm">{t.signInSub}</p>
          </div>

          {/* Error / Alert Display */}
          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs leading-relaxed animate-in fade-in duration-200">
              <div className="font-semibold">{error}</div>
              {requiresVerification && (
                <div className="mt-2.5 pt-2.5 border-t border-rose-500/20">
                  <Link
                    href={`/verify-email?email=${encodeURIComponent(email)}`}
                    className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1"
                  >
                    <span>{t.verifyLinkText}</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-2">
                {t.emailLabel}
              </label>
              <div className="relative group">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5 transition-colors group-focus-within:text-indigo-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Password Field with Show/Hide */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-neutral-300">
                  {t.passwordLabel}
                </label>
              </div>
              <div className="relative group">
                <KeyRound className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5 transition-colors group-focus-within:text-indigo-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl pl-10 pr-11 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.signingIn}</span>
                </>
              ) : (
                <>
                  <span>{t.signInBtn}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Navigation Link */}
          <div className="mt-8 text-center text-xs text-neutral-400">
            {t.noAccount}{" "}
            <Link
              href="/register"
              className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4"
            >
              {t.signUpLink}
            </Link>
          </div>
        </div>

        {/* Global Footer Legal */}
        <div className="w-full max-w-md mx-auto pt-6 text-center text-[11px] text-neutral-600">
          Markdown Vault &copy; 2026. Secure & Private Knowledge Management.
        </div>
      </div>
    </div>
  );
}
