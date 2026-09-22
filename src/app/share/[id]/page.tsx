"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import Image from "next/image";
import MarkdownViewer from "@/components/MarkdownViewer";
import { BookOpen, Share2, ArrowLeft, Lock, Loader2 } from "lucide-react";

interface SharePageProps {
  params: Promise<{ id: string }>;
}

export default function ShareNotePage({ params }: SharePageProps) {
  const resolvedParams = use(params);
  const noteId = resolvedParams.id;

  const [note, setNote] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/share/${noteId}`)
      .then((res) => {
        if (!res.ok) {
          return res.json().then((d) => {
            throw new Error(d.error || "ไม่สามารถโหลดโน้ตที่แชร์ได้");
          });
        }
        return res.json();
      })
      .then((data) => {
        setNote(data.note);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [noteId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-neutral-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm">กำลังโหลดเอกสารที่แชร์...</p>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold mb-2">ไม่สามารถเปิดโน้ตนี้ได้</h1>
        <p className="text-neutral-400 text-sm max-w-md mb-6 leading-relaxed">
          {error || "โน้ตนี้อาจถูกปิดการแชร์แล้ว หรือลิงก์ไม่ถูกต้อง"}
        </p>
        <Link
          href="/"
          className="py-2.5 px-5 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-sm font-medium transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับไปยังหน้าหลัก</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0d0e] text-neutral-100 flex flex-col">
      {/* Top Navbar */}
      <header className="h-14 border-b border-neutral-800/80 px-6 flex items-center justify-between bg-neutral-900/60 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-neutral-950/80 border border-neutral-800 flex items-center justify-center p-1 shadow-sm">
            <Image
              src="/logo.png"
              alt="Nota Logo"
              width={20}
              height={20}
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <span className="text-xs font-bold text-neutral-200">Nota</span>
            <span className="text-[10px] text-neutral-500 ml-2">Shared Public Document</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
          >
            สร้างคลังโน้ตของคุณ
          </Link>
        </div>
      </header>

      {/* Reader Layout */}
      <main className="flex-1 flex overflow-hidden">
        <MarkdownViewer note={note} />
      </main>
    </div>
  );
}
