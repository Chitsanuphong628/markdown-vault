"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Cpu,
  User,
  Copy,
  Check,
  Download,
  Loader2,
  Globe,
  Database,
  LogOut,
  Key,
} from "lucide-react";
import JSZip from "jszip";
import { Language, I18N_MAIN } from "@/lib/i18n";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: { id: string; name: string; email: string };
  notes?: Array<{ id: string; title: string; folderId: string | null }>;
  folders?: Array<{ id: string; name: string }>;
  onAccountDeleted?: () => void;
  onLogout?: () => void;
  lang?: Language;
  setLang?: (lang: Language) => void;
}

interface ToolItem {
  name: string;
  category: "Read" | "Write" | "Share" | "Maintenance";
  desc: string;
}

const MCP_TOOLS: ToolItem[] = [
  { name: "list_notes", category: "Read", desc: "Query, search, and list documents across folders" },
  { name: "get_note", category: "Read", desc: "Retrieve document body and frontmatter by ID" },
  { name: "create_note", category: "Write", desc: "Insert a new Markdown note into any destination folder" },
  { name: "update_note", category: "Write", desc: "Modify document title, markdown content, or folder parent" },
  { name: "delete_note", category: "Write", desc: "Permanently remove a note from the vault" },
  { name: "list_folders", category: "Read", desc: "Fetch directory tree and nested sub-folder structure" },
  { name: "create_folder", category: "Write", desc: "Create a new organization folder or sub-folder" },
  { name: "delete_folder", category: "Write", desc: "Remove an empty or obsolete folder" },
  { name: "share_note", category: "Share", desc: "Toggle read-only public web URL sharing" },
  { name: "scan_and_cleanup", category: "Maintenance", desc: "Check vault integrity and re-index unfiled notes" },
];

