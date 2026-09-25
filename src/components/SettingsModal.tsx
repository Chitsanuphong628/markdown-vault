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
  ShieldCheck,
} from "lucide-react";
import JSZip from "jszip";
import { Language, I18N_MAIN } from "@/lib/i18n";
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
  { name: "scan_and_cleanup", category: "Maintenance", desc: "Read-only counts for your folders and notes" },
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
  const [activeTab, setActiveTab] = useState<"general" | "shortcuts" | "account" | "data" | "mcp">("general");
  const [activeConfigTab, setActiveConfigTab] = useState<"oauth" | "cursor" | "claude">("oauth");
  const [copiedConfig, setCopiedConfig] = useState<string | null>(null);

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
  const cancelExportRef = useRef(false);

  // The raw token is shown only at creation time and never persisted in browser storage.
  const [apiKey, setApiKey] = useState("");
  const [credentials, setCredentials] = useState<Array<{ id: string; createdAt: string; expiresAt: string; revokedAt: string | null }>>([]);
  const [keyError, setKeyError] = useState("");
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  const loadCredentials = async () => {
    const response = await fetch("/api/auth/api-key", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setCredentials(data.credentials ?? []);
  };

  const handleGenerateApiKey = async () => {
    setIsGeneratingKey(true);
    setKeyError("");
    try {
      const response = await fetch("/api/auth/api-key", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create key");
      setApiKey(data.token);
      await loadCredentials();
    } catch (error) {
      setKeyError(error instanceof Error ? error.message : "Could not create key");
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    const response = await fetch("/api/auth/api-key", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (!response.ok) { setKeyError("Could not revoke key"); return; }
    setApiKey("");
    await loadCredentials();
  };

  useEffect(() => {
    if (isOpen && activeTab === "mcp") void loadCredentials();
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

  const activeConfigText =
    activeConfigTab === "oauth"
      ? oauthConfig
      : activeConfigTab === "claude"
      ? claudeConfig
      : cursorConfig;

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
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    ใช้ key ส่วนตัวสำหรับ stdio หรือ Streamable HTTP; key หมดอายุใน 90 วันและเพิกถอนได้ทันที
                  </p>
                </div>

                {/* Status Header */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-950/40 border border-neutral-800">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50" />
                    <span className="text-sm font-semibold text-neutral-200">
                      MCP Transport: <span className="text-neutral-300 font-medium">OAuth 2.0 PKCE / Streamable HTTP</span>
                    </span>
                  </div>
                  <span className="text-xs font-mono text-neutral-400 bg-neutral-900 border border-neutral-750 px-2.5 py-1 rounded-md">
                    10 MCP Tools
                  </span>
                </div>

                {/* 1-Click OAuth Connect Card */}
                <div className="p-5 rounded-xl bg-gradient-to-b from-indigo-950/30 to-neutral-950/40 border border-indigo-800/40 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-5 h-5 text-indigo-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-neutral-100">
                            1-Click OAuth Connect
                          </h4>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Recommended
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          เชื่อมต่อ AI Client ทันทีด้วย OAuth 2.0 PKCE ปลอดภัย ไม่ต้องก๊อปปี้ API Key
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-neutral-300 flex items-center justify-between">
                      <span>MCP Server URL</span>
                      <span className="text-neutral-500 font-mono text-[11px]">Streamable HTTP + RFC 8414 Discovery</span>
                    </label>
                    <div className="flex items-center gap-2 p-2 bg-neutral-900 border border-neutral-750 rounded-lg">
                      <span className="font-mono text-xs text-neutral-200 truncate flex-1 select-all px-1">
                        {mcpServerUrl}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(mcpServerUrl, "mcp-url")}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-medium transition-colors shrink-0 cursor-pointer shadow-xs"
                      >
                        {copiedConfig === "mcp-url" ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Server URL</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-400 pt-1">
                    <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-lg p-3 space-y-1">
                      <div className="font-semibold text-neutral-200">Cursor IDE</div>
                      <p className="text-[11px] leading-relaxed">
                        Settings &gt; Features &gt; MCP &gt; Add Server &gt; Type: HTTP / SSE &gt; Paste URL ด้านบน แล้วกด Connect
                      </p>
                    </div>
                    <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-lg p-3 space-y-1">
                      <div className="font-semibold text-neutral-200">Claude Desktop / ChatGPT</div>
                      <p className="text-[11px] leading-relaxed">
                        ใส่ URL ใน config แล้วเปิด Claude จะมีหน้าต่างเบราว์เซอร์เด้งขึ้นมาให้กดยืนยัน (Authorize) เพียง 1 คลิก
                      </p>
                    </div>
                  </div>
                </div>

                {/* Configuration Snippets */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                      <button
                        type="button"
                        onClick={() => setActiveConfigTab("oauth")}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          activeConfigTab === "oauth"
                            ? "bg-neutral-800 text-white font-semibold"
                            : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        OAuth (1-Click)
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
                        Cursor (Bearer Key)
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveConfigTab("claude")}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          activeConfigTab === "claude"
                            ? "bg-neutral-800 text-white font-semibold"
                            : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        Claude (stdio)
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(activeConfigText, activeConfigTab)}
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
                    {activeConfigText}
                  </pre>
                  <p className="text-xs text-neutral-400 font-mono">
                    {activeConfigTab === "oauth"
                      ? "ไม่ต้องระบุ Token ใน Config เพราะระบบจะทำ PKCE OAuth Handshake และขอ Token อัตโนมัติ"
                      : activeConfigTab === "cursor"
                      ? "โหมด HTTPS Bearer Key แนะนำให้สร้าง Key ด้านล่างแล้วนำมาใส่ใน Config"
                      : "โหมด stdio สำหรับรันแบบ Local Node.js script"}
                  </p>
                </div>

                {/* Manual Key Management */}
                <div className="p-5 rounded-xl bg-neutral-950/40 border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <Key className="w-4 h-4 text-neutral-400" />
                      <span className="text-sm font-semibold text-neutral-200">
                        Manual API Key Management (Fallback)
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
                      ) : "Generate Key"}
                    </button>
                  </div>

                  <p className="text-xs text-neutral-400 leading-relaxed">
                    ใช้เฉพาะเมื่อต้องการต่อแบบ manual ผ่าน Stdio หรือ Script ส่วนตัว คัดลอก key ทันทีหลังจากสร้าง
                  </p>

                  {keyError && <p role="alert" className="text-xs text-red-300">{keyError}</p>}
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
                        {copiedConfig === "mcp-key" ? "Copied!" : "Copy Key"}
                      </button>
                    </div>
                  )}
                  {credentials.filter(item => !item.revokedAt).map(item => (
                    <div key={item.id} className="flex items-center justify-between text-xs text-neutral-400">
                      <span>Created {new Date(item.createdAt).toLocaleDateString()} · Expires {new Date(item.expiresAt).toLocaleDateString()}</span>
                      <button type="button" onClick={() => handleRevokeKey(item.id)} className="text-red-300 hover:text-red-200">Revoke</button>
                    </div>
                  ))}
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
