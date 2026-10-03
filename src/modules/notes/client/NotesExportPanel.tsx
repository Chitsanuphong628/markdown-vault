"use client";

import { useRef, useState } from "react";
import { Download } from "lucide-react";
import JSZip from "jszip";
import { I18N_MAIN } from "@/modules/app-shell/shared";
import type { Language } from "@/shared/language";

type ExportNote = { id: string; title: string; folderId: string | null };
type ExportFolder = { id: string; name: string };

const copy = {
  en: {
    start: "Preparing export…",
    indexError: "Could not load the notes for export.",
    noNotes: "There are no notes to export.",
    exporting: "Exporting notes…",
    serverBusy: (status: number, seconds: number) => `Server busy (${status}). Retrying in ${seconds}s…`,
    serverError: (status: number) => `Server returned an error (${status}).`,
    networkRetry: (seconds: number) => `Connection interrupted. Retrying in ${seconds}s…`,
    cancelled: "Export cancelled.",
    packaging: "Creating ZIP file…",
    error: "Could not export notes. Check your connection and try again.",
    processing: "Preparing notes…",
    unfiled: "Unfiled",
    cancel: "Cancel",
    export: "Export ZIP",
    incomplete: (count: number) => `Could not export ${count} note${count === 1 ? "" : "s"}. Check your connection and export again.`,
  },
  th: {
    start: "กำลังเตรียมไฟล์…",
    indexError: "โหลดรายการโน้ตเพื่อส่งออกไม่ได้",
    noNotes: "ไม่มีโน้ตให้ส่งออก",
    exporting: "กำลังส่งออกโน้ต…",
    serverBusy: (status: number, seconds: number) => `เซิร์ฟเวอร์ไม่พร้อม (${status}) ลองใหม่ใน ${seconds} วินาที…`,
    serverError: (status: number) => `เซิร์ฟเวอร์ตอบกลับข้อผิดพลาด (${status})`,
    networkRetry: (seconds: number) => `การเชื่อมต่อขัดข้อง กำลังลองใหม่ใน ${seconds} วินาที…`,
    cancelled: "ยกเลิกการส่งออกแล้ว",
    packaging: "กำลังสร้างไฟล์ ZIP…",
    error: "ส่งออกโน้ตไม่ได้ ตรวจสอบการเชื่อมต่อแล้วลองใหม่",
    processing: "กำลังเตรียมโน้ต…",
    unfiled: "ไม่มีโฟลเดอร์",
    cancel: "ยกเลิก",
    export: "ส่งออก ZIP",
    incomplete: (count: number) => `ส่งออกไม่ครบ ${count} โน้ต ตรวจสอบการเชื่อมต่อแล้วลองส่งออกอีกครั้ง`,
  },
} satisfies Record<Language, Record<string, string | ((...args: number[]) => string)>>;

interface ExportProgress {
  total: number;
  completed: number;
  statusText: string;
  isWaiting: boolean;
}