export default function SettingsModal({
  isOpen,
  onClose,
  user,
  notes = [],
  folders = [],
  onAccountDeleted,
  onLogout,
  lang = "en",
  setLang,
}: SettingsModalProps) {
  const t = I18N_MAIN[lang] || I18N_MAIN.en;
  const [activeTab, setActiveTab] = useState<"general" | "account" | "data" | "mcp">("general");
  const [activeConfigTab, setActiveConfigTab] = useState<"claude" | "cursor">("claude");
  const [copiedConfig, setCopiedConfig] = useState<string | null>(null);

  // Export state & queue
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{
    total: number;
    completed: number;
    statusText: string;
    isWaiting: boolean;
  }>({ total: 0, completed: 0, statusText: "", isWaiting: false });
  const cancelExportRef = useRef(false);

  // User ID / Key state
  const [generatedUserId, setGeneratedUserId] = useState<string>("");
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  const handleGenerateApiKey = () => {
    setIsGeneratingKey(true);
    setTimeout(() => {
      setGeneratedUserId(user.id);
      setIsGeneratingKey(false);
    }, 150);
  };

  // Delete account confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const handleExportVault = async () => {
    setIsExporting(true);
    cancelExportRef.current = false;
    setExportProgress({
      total: 0,
      completed: 0,
      statusText: "Initializing export queue...",
      isWaiting: false,
    });

    try {
      const exportNotes: Array<{ id: string; title: string; folderId: string | null }> = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const indexResponse = await fetch(`/api/notes?page=${page}`);
        if (!indexResponse.ok) throw new Error(`Unable to load export index (${indexResponse.status})`);
        const indexData = await indexResponse.json();
        if (Array.isArray(indexData.notes)) exportNotes.push(...indexData.notes);
        hasMore = Boolean(indexData.hasMore);
        page += 1;
        if (page > 10000) throw new Error("Export index exceeded the safety limit");
      }

      if (exportNotes.length === 0) {
        setExportProgress((prev) => ({ ...prev, statusText: "No notes to export.", isWaiting: false }));
        return;
      }

      setExportProgress((prev) => ({ ...prev, total: exportNotes.length, statusText: "Exporting all notes..." }));
      const zip = new JSZip();
      const folderMap = new Map<string, string>();
      folders.forEach((f) => folderMap.set(f.id, f.name));

      const CONCURRENCY = 3;
      const THROTTLE_MS = 120;
      let completedCount = 0;

      interface NoteExportPayload {
        id: string;
        title: string;
        content: string;
        createdAt: string;
        updatedAt: string;
        folderId?: string | null;
        isShared?: boolean;
        folder?: { name: string } | null;
      }

      const fetchNoteWithRetry = async (noteId: string, maxRetries = 3): Promise<NoteExportPayload | null> => {
        let attempt = 0;
        let delaySec = 2;

        while (attempt < maxRetries) {
          if (cancelExportRef.current) throw new Error("EXPORT_CANCELLED");

          try {
            const res = await fetch(`/api/notes/${noteId}`);
            if (res.status === 429 || res.status === 503) {
              attempt++;
              setExportProgress((prev) => ({
                ...prev,
                isWaiting: true,
                statusText: `Server busy (${res.status}). Waiting ${delaySec}s before retrying...`,
              }));
              await new Promise((r) => setTimeout(r, delaySec * 1000));
              delaySec *= 2;
              continue;
            }

            if (!res.ok) {
              throw new Error(`Server returned ${res.status}`);
            }

            const data = await res.json();
            return data.note;
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            if (errMsg === "EXPORT_CANCELLED") throw err;
            attempt++;
            if (attempt >= maxRetries) {
              console.warn(`Failed to export note ${noteId} after ${maxRetries} retries:`, err);
              return null;
            }
            setExportProgress((prev) => ({
              ...prev,
              isWaiting: true,
              statusText: `Network glitch. Retrying note in ${delaySec}s...`,
            }));
            await new Promise((r) => setTimeout(r, delaySec * 1000));
            delaySec *= 2;
          }
        }
        return null;
      };

      for (let i = 0; i < exportNotes.length; i += CONCURRENCY) {
        if (cancelExportRef.current) break;

        const slice = exportNotes.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          slice.map(async (n) => {
            const noteData = await fetchNoteWithRetry(n.id);
            completedCount++;
            return { note: n, noteData };
          })
        );

        for (const { note, noteData } of results) {
          if (noteData) {
            const folderName = note.folderId ? folderMap.get(note.folderId) || "Unfiled" : null;
            const fileName = `${note.title.replace(/[\/\\?%*:|"<>]/g, "-") || "untitled"}.md`;
            if (folderName) {
              zip.folder(folderName)?.file(fileName, noteData.content || "");
            } else {
              zip.file(fileName, noteData.content || "");
            }
          }
        }

        setExportProgress((prev) => ({
          ...prev,
          completed: completedCount,
        }));

        if (i + CONCURRENCY < exportNotes.length) {
          await new Promise((r) => setTimeout(r, THROTTLE_MS));
        }
      }

      if (cancelExportRef.current) {
        setExportProgress((prev) => ({
          ...prev,
          statusText: "Export cancelled.",
          isWaiting: false,
        }));
        return;
      }

      setExportProgress((prev) => ({
        ...prev,
        statusText: "Packaging .zip archive...",
        isWaiting: false,
      }));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nota-vault-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg !== "EXPORT_CANCELLED") {
        console.error("Vault export failed:", err);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleCancelExport = () => {
    cancelExportRef.current = true;
    setIsExporting(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== user.email) {
      setDeleteError("Please type your exact email to confirm.");
      return;
    }

    setIsDeletingAccount(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/auth/delete-account", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete account");
      }
      if (onAccountDeleted) {
        onAccountDeleted();
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to delete account";
      setDeleteError(errMsg);
      setIsDeletingAccount(false);
    }
  };

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const claudeConfig = JSON.stringify(
    {
      disabled: "MCP is unavailable in this public-production release.",
    },
    null,
    2
  );

  const cursorConfig = JSON.stringify(
    {
      disabled: "MCP is unavailable in this public-production release.",
    },
    null,
    2
  );

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedConfig(type);
    setTimeout(() => setCopiedConfig(null), 2000);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full h-full sm:h-[620px] sm:max-w-4xl bg-neutral-900 border-0 sm:border border-neutral-800 rounded-none sm:rounded-xl shadow-2xl overflow-hidden flex flex-col sm:max-h-[90vh] cursor-default font-sans antialiased text-neutral-200"
      >
        {/* Top Bar (Height 56px, 8pt alignment) */}
        <div className="h-14 border-b border-neutral-800 px-6 flex items-center justify-between bg-neutral-900 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-base tracking-tight text-neutral-100">
              {t.settingsTitle}
            </h2>
            <kbd className="hidden sm:inline-block text-[11px] text-neutral-400 font-mono bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded">
              ESC
            </kbd>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 flex flex-col sm:flex-row min-h-0">
          {/* Navigation Sidebar (Width 224px / 28x8pt) */}
          <aside className="w-full sm:w-56 border-b sm:border-b-0 sm:border-r border-neutral-800 bg-neutral-950/60 p-3 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible shrink-0">
            <div className="hidden sm:block text-[11px] font-medium uppercase tracking-wider text-neutral-400 px-3 py-2">
              {t.tabPreferences}
            </div>

            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer outline-none text-left w-max shrink-0 whitespace-nowrap sm:w-full ${
                activeTab === "general"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850"
              }`}
            >
              <Globe className="w-4 h-4 text-neutral-400 shrink-0" />
              <span>{t.tabGeneral}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("account")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer outline-none text-left w-max shrink-0 whitespace-nowrap sm:w-full ${
                activeTab === "account"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850"
              }`}
            >
              <User className="w-4 h-4 text-neutral-400 shrink-0" />
              <span>{t.tabAccount}</span>
            </button>

            <div className="hidden sm:block text-[11px] font-medium uppercase tracking-wider text-neutral-400 px-3 pt-4 pb-2">
              {t.tabDataGroup}
            </div>

            <button
              type="button"
              onClick={() => setActiveTab("data")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer outline-none text-left w-max shrink-0 whitespace-nowrap sm:w-full ${
                activeTab === "data"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850"
              }`}
            >
              <Database className="w-4 h-4 text-neutral-400 shrink-0" />
              <span>{t.tabVault}</span>
            </button>

            <button
              type="button"
              disabled
              title="MCP is disabled for the public-production release"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-not-allowed opacity-50 outline-none text-left w-max shrink-0 whitespace-nowrap sm:w-full ${
                activeTab === "mcp"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850"
              }`}
            >
              <Cpu className="w-4 h-4 text-neutral-400 shrink-0" />
              <span>{t.tabMcp}</span>
            </button>
          </aside>

          {/* Right Content View (Padding 24px / 3x8pt, Spacing 24px) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === "general" && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <h3 className="text-base font-semibold text-neutral-100 mb-1">
                    {t.langPrefTitle}
                  </h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    {t.langPrefDesc}
                  </p>
                </div>

                <div className="bg-neutral-950/40 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-300">
                    Interface Language
                  </span>
                  <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-700 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setLang && setLang("en")}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        lang === "en"
                          ? "bg-neutral-800 text-white"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setLang && setLang("th")}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        lang === "th"
                          ? "bg-neutral-800 text-white"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      ภาษาไทย
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "account" && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <h3 className="text-base font-semibold text-neutral-100 mb-1">
                    {t.profileInfoTitle}
                  </h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    Account profile credentials and active session
                  </p>
                </div>

                {/* Profile Card */}
                <div className="bg-neutral-950/40 border border-neutral-800 rounded-xl p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider block mb-1">
                        {t.nameLabel}
                      </span>
                      <span className="text-sm font-semibold text-neutral-200">
                        {user.name || "Default User"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider block mb-1">
                        {t.emailLabel}
                      </span>
                      <span className="text-sm font-semibold text-neutral-200 font-mono">
                        {user.email}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sign Out Card */}
                <div className="bg-neutral-950/40 border border-neutral-800 rounded-xl p-5 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-200 mb-1">
                      {t.signOutSectionTitle}
                    </h4>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {t.signOutSectionDesc}
                    </p>
                  </div>
                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(t.logoutConfirm)) {
                          onClose();
                          onLogout();
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors cursor-pointer shrink-0"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{t.signOutBtn}</span>
                    </button>
                  )}
                </div>

                {/* Danger Zone */}
                <div className="bg-neutral-950/40 border border-rose-900/30 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-rose-400 mb-1">
                        {t.deleteAccountSectionTitle}
                      </h4>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        {t.deleteAccountSectionDesc}
                      </p>
                    </div>
                    {!showDeleteConfirm && (
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-4 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-medium transition-colors shrink-0 cursor-pointer"
                      >
                        {t.deleteAccountBtn}
                      </button>
                    )}
                  </div>

                  {showDeleteConfirm && (
                    <div className="pt-4 border-t border-rose-950/60 space-y-3">
                      <p className="text-xs text-neutral-300">
                        {t.typeToConfirm}{" "}
                        <code className="font-mono text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-900/40">
                          {user.email}
                        </code>{" "}
                        {t.toConfirmDeletion}
                      </p>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder={user.email}
                          className="flex-1 bg-neutral-900 border border-neutral-700 focus:border-rose-500 rounded-lg px-3 py-2 text-xs text-neutral-100 font-mono outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleDeleteAccount}
                          disabled={deleteConfirmText !== user.email || isDeletingAccount}
                          className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors disabled:opacity-40 disabled:hover:bg-rose-600 flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          {isDeletingAccount && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>{isDeletingAccount ? t.saving : t.confirmDeleteBtn}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeleteConfirmText("");
                            setDeleteError("");
                          }}
                          className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs transition-colors shrink-0 cursor-pointer"
                        >
                          {t.cancelActionBtn}
                        </button>
                      </div>
                      {deleteError && (
                        <p className="text-xs text-rose-400 font-mono">
                          {deleteError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "data" && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <h3 className="text-base font-semibold text-neutral-100 mb-1">
                    {t.tabVault}
                  </h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    Overview of your stored markdown documents and export tools
                  </p>
                </div>

                {/* Storage Stats Grid (8pt Grid) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-neutral-950/40 border border-neutral-800 rounded-xl">
                    <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider block mb-1">
                      {t.totalDocsLabel}
                    </span>
                    <span className="text-2xl font-bold font-mono text-neutral-100">
                      {notes.length.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-4 bg-neutral-950/40 border border-neutral-800 rounded-xl">
                    <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider block mb-1">
                      {t.totalFoldersLabel}
                    </span>
                    <span className="text-2xl font-bold font-mono text-neutral-100">
                      {folders.length.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Export Section */}
                <div className="bg-neutral-950/40 border border-neutral-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-neutral-200 mb-1">
                        {t.exportFullVaultTitle}
                      </h4>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        {t.exportFullVaultDesc}
                      </p>
                    </div>

                    {!isExporting ? (
                      <button
                        type="button"
                        onClick={handleExportVault}
                        disabled={notes.length === 0}
                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-2 transition-colors disabled:opacity-40 shrink-0 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>{t.exportVaultBtn}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleCancelExport}
                        className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors shrink-0 cursor-pointer"
                      >
                        {t.cancelActionBtn}
                      </button>
                    )}
                  </div>

                  {isExporting && (
                    <div className="pt-3 border-t border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-neutral-300">
                          {exportProgress.statusText || "Processing queue..."}
                        </span>
                        <span className="text-neutral-400">
                          {exportProgress.completed} / {exportProgress.total} (
                          {exportProgress.total > 0
                            ? Math.round((exportProgress.completed / exportProgress.total) * 100)
                            : 0}
                          %)
                        </span>
                      </div>
                      <div className="w-full bg-neutral-900 rounded-full h-2 overflow-hidden border border-neutral-800">
                        <div
                          className="h-full bg-indigo-600 transition-all duration-300"
                          style={{
                            width: `${
                              exportProgress.total > 0
                                ? (exportProgress.completed / exportProgress.total) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "mcp" && (
              <div className="space-y-6 max-w-3xl">
                <div>
                  <h3 className="text-base font-semibold text-neutral-100 mb-1">
                    Model Context Protocol (MCP)
                  </h3>
                  <p className="text-sm text-amber-300 leading-relaxed">
                    MCP ถูกปิดชั่วคราวสำหรับ public production ระหว่างการตรวจสอบ tenant isolation และ API-key security
                  </p>
                </div>

                {/* Status Header */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-950/40 border border-neutral-800">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-sm font-semibold text-neutral-200">
                      Server Status: <span className="text-emerald-400 font-medium">Online</span>
                    </span>
                    <span className="text-xs font-mono text-neutral-400 ml-2">
                      (stdio / local transport)
                    </span>
                  </div>
                  <span className="text-xs font-mono text-neutral-400 bg-neutral-900 border border-neutral-750 px-2.5 py-1 rounded-md">
                    10 RPC Tools Active
                  </span>
                </div>

                {/* User ID & Key Management */}
                <div className="p-5 rounded-xl bg-neutral-950/40 border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <Key className="w-4 h-4 text-neutral-400" />
                      <span className="text-sm font-semibold text-neutral-200">
                        Connection Credential
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateApiKey}
                      disabled={isGeneratingKey}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2 border border-neutral-700"
                    >
                      {isGeneratingKey ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : generatedUserId ? (
                        "Regenerate Key"
                      ) : (
                        "Generate Key"
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-neutral-400 leading-relaxed">
                    MCP จะกลับมาเปิดได้หลังผ่าน security review และมี credential model ที่แยกจาก web session โดยสมบูรณ์
                  </p>

                  {generatedUserId && (
                    <div className="flex items-center gap-3 p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg">
                      <span className="font-mono text-xs text-neutral-200 truncate flex-1 select-all">
                        {generatedUserId}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(generatedUserId, "userid")}
                        className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 rounded text-xs font-mono transition-colors shrink-0 cursor-pointer"
                      >
                        {copiedConfig === "userid" ? "Copied!" : "Copy ID"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Configuration Snippets */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                      <button
                        type="button"
                        onClick={() => setActiveConfigTab("claude")}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          activeConfigTab === "claude"
                            ? "bg-neutral-800 text-white font-semibold"
                            : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        Claude Desktop
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveConfigTab("cursor")}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          activeConfigTab === "cursor"
                            ? "bg-neutral-800 text-white font-semibold"
                            : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        Cursor IDE
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          activeConfigTab === "claude" ? claudeConfig : cursorConfig,
                          activeConfigTab
                        )
                      }
                      className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors cursor-pointer border border-neutral-700"
                    >
                      {copiedConfig === activeConfigTab ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Config</span>
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 font-mono text-xs text-neutral-300 overflow-x-auto leading-relaxed">
                    {activeConfigTab === "claude" ? claudeConfig : cursorConfig}
                  </pre>
                  <p className="text-xs text-neutral-400 font-mono">
                    * Replace <code className="text-neutral-300">./mcp-server/index.js</code> with your absolute workspace path if running outside the project root.
                  </p>
                </div>

                {/* Tools Listing Table */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Registered Protocol Tools
                  </h4>

                  <div className="border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800 bg-neutral-950/40">
                    {MCP_TOOLS.map((tool) => (
                      <div
                        key={tool.name}
                        className="flex items-center justify-between px-4 py-3 hover:bg-neutral-900/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <code className="text-xs font-mono font-bold text-neutral-200">
                            {tool.name}
                          </code>
                          <span className="text-neutral-400 text-xs truncate max-w-md hidden sm:inline">
                            {tool.desc}
                          </span>
                        </div>

                        <span
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border shrink-0 ${
                            tool.category === "Read"
                              ? "bg-neutral-800 text-neutral-300 border-neutral-700"
                              : tool.category === "Write"
                              ? "bg-neutral-800 text-neutral-300 border-neutral-700"
                              : "bg-neutral-800 text-neutral-300 border-neutral-700"
                          }`}
                        >
                          {tool.category}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
