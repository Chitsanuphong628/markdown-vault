"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ShieldCheck,
  Cpu,
  Check,
  X,
  FileText,
  FolderTree,
  Edit3,
  Lock,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

interface UserInfo {
  id: string;
  email: string;
  name?: string | null;
  emailVerified?: boolean;
}

interface ClientInfo {
  client_name: string;
  redirect_uris: string[];
}

function AuthorizeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const clientId = searchParams.get("client_id") || "";
  const redirectUri = searchParams.get("redirect_uri") || "";
  const codeChallenge = searchParams.get("code_challenge") || "";
  const codeChallengeMethod = searchParams.get("code_challenge_method") || "S256";
  const state = searchParams.get("state") || "";
  const scope = searchParams.get("scope") || "mcp";

  const [user, setUser] = useState<UserInfo | null>(null);
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientDisplayName = client?.client_name ?? "AI client";

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const [userResponse, clientResponse] = await Promise.all([
          fetch("/api/auth/me"),
          fetch(`/api/oauth/client?client_id=${encodeURIComponent(clientId)}`, { cache: "no-store" }),
        ]);
        setUser(userResponse.ok ? (await userResponse.json()).user || null : null);
        setClient(clientResponse.ok ? await clientResponse.json() : null);
      } catch {
        setUser(null);
        setClient(null);
      } finally {
        setLoading(false);
      }
    };
    fetchContext();
  }, [clientId]);

  const handleDecision = async (decision: "allow" | "deny") => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          response_type: searchParams.get("response_type") || "code",
          state: state || undefined,
          scope,
          decision,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Authorization failed");
        setSubmitting(false);
        return;
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch {
      setError("Network error occurred while processing authorization");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0c0f] text-neutral-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-neutral-900/90 border border-neutral-800 rounded-3xl p-8 text-center space-y-4 animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-neutral-800 mx-auto" />
          <div className="h-5 w-48 bg-neutral-800 rounded mx-auto" />
          <div className="h-3 w-64 bg-neutral-800/60 rounded mx-auto" />
        </div>
      </div>
    );
  }

  if (!clientId || !redirectUri || !codeChallenge || !client || !client.redirect_uris.includes(redirectUri)) {
    return (
      <div className="min-h-screen bg-[#0c0c0f] text-neutral-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-neutral-100">Invalid OAuth Request</h1>
          <p className="text-xs text-neutral-400 leading-relaxed">
              คำขอเชื่อมต่อ OAuth 2.0 ไม่สมบูรณ์ หรือ callback ไม่ตรงกับ client ที่ลงทะเบียนไว้
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            กลับสู่หน้าหลัก (Back to Nota)
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0c0c0f] text-neutral-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-neutral-100 mb-1">
              เข้าสู่ระบบเพื่อเชื่อมต่อ MCP
            </h1>
            <p className="text-xs text-neutral-400 leading-relaxed">
              แอปพลิเคชัน <strong className="text-indigo-300">{clientDisplayName}</strong> ต้องการเชื่อมต่อกับคลังโน้ตของคุณ กรุณาเข้าสู่ระบบ Nota ก่อนอนุญาตสิทธิ์
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
              router.push(`/login?next=${returnUrl}`);
            }}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
          >
            เข้าสู่ระบบ (Sign in to Nota)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c0f] text-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Top Banner */}
        <div className="bg-neutral-950/60 border-b border-neutral-800 p-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-indigo-400 shadow-inner">
              <Cpu className="w-6 h-6" />
            </div>
            <ArrowRight className="w-4 h-4 text-neutral-500" />
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>

          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 mb-2">
            MCP OAuth 2.0 Authorization
          </span>
          <h1 className="text-base font-bold text-neutral-100">
            อนุญาตให้ <span className="text-indigo-400">{clientDisplayName}</span> เชื่อมต่อหรือไม่?
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            บัญชีของคุณ: <span className="text-neutral-200 font-medium">{user.email}</span>
          </p>
          <p className="text-[11px] text-neutral-500 mt-2 break-all">
            ปลายทางหลังอนุญาต: <code>{redirectUri}</code>
          </p>
        </div>

        {/* Permissions Body */}
        <div className="p-6 space-y-5">
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              สิทธิ์ที่แอปพลิเคชันนี้จะได้รับ (Model Context Protocol):
            </div>

            <div className="space-y-2.5">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800/80">
                <FileText className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-neutral-200">
                    ค้นหาและอ่านโน้ต (Read & Search Notes)
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    เข้าถึงรายการโน้ต ค้นหาข้อความ และอ่านเนื้อหา Markdown
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800/80">
                <Edit3 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-neutral-200">
                    สร้างและแก้ไขเอกสาร (Create & Update Notes)
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    สร้างบันทึกใหม่ แก้ไขเนื้อหา และตั้งค่าการแชร์สาธารณะ
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800/80">
                <FolderTree className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-neutral-200">
                    จัดการโครงสร้างโฟลเดอร์ (Manage Folders)
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    สร้างโฟลเดอร์ จัดหมวดหมู่ และทำความสะอาดโน้ตที่ซ้ำซ้อน
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleDecision("deny")}
              className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>ปฏิเสธ (Deny)</span>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleDecision("allow")}
              className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{submitting ? "กำลังเชื่อมต่อ..." : "อนุญาต (Authorize)"}</span>
            </button>
          </div>

          <p className="text-[11px] text-center text-neutral-500 leading-relaxed">
            ปลอดภัยด้วยมาตรฐาน PKCE S256 • คุณสามารถยกเลิกสิทธิ์ (Revoke) ได้ตลอดเวลาที่เมนู Settings → MCP
          </p>
        </div>
      </div>
    </div>
  );
}

export default function OAuthAuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0c0c0f] text-neutral-100 flex items-center justify-center">
          <div className="text-xs text-neutral-400 font-mono">Loading OAuth Consent...</div>
        </div>
      }
    >
      <AuthorizeContent />
    </Suspense>
  );
}