export default function NotesExportPanel({
  notes,
  folders,
  lang,
}: {
  notes: ExportNote[];
  folders: ExportFolder[];
  lang: Language;
}) {
  const text = copy[lang];
  const labels = I18N_MAIN[lang];
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress>({ total: 0, completed: 0, statusText: "", isWaiting: false });
  const [notice, setNotice] = useState("");
  const cancelRef = useRef(false);

  const handleExport = async () => {
    setIsExporting(true);
    setNotice("");
    cancelRef.current = false;
    setProgress({ total: 0, completed: 0, statusText: text.start, isWaiting: false });

    try {
      const exportNotes: ExportNote[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const response = await fetch(`/api/notes?page=${page}`);
        if (!response.ok) throw new Error("export-index");
        const data = await response.json();
        if (Array.isArray(data.notes)) exportNotes.push(...data.notes);
        hasMore = Boolean(data.hasMore);
        page += 1;
        if (page > 10000) throw new Error("export-limit");
      }

      if (exportNotes.length === 0) {
        setProgress((current) => ({ ...current, statusText: text.noNotes, isWaiting: false }));
        return;
      }

      setProgress((current) => ({ ...current, total: exportNotes.length, statusText: text.exporting }));
      const zip = new JSZip();
      const folderNames = new Map(folders.map((folder) => [folder.id, folder.name]));
      const concurrency = 3;
      let completed = 0;
      let failed = 0;

      const fetchNoteWithRetry = async (noteId: string, maxRetries = 3) => {
        let attempt = 0;
        let delaySeconds = 2;
        while (attempt < maxRetries) {
          if (cancelRef.current) throw new Error("EXPORT_CANCELLED");
          try {
            const response = await fetch(`/api/notes/${noteId}`);
            if (response.status === 429 || response.status === 503) {
              attempt += 1;
              setProgress((current) => ({ ...current, isWaiting: true, statusText: text.serverBusy(response.status, delaySeconds) }));
              await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
              delaySeconds *= 2;
              continue;
            }
            if (!response.ok) throw new Error(`server-${response.status}`);
            const data = await response.json();
            return data.note as { content?: string };
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            if (message === "EXPORT_CANCELLED") throw error;
            attempt += 1;
            if (attempt >= maxRetries) {
              console.warn(`Failed to export note ${noteId} after ${maxRetries} retries:`, error);
              return null;
            }
            setProgress((current) => ({
              ...current,
              isWaiting: true,
              statusText: message.startsWith("server-")
                ? text.serverError(Number(message.slice("server-".length)))
                : text.networkRetry(delaySeconds),
            }));
            await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
            delaySeconds *= 2;
          }
        }
        return null;
      };

      for (let index = 0; index < exportNotes.length; index += concurrency) {
        if (cancelRef.current) break;
        const batch = exportNotes.slice(index, index + concurrency);
        const results = await Promise.all(batch.map(async (note) => {
          const payload = await fetchNoteWithRetry(note.id);
          completed += 1;
          return { note, payload };
        }));
        for (const { note, payload } of results) {
          if (!payload) {
            failed += 1;
            continue;
          }
          const folderName = note.folderId ? folderNames.get(note.folderId) || text.unfiled : null;
          const fileName = `${note.title.replace(/[\/\\?%*:|"<>]/g, "-") || "untitled"}.md`;
          if (folderName) zip.folder(folderName)?.file(fileName, payload.content || "");
          else zip.file(fileName, payload.content || "");
        }
        setProgress((current) => ({ ...current, completed }));
        if (index + concurrency < exportNotes.length) await new Promise((resolve) => setTimeout(resolve, 120));
      }

      if (cancelRef.current) {
        setProgress((current) => ({ ...current, statusText: text.cancelled, isWaiting: false }));
        return;
      }
      setProgress((current) => ({ ...current, statusText: text.packaging, isWaiting: false }));
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `nota-notes-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      if (failed > 0) setNotice(text.incomplete(failed));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message !== "EXPORT_CANCELLED") {
        console.error("Vault export failed:", error);
        setNotice(message === "export-index" ? text.indexError : text.error);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const cancelExport = () => {
    cancelRef.current = true;
    setIsExporting(false);
  };

  return (
    <div className="bg-neutral-950/40 border border-neutral-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-neutral-200 mb-1">{labels.exportFullVaultTitle}</h4>
          <p className="text-xs text-neutral-400 leading-relaxed">{labels.exportFullVaultDesc}</p>
        </div>
        {!isExporting ? (
          <button type="button" onClick={handleExport} disabled={notes.length === 0} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-2 transition-colors disabled:opacity-40 shrink-0 cursor-pointer">
            <Download className="w-4 h-4" /><span>{labels.exportVaultBtn}</span>
          </button>
        ) : (
          <button type="button" onClick={cancelExport} className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors shrink-0 cursor-pointer">{labels.cancelActionBtn}</button>
        )}
      </div>
      {isExporting && (
        <div className="pt-3 border-t border-neutral-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span role="status" aria-live="polite" className="text-neutral-300">{progress.statusText || text.processing}</span>
            <span className="text-neutral-400">{progress.completed} / {progress.total} ({progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0}%)</span>
          </div>
          <div className="w-full bg-neutral-900 rounded-full h-2 overflow-hidden border border-neutral-800">
            <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}
      {notice && <p role="alert" className="text-xs text-rose-300">{notice}</p>}
    </div>
  );
}
