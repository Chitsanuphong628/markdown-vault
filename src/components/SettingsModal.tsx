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
  Keyboard,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import JSZip from "jszip";
import { Language, I18N_MAIN, I18N_MCP } from "@/lib/i18n";
import { createCursorInstallUrl, isMcpOAuthMetadataReady } from "@/lib/mcp/connect";
import {
  DEFAULT_SHORTCUTS,
  ShortcutActionId,
  getShortcuts,
  saveShortcut,
  resetShortcuts,
  formatComboDisplay,
  eventToKeyCombo,
} from "@/lib/shortcuts";

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
  desc: { en: string; th: string };
}

const MCP_TOOLS: ToolItem[] = [
  { name: "list_notes", category: "Read", desc: { en: "List and search notes across folders", th: "แสดงและค้นหาโน้ตในโฟลเดอร์" } },
  { name: "get_note", category: "Read", desc: { en: "Read a note and its frontmatter by ID", th: "อ่านโน้ตและ frontmatter จาก ID" } },
  { name: "create_note", category: "Write", desc: { en: "Create a Markdown note in a folder", th: "สร้างโน้ต Markdown ในโฟลเดอร์" } },
  { name: "update_note", category: "Write", desc: { en: "Edit a note title, content, or folder", th: "แก้ชื่อ เนื้อหา หรือโฟลเดอร์ของโน้ต" } },
  { name: "delete_note", category: "Write", desc: { en: "Delete a note", th: "ลบโน้ต" } },
  { name: "list_folders", category: "Read", desc: { en: "List folders and subfolders", th: "แสดงโฟลเดอร์และโฟลเดอร์ย่อย" } },
  { name: "create_folder", category: "Write", desc: { en: "Create a folder", th: "สร้างโฟลเดอร์" } },
  { name: "delete_folder", category: "Write", desc: { en: "Delete an empty folder", th: "ลบโฟลเดอร์ที่ไม่มีโน้ต" } },
  { name: "share_note", category: "Share", desc: { en: "Enable or disable a public link", th: "เปิดหรือปิดลิงก์สาธารณะ" } },
  { name: "scan_and_cleanup", category: "Maintenance", desc: { en: "Count notes and folders without changing them", th: "นับโน้ตและโฟลเดอร์โดยไม่แก้ข้อมูล" } },
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
  const m = I18N_MCP[lang] || I18N_MCP.en;
  const [activeTab, setActiveTab] = useState<"general" | "shortcuts" | "account" | "data" | "mcp">("general");
  const [mcpProvider, setMcpProvider] = useState<"cursor" | "claude" | "chatgpt">("cursor");
  const [manualConfigTab, setManualConfigTab] = useState<"cursor" | "claude">("cursor");
  const [mcpReadiness, setMcpReadiness] = useState<"checking" | "ready" | "unavailable">("checking");
  const [copiedConfig, setCopiedConfig] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  // Keyboard shortcuts state
  const [shortcuts, setShortcuts] = useState<Record<ShortcutActionId, string>>(() => getShortcuts());
  const [recordingActionId, setRecordingActionId] = useState<ShortcutActionId | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Export state & queue
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{
    total: number;
    completed: number;
    statusText: string;
    isWaiting: boolean;
  }>({ total: 0, completed: 0, statusText: "", isWaiting: false });
  const [exportNotice, setExportNotice] = useState("");
  const cancelExportRef = useRef(false);

  // The raw token is shown only at creation time and never persisted in browser storage.
  const [apiKey, setApiKey] = useState("");
  const [credentials, setCredentials] = useState<Array<{ id: string; createdAt: string; expiresAt: string; revokedAt: string | null }>>([]);
  const [keyError, setKeyError] = useState("");
  const [credentialsError, setCredentialsError] = useState("");
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  const loadCredentials = async () => {
    try {
      const response = await fetch("/api/auth/api-key", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCredentialsError(getKeyFailureMessage(response.status, data.error, m.credentialsLoadError));
        return;
      }
      setCredentials(data.credentials ?? []);
      setCredentialsError("");
    } catch {
      setCredentialsError(m.credentialsLoadError);
    }
  };

  const getKeyFailureMessage = (status: number, serverMessage: unknown, fallback: string) => {
    if (status === 401) return m.keySignIn;
    if (status === 403) return m.keyVerifyEmail;
    if (status === 429) return m.keyRateLimited;
    if (status === 503) return serverMessage === "MCP is not enabled" ? m.keyMcpDisabled : m.keyStorageError;
    return fallback;
  };

  const handleGenerateApiKey = async () => {
    setIsGeneratingKey(true);
    setKeyError("");
    try {
      const response = await fetch("/api/auth/api-key", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setKeyError(getKeyFailureMessage(response.status, data.error, m.keyCreateError));
        return;
      }
      setApiKey(data.token);
      await loadCredentials();
    } catch {
      setKeyError(m.keyCreateError);
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    setKeyError("");
    try {
      const response = await fetch("/api/auth/api-key", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setKeyError(getKeyFailureMessage(response.status, data.error, m.keyRevokeError));
        return;
      }
      setApiKey("");
      await loadCredentials();
    } catch {
      setKeyError(m.keyRevokeError);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === "mcp") void loadCredentials();
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen || activeTab !== "mcp") return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setMcpReadiness("checking");
    });
    const checkReadiness = async () => {
      try {
        const response = await fetch("/.well-known/oauth-authorization-server", {
          cache: "no-store",
          signal: controller.signal,
        });
        const metadata: unknown = response.ok ? await response.json() : null;
        if (!controller.signal.aborted) {
          setMcpReadiness(response.ok && isMcpOAuthMetadataReady(metadata) ? "ready" : "unavailable");
        }
      } catch {
        if (!controller.signal.aborted) setMcpReadiness("unavailable");
      }
    };
    void checkReadiness();
    return () => controller.abort();
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen) setApiKey("");
  }, [isOpen]);

  // Delete account confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const handleExportVault = async () => {
    setIsExporting(true);
    setExportNotice("");
    cancelExportRef.current = false;
    setExportProgress({
      total: 0,
      completed: 0,
      statusText: m.exportStart,
      isWaiting: false,
    });

    try {
      const exportNotes: Array<{ id: string; title: string; folderId: string | null }> = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const indexResponse = await fetch(`/api/notes?page=${page}`);
        if (!indexResponse.ok) throw new Error("export-index");
        const indexData = await indexResponse.json();
        if (Array.isArray(indexData.notes)) exportNotes.push(...indexData.notes);
        hasMore = Boolean(indexData.hasMore);
        page += 1;
        if (page > 10000) throw new Error("export-limit");
      }

      if (exportNotes.length === 0) {
        setExportProgress((prev) => ({ ...prev, statusText: m.noNotes, isWaiting: false }));
        return;
      }

      setExportProgress((prev) => ({ ...prev, total: exportNotes.length, statusText: m.exportingNotes }));
      const zip = new JSZip();
      const folderMap = new Map<string, string>();
      folders.forEach((f) => folderMap.set(f.id, f.name));

      const CONCURRENCY = 3;
      const THROTTLE_MS = 120;
      let completedCount = 0;
      let failedCount = 0;

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
                statusText: m.serverBusy(res.status, delaySec),
              }));
              await new Promise((r) => setTimeout(r, delaySec * 1000));
              delaySec *= 2;
              continue;
            }

            if (!res.ok) {
              throw new Error(`server-${res.status}`);
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
              statusText: errMsg.startsWith("server-")
                ? m.serverError(Number(errMsg.slice("server-".length)))
                : m.networkRetry(delaySec),
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
            const folderName = note.folderId ? folderMap.get(note.folderId) || m.unfiled : null;
            const fileName = `${note.title.replace(/[\/\\?%*:|"<>]/g, "-") || "untitled"}.md`;
            if (folderName) {
              zip.folder(folderName)?.file(fileName, noteData.content || "");
            } else {
              zip.file(fileName, noteData.content || "");
            }
          } else failedCount++;
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
          statusText: m.exportCancelled,
          isWaiting: false,
        }));
        return;
      }

      setExportProgress((prev) => ({
        ...prev,
        statusText: m.packaging,
        isWaiting: false,
      }));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nota-notes-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (failedCount > 0) setExportNotice(lang === "th" ? `ส่งออกไม่ครบ ${failedCount} โน้ต ตรวจสอบการเชื่อมต่อแล้วลองส่งออกอีกครั้ง` : `Could not export ${failedCount} note${failedCount === 1 ? "" : "s"}. Check your connection and export again.`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg !== "EXPORT_CANCELLED") {
        console.error("Vault export failed:", err);
        setExportNotice(errMsg === "export-index" ? m.exportIndexError : m.exportError);
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
      setDeleteError(m.confirmEmail);
      return;
    }

    setIsDeletingAccount(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/auth/delete-account", { method: "DELETE" });
      if (!res.ok) throw new Error("account-delete");
      if (onAccountDeleted) {
        onAccountDeleted();
      }
    } catch {
      setDeleteError(m.accountDeleteError);
      setIsDeletingAccount(false);
    }
  };

  // Synchronize shortcuts from storage on open or custom event
  useEffect(() => {
    const handleSync = () => setShortcuts(getShortcuts());
    window.addEventListener("nota:shortcuts-changed", handleSync);
    return () => window.removeEventListener("nota:shortcuts-changed", handleSync);
  }, []);

  // Listen for key recording when customizing a shortcut
  useEffect(() => {
    if (!isOpen || !recordingActionId) return;

    const handleRecordKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecordingActionId(null);
        setConflictWarning(null);
        return;
      }

      const combo = eventToKeyCombo(e);
      if (!combo) return; // User pressed only modifier key (e.g. Cmd alone)

      // Conflict detection
      const conflictingId = (Object.keys(shortcuts) as ShortcutActionId[]).find(
        (id) => id !== recordingActionId && shortcuts[id] === combo
      );

      if (conflictingId) {
        const meta = DEFAULT_SHORTCUTS[conflictingId];
        const actionLabel = meta.label[lang] || meta.label.en;
        setConflictWarning(`${t.shortcutsConflict} "${actionLabel}"`);
      } else {
        setConflictWarning(null);
      }

      saveShortcut(recordingActionId, combo);
      setShortcuts(getShortcuts());
      setRecordingActionId(null);
    };

    window.addEventListener("keydown", handleRecordKey, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleRecordKey, { capture: true });
    };
  }, [isOpen, recordingActionId, shortcuts, lang, t]);

  // Close on Escape key (only when NOT recording a shortcut)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (recordingActionId) {
          // Handled by key recorder
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, recordingActionId]);

  if (!isOpen) return null;

  const mcpServerUrl = `${typeof window === "undefined" ? "https://your-nota-domain.example" : window.location.origin}/api/mcp`;

  const oauthConfig = JSON.stringify(
    {
      mcpServers: {
        "nota-vault": {
          url: mcpServerUrl,
        },
      },
    },
    null,
    2
  );

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        "nota-vault": {
          command: "node",
          args: ["/absolute/path/to/nota/mcp-server/index.js"],
          env: { NOTA_API_KEY: apiKey || "PASTE_YOUR_MCP_KEY" },
        },
      },
    },
    null,
    2
  );

  const cursorConfig = JSON.stringify(
    {
      mcpServers: {
        "nota-vault": {
          url: mcpServerUrl,
          headers: { Authorization: `Bearer ${apiKey || "PASTE_YOUR_MCP_KEY"}` },
        },
      },
    },
    null,
    2
  );

  const manualConfigText = manualConfigTab === "claude" ? claudeConfig : cursorConfig;
  const cursorInstallUrl = createCursorInstallUrl(mcpServerUrl);
  const isLocalMcpUrl = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(mcpServerUrl).hostname);

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyError(null);
      setCopiedConfig(type);
      setTimeout(() => setCopiedConfig(current => current === type ? null : current), 2000);
    } catch {
      setCopyError(type);
    }
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
            aria-label={t.closeBtn}
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
              onClick={() => setActiveTab("shortcuts")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer outline-none text-left w-max shrink-0 whitespace-nowrap sm:w-full ${
                activeTab === "shortcuts"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850"
              }`}
            >
              <Keyboard className="w-4 h-4 text-neutral-400 shrink-0" />
              <span>{t.tabShortcuts}</span>
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
              onClick={() => setActiveTab("mcp")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer outline-none text-left w-max shrink-0 whitespace-nowrap sm:w-full ${
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
                    {t.interfaceLanguage}
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

            {activeTab === "shortcuts" && (
              <div className="space-y-6 max-w-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-100 mb-1">
                      {t.shortcutsTitle}
                    </h3>
                    <p className="text-sm text-neutral-400 leading-relaxed">
                      {t.shortcutsDesc}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      resetShortcuts();
                      setShortcuts(getShortcuts());
                      setConflictWarning(null);
                      setRecordingActionId(null);
                    }}
                    className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-medium border border-neutral-700/60 transition-colors cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.shortcutsResetBtn}</span>
                  </button>
                </div>

                {conflictWarning && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center justify-between animate-in fade-in">
                    <span>{conflictWarning}</span>
                    <button
                      type="button"
                      onClick={() => setConflictWarning(null)}
                      className="text-amber-400 hover:text-amber-200 font-semibold ml-2 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="bg-neutral-950/40 border border-neutral-800 rounded-xl divide-y divide-neutral-800/80 overflow-hidden">
                  {(Object.keys(DEFAULT_SHORTCUTS) as ShortcutActionId[]).map((actionId) => {
                    const meta = DEFAULT_SHORTCUTS[actionId];
                    const isRecording = recordingActionId === actionId;
                    const currentCombo = shortcuts[actionId] || meta.defaultKey;
                    const displayCombo = formatComboDisplay(currentCombo);

                    return (
                      <div
                        key={actionId}
                        className={`p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors ${
                          isRecording ? "bg-indigo-950/20" : "hover:bg-neutral-900/40"
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium text-neutral-200">
                            {meta.label[lang] || meta.label.en}
                          </div>
                          <div className="text-xs text-neutral-400">
                            {meta.desc[lang] || meta.desc.en}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                          {isRecording ? (
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 border border-indigo-500/50 rounded-lg text-xs font-mono text-indigo-300 animate-pulse">
                                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                                {t.shortcutsRecording}
                              </span>
                              <button
                                type="button"
                                onClick={() => setRecordingActionId(null)}
                                className="px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                              >
                                {t.shortcutsCancelRecord}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <kbd className="px-2.5 py-1 bg-neutral-900 border border-neutral-700/80 rounded-lg text-xs font-mono font-medium text-neutral-200 shadow-xs min-w-[50px] text-center tracking-wide">
                                {displayCombo}
                              </kbd>
                              <button
                                type="button"
                                onClick={() => {
                                  setConflictWarning(null);
                                  setRecordingActionId(actionId);
                                }}
                                className="px-2.5 py-1 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700/50 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                              >
                                {t.shortcutsChangeBtn}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 px-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-neutral-600" />
                  <span>{t.shortcutsModifierHint}</span>
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
                    {t.accountSessionDescription}
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
                        {user.name || t.unnamedUser}
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
                          <span>{isDeletingAccount ? m.deletingAccount : t.confirmDeleteBtn}</span>
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
                        <p role="alert" className="text-xs text-rose-400">
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
                    {t.storedNotesDescription}
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
                        <span role="status" aria-live="polite" className="text-neutral-300">
                          {exportProgress.statusText || m.processingQueue}
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

                  {exportNotice && <p role="alert" className="text-xs text-rose-300">{exportNotice}</p>}
                </div>
              </div>
            )}

            {activeTab === "mcp" && (
              <div className="space-y-6 max-w-3xl">
                <h3 className="text-base font-semibold text-neutral-100">MCP</h3>

                <section className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{m.connectApp}</h4>
                    {mcpProvider === "cursor" && (
                      <span role="status" className={`text-xs ${mcpReadiness === "ready" ? "text-emerald-400" : "text-neutral-400"}`}>
                        {mcpReadiness === "checking" ? m.checking : mcpReadiness === "ready" ? m.readyCursor : m.cursorUnavailable}
                      </span>
                    )}
                  </div>

                  <div role="group" aria-label={m.chooseApp} className="flex flex-wrap gap-1 border-b border-neutral-800 pb-3">
                    {(["cursor", "claude", "chatgpt"] as const).map(provider => (
                      <button
                        key={provider}
                        type="button"
                        aria-pressed={mcpProvider === provider}
                        onClick={() => { setMcpProvider(provider); setCopyError(null); }}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mcpProvider === provider ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"}`}
                      >
                        {provider === "chatgpt" ? "ChatGPT" : provider === "claude" ? "Claude" : "Cursor"}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {mcpProvider === "cursor"
                        ? m.cursorInstructions
                        : mcpProvider === "claude"
                        ? m.claudeInstructions
                        : m.chatgptInstructions}
                    </p>

                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400 mb-1.5">{m.mcpUrl}</div>
                      <code className="block w-full overflow-x-auto whitespace-nowrap rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 font-mono text-xs text-neutral-200 select-all">
                        {mcpServerUrl}
                      </code>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {mcpProvider === "cursor" && (
                        mcpReadiness === "ready" ? (
                          <a href={cursorInstallUrl} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors">
                            {m.addToCursor} <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <button type="button" disabled className="px-3 py-2 rounded-md bg-neutral-800 text-neutral-500 text-xs font-medium cursor-not-allowed">
                            {m.addToCursor}
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        onClick={() => void handleCopy(mcpServerUrl, "mcp-url")}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 text-xs font-medium transition-colors"
                      >
                        {copiedConfig === "mcp-url" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedConfig === "mcp-url" ? m.copied : m.copyUrl}
                      </button>
                    </div>

                    {mcpProvider === "cursor" && mcpReadiness === "unavailable" && (
                      <p className="text-xs text-amber-300">{m.cursorNotReady}</p>
                    )}
                    {mcpProvider !== "cursor" && isLocalMcpUrl && (
                      <p className="text-xs text-amber-300">{m.remoteUrlRequired}</p>
                    )}
                    {(copyError === "mcp-url" || copyError === "oauth-config") && <p role="alert" className="text-xs text-red-300">{m.copyFailed}</p>}
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {mcpProvider === "cursor" ? (
                        <>{m.cursorSetupNote} <button type="button" onClick={() => void handleCopy(oauthConfig, "oauth-config")} className="text-indigo-300 hover:text-indigo-200 underline underline-offset-2">{copiedConfig === "oauth-config" ? m.copiedJson : m.copyJson}</button></>
                      ) : mcpProvider === "claude" ? (
                        <>{m.claudeWorkspaceNote} · <a href="https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp" target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:text-indigo-200 underline underline-offset-2">{m.claudeGuide}</a></>
                      ) : (
                        <>{m.chatgptAvailabilityNote} · <a href="https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt" target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:text-indigo-200 underline underline-offset-2">{m.chatgptGuide}</a></>
                      )}
                    </p>
                  </div>
                </section>

                {/* Manual Key Management */}
                <div className="border-t border-neutral-800 pt-5 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <Key className="w-4 h-4 text-neutral-400" />
                      <span className="text-sm font-semibold text-neutral-200">{m.manualKeys}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateApiKey}
                      disabled={isGeneratingKey}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2 border border-neutral-700 shrink-0"
                    >
                      {isGeneratingKey ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{m.creatingKey}</span>
                        </>
                      ) : m.createKey}
                    </button>
                  </div>

                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {m.manualKeyDescription}
                  </p>

                  <details className="border-t border-neutral-800 pt-3">
                    <summary className="cursor-pointer text-xs text-neutral-300">{m.manualConfig}</summary>
                    <div className="space-y-2 pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex gap-1">
                          {(["cursor", "claude"] as const).map(configTab => (
                            <button key={configTab} type="button" onClick={() => setManualConfigTab(configTab)} aria-pressed={manualConfigTab === configTab} className={`rounded px-2 py-1 text-xs ${manualConfigTab === configTab ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"}`}>
                              {configTab === "cursor" ? m.cursorHttp : m.claudeStdio}
                            </button>
                          ))}
                        </div>
                        <button type="button" onClick={() => void handleCopy(manualConfigText, "manual-config")} className="inline-flex items-center gap-1 text-xs text-neutral-300 hover:text-white">
                          {copiedConfig === "manual-config" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedConfig === "manual-config" ? m.copiedConfig : m.copyConfig}
                        </button>
                      </div>
                      <pre className="overflow-x-auto rounded-md border border-neutral-800 bg-neutral-900 p-3 font-mono text-xs text-neutral-300">{manualConfigText}</pre>
                    </div>
                  </details>

                  {(copyError === "manual-config" || copyError === "mcp-key") && <p role="alert" className="text-xs text-red-300">{m.copyFailed}</p>}

                  {keyError && <p role="alert" className="text-xs text-red-300">{keyError}</p>}
                  {credentialsError && <p role="alert" className="text-xs text-red-300">{credentialsError}</p>}
                  {apiKey && (
                    <div className="flex items-center gap-3 p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg">
                      <span className="font-mono text-xs text-neutral-200 truncate flex-1 select-all">
                        {apiKey}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(apiKey, "mcp-key")}
                        className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 rounded text-xs font-mono transition-colors shrink-0 cursor-pointer"
                      >
                        {copiedConfig === "mcp-key" ? m.copiedKey : m.copyKey}
                      </button>
                    </div>
                  )}
                  {credentials.filter(item => !item.revokedAt).map(item => (
                    <div key={item.id} className="flex items-center justify-between text-xs text-neutral-400">
                      <span>{m.createdExpires(new Date(item.createdAt).toLocaleDateString(lang === "th" ? "th-TH" : "en-US"), new Date(item.expiresAt).toLocaleDateString(lang === "th" ? "th-TH" : "en-US"))}</span>
                      <button type="button" onClick={() => handleRevokeKey(item.id)} className="text-red-300 hover:text-red-200">{m.revoke}</button>
                    </div>
                  ))}
                </div>

                {/* Tools Listing Table */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    {lang === "th" ? "เครื่องมือ MCP" : "MCP tools"}
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
                            {tool.desc[lang]}
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
                          {lang === "th" ? ({ Read: "อ่าน", Write: "เขียน", Share: "แชร์", Maintenance: "ดูแลระบบ" }[tool.category]) : tool.category}
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
