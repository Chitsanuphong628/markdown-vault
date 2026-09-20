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
  Sliders,
  ShieldAlert,
  LogOut,
  Key,
} from "lucide-react";
import Image from "next/image";
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
    }, 200);
  };

  // Delete account confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const handleExportVault = async () => {
    if (notes.length === 0) return;
    setIsExporting(true);
    cancelExportRef.current = false;
    setExportProgress({
      total: notes.length,
      completed: 0,
      statusText: "Initializing export queue...",
      isWaiting: false,
    });

    try {
      const zip = new JSZip();
      const folderMap = new Map<string, string>();
      folders.forEach((f) => folderMap.set(f.id, f.name));

      const CONCURRENCY = 3;
      const THROTTLE_MS = 150;
      let completedCount = 0;

      // Helper for fetching a single note with exponential backoff if server is overloaded/rate-limited
      const fetchNoteWithRetry = async (noteId: string, maxRetries = 3): Promise<any> => {
        let attempt = 0;
        let delaySec = 3;

        while (attempt < maxRetries) {
          if (cancelExportRef.current) throw new Error("EXPORT_CANCELLED");

          try {
            const res = await fetch(`/api/notes/${noteId}`);
            
            // If server returns rate limit (429) or overloaded/unavailable (503)
            if (res.status === 429 || res.status === 503) {
              attempt++;
              setExportProgress((prev) => ({
                ...prev,
                isWaiting: true,
                statusText: `Server busy (${res.status}). Waiting ${delaySec}s before retrying...`,
              }));
              await new Promise((r) => setTimeout(r, delaySec * 1000));
              delaySec *= 2; // exponential backoff
              continue;
            }

            if (!res.ok) {
              throw new Error(`Server returned ${res.status}`);
            }

            const data = await res.json();
            return data.note;
          } catch (err: any) {
            if (err.message === "EXPORT_CANCELLED") throw err;
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

      // Process notes in batches of CONCURRENCY
      for (let i = 0; i < notes.length; i += CONCURRENCY) {
        if (cancelExportRef.current) break;

        const batch = notes.slice(i, i + CONCURRENCY);
        setExportProgress((prev) => ({
          ...prev,
          isWaiting: false,
          statusText: `Exporting items ${i + 1}–${Math.min(i + CONCURRENCY, notes.length)} of ${notes.length}...`,
        }));

        const results = await Promise.all(
          batch.map(async (note) => {
            const noteData = await fetchNoteWithRetry(note.id);
            return { note, noteData };
          })
        );

        if (cancelExportRef.current) break;

        for (const { note, noteData } of results) {
          completedCount++;
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

        // Throttle between batches to keep server load low
        if (i + CONCURRENCY < notes.length) {
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
    } catch (err: any) {
      if (err.message !== "EXPORT_CANCELLED") {
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
    } catch (err: any) {
      setDeleteError(err.message);
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
      mcpServers: {
        "nota-vault": {
          command: "node",
          args: ["./mcp-server/index.js"],
          env: {
            NOTA_USER_ID: generatedUserId,
          },
        },
      },
    },
    null,
    2
  );

  const cursorConfig = JSON.stringify(
    {
      mcp: {
        servers: {
          "nota-vault": {
            command: "node",
            args: ["./mcp-server/index.js"],
            env: {
              NOTA_USER_ID: generatedUserId,
            },
          },
        },
      },
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-[#0d0f15] border border-[#202430] rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[580px] max-h-[90vh] cursor-default font-sans antialiased text-neutral-200"
      >
        {/* HUD Top Bar */}
        <div className="h-12 border-b border-[#202430] px-5 flex items-center justify-between bg-[#11131c] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-[#161924] border border-[#272d3d] flex items-center justify-center p-1 shadow-xs">
              <Image
                src="/logo.png"
                alt="Nota Logo"
                width={16}
                height={16}
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-bold text-xs tracking-tight text-neutral-100">{t.settingsTitle}</span>
            <span className="text-[10px] text-neutral-500 font-mono bg-[#161924] border border-[#272d3d] px-1.5 py-0.5 rounded">
              ESC
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-neutral-200 hover:bg-[#1c202d] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* HUD Body */}
        <div className="flex-1 flex min-h-0">
          {/* Left Navigation Sidebar */}
          <aside className="w-52 border-r border-[#202430] bg-[#090b10] p-2 space-y-1 shrink-0">
            <div className="text-[9px] font-mono uppercase tracking-wider text-neutral-400 px-2.5 py-1">
              {t.tabPreferences}
            </div>
            <button
              onClick={() => setActiveTab("general")}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer outline-none border ${
                activeTab === "general"
                  ? "bg-[#181c29] text-indigo-300 border-[#30374e] font-semibold"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-[#131620] border-transparent"
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t.tabGeneral}</span>
            </button>

            <button
              onClick={() => setActiveTab("account")}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer outline-none border ${
                activeTab === "account"
                  ? "bg-[#181c29] text-indigo-300 border-[#30374e] font-semibold"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-[#131620] border-transparent"
              }`}
            >
              <User className="w-3.5 h-3.5 text-neutral-400" />
              <span>{t.tabAccount}</span>
            </button>

            <div className="text-[9px] font-mono uppercase tracking-wider text-neutral-400 px-2.5 pt-3 pb-1">
              {t.tabDataGroup}
            </div>
            <button
              onClick={() => setActiveTab("data")}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer outline-none border ${
                activeTab === "data"
                  ? "bg-[#181c29] text-indigo-300 border-[#30374e] font-semibold"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-[#131620] border-transparent"
              }`}
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.tabVault}</span>
            </button>

            <button
              onClick={() => setActiveTab("mcp")}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer outline-none border ${
                activeTab === "mcp"
                  ? "bg-[#181c29] text-indigo-300 border-[#30374e] font-semibold"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-[#131620] border-transparent"
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t.tabMcp}</span>
            </button>
          </aside>

          {/* Right Content View */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {activeTab === "mcp" ? (
              <>
                {/* Status Bar */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#11141d] border border-[#202430]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-200">
                      MCP Server: <span className="text-emerald-400">Online</span>
                    </span>
                    <span className="text-[11px] font-mono text-neutral-500">stdio / local</span>
                  </div>
                  <span className="text-[10px] font-mono bg-[#181c29] text-neutral-400 border border-[#272d3d] px-2 py-0.5 rounded-md">
                    10 RPC Tools Active
                  </span>
                </div>

                {/* User ID / Key Security Section */}
                <div className="p-3.5 rounded-xl bg-[#11141d] border border-[#202430] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-semibold text-neutral-200">Credential / NOTA_USER_ID</span>
                    </div>
                    <button
                      onClick={handleGenerateApiKey}
                      disabled={isGeneratingKey}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isGeneratingKey ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : generatedUserId ? (
                        "Regenerate"
                      ) : (
                        "Generate"
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    ค่าเริ่มต้นของ <code className="text-amber-300">NOTA_USER_ID</code> จะเว้นว่างไว้เป็น <code className="text-neutral-300">""</code> จนกว่าจะกดปุ่ม Generate เพื่อความปลอดภัย
                  </p>

                  {generatedUserId && (
                    <div className="flex items-center gap-2 p-2 bg-[#090b10] border border-[#282f42] rounded-lg">
                      <span className="font-mono text-xs text-amber-300 truncate flex-1 select-all">{generatedUserId}</span>
                      <button
                        onClick={() => handleCopy(generatedUserId, "userid")}
                        className="px-2 py-1 bg-[#181c29] hover:bg-[#222738] text-neutral-300 rounded text-[11px] font-mono shrink-0 cursor-pointer"
                      >
                        {copiedConfig === "userid" ? "Copied!" : "Copy ID"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Setup Config Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 bg-[#131622] p-1 rounded-lg border border-[#202430]">
                      <button
                        onClick={() => setActiveConfigTab("claude")}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer outline-none border ${
                          activeConfigTab === "claude"
                            ? "bg-[#222738] text-indigo-300 font-semibold border-[#30374e] shadow-xs"
                            : "text-neutral-400 hover:text-neutral-200 border-transparent"
                        }`}
                      >
                        Claude Desktop
                      </button>
                      <button
                        onClick={() => setActiveConfigTab("cursor")}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer outline-none border ${
                          activeConfigTab === "cursor"
                            ? "bg-[#222738] text-indigo-300 font-semibold border-[#30374e] shadow-xs"
                            : "text-neutral-400 hover:text-neutral-200 border-transparent"
                        }`}
                      >
                        Cursor IDE
                      </button>
                    </div>

                    <button
                      onClick={() =>
                        handleCopy(
                          activeConfigTab === "claude" ? claudeConfig : cursorConfig,
                          activeConfigTab
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-1 bg-[#181c29] hover:bg-[#202638] text-neutral-200 border border-[#2c3246] rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer"
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

                  <div className="bg-[#090b10] border border-[#202430] rounded-xl p-3.5 font-mono text-[11px] text-neutral-300 overflow-x-auto leading-relaxed shadow-inner">
                    {activeConfigTab === "claude" ? claudeConfig : cursorConfig}
                  </div>
                  <div className="text-[11px] text-neutral-500 font-mono flex items-center justify-between">
                    <span>* Replace <code className="text-neutral-400">./mcp-server/index.js</code> with your absolute workspace path if running outside the project root.</span>
                  </div>
                </div>

                {/* Tools Listing Table */}
                <div className="space-y-2">
                  <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-400">
                    Registered Protocol Tools
                  </div>

                  <div className="border border-[#202430] rounded-xl overflow-hidden divide-y divide-[#1b1f2b] bg-[#0c0e14]">
                    {MCP_TOOLS.map((tool) => (
                      <div
                        key={tool.name}
                        className="flex items-center justify-between px-3.5 py-2.5 hover:bg-[#12151f] transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <code className="text-xs font-mono font-bold text-indigo-300">
                            {tool.name}
                          </code>
                          <span className="text-neutral-400 text-xs truncate max-w-sm hidden sm:inline">
                            {tool.desc}
                          </span>
                        </div>

                        <span
                          className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border shrink-0 ${
                            tool.category === "Read"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : tool.category === "Write"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          }`}
                        >
                          {tool.category}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : activeTab === "general" ? (
              /* General & Preferences Tab */
              <div className="space-y-4">
                {/* Language Preferences */}
                <div className="border border-[#202430] bg-[#11141d] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-400">
                        {t.langPrefTitle}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        {t.langPrefDesc}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 bg-[#090b10] border border-[#202430] p-1 rounded-lg shrink-0">
                      <button
                        onClick={() => setLang && setLang("en")}
                        className={`px-3 py-1 text-xs font-mono rounded-md transition-colors cursor-pointer outline-none border ${
                          lang === "en"
                            ? "bg-[#1f2433] text-indigo-300 font-semibold border-[#323a52]"
                            : "text-neutral-400 hover:text-neutral-200 border-transparent"
                        }`}
                      >
                        English
                      </button>
                      <button
                        onClick={() => setLang && setLang("th")}
                        className={`px-3 py-1 text-xs font-mono rounded-md transition-colors cursor-pointer outline-none border ${
                          lang === "th"
                            ? "bg-[#1f2433] text-indigo-300 font-semibold border-[#323a52]"
                            : "text-neutral-400 hover:text-neutral-200 border-transparent"
                        }`}
                      >
                        ไทย
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === "account" ? (
              /* Account & Security Tab */
              <div className="space-y-4">
                {/* Profile Information */}
                <div className="border border-[#202430] bg-[#11141d] rounded-xl p-4 space-y-3">
                  <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-400">
                    {t.profileInfoTitle}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-neutral-500 block text-[11px] mb-0.5">{t.nameLabel}</span>
                      <span className="text-neutral-200 font-medium">
                        {user.name || "Default User"}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[11px] mb-0.5">{t.emailLabel}</span>
                      <span className="text-neutral-200 font-medium font-mono">{user.email}</span>
                    </div>
                  </div>
                </div>

                {/* Session & Sign Out */}
                <div className="border border-[#202430] bg-[#11141d] rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-400">
                      {t.signOutSectionTitle}
                    </div>
                    <div className="text-xs text-neutral-400 mt-0.5">
                      {t.signOutSectionDesc}
                    </div>
                  </div>
                  {onLogout && (
                    <button
                      onClick={() => {
                        if (confirm(t.logoutConfirm)) {
                          onClose();
                          onLogout();
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/60 text-xs font-mono font-medium transition-all hover:text-white cursor-pointer shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{t.signOutBtn}</span>
                    </button>
                  )}
                </div>

                {/* Danger Zone: Account Deletion */}
                <div className="border border-[#202430] bg-[#11141d] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-rose-400">
                        {t.deleteAccountSectionTitle}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        {t.deleteAccountSectionDesc}
                      </div>
                    </div>
                    {!showDeleteConfirm && (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-mono font-medium transition-all shrink-0"
                      >
                        {t.deleteAccountBtn}
                      </button>
                    )}
                  </div>

                  {/* Confirmation Inline Row */}
                  {showDeleteConfirm && (
                    <div className="pt-3 border-t border-[#1e2330] space-y-2.5">
                      <div className="text-xs text-neutral-300">
                        {t.typeToConfirm} <code className="font-mono text-rose-300 bg-rose-950/40 px-1 py-0.5 rounded border border-rose-900/40">{user.email}</code> {t.toConfirmDeletion}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder={user.email}
                          className="flex-1 bg-[#090b10] border border-[#202430] focus:border-rose-500/50 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 font-mono outline-none"
                        />
                        <button
                          onClick={handleDeleteAccount}
                          disabled={deleteConfirmText !== user.email || isDeletingAccount}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-medium transition-all disabled:opacity-30 disabled:hover:bg-rose-600 flex items-center gap-1.5 shrink-0"
                        >
                          {isDeletingAccount && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {isDeletingAccount ? t.saving : t.confirmDeleteBtn}
                        </button>
                        <button
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeleteConfirmText("");
                            setDeleteError("");
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#181c26] hover:bg-[#222736] text-neutral-400 text-xs font-mono transition-all shrink-0"
                        >
                          {t.cancelActionBtn}
                        </button>
                      </div>
                      {deleteError && (
                        <div className="text-[11px] text-rose-400 font-mono">
                          {deleteError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Data & Vault Tab */
              <div className="space-y-4">
                {/* Data Management: Export Vault with Resilient Queue */}
                <div className="border border-[#202430] bg-[#11141d] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-400">
                        {t.exportFullVaultTitle}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        {t.exportFullVaultDesc}
                      </div>
                    </div>
                    {!isExporting ? (
                      <button
                        onClick={handleExportVault}
                        disabled={notes.length === 0}
                        className="px-3 py-1.5 rounded-lg bg-[#181c26] hover:bg-[#222736] border border-[#262c3d] text-neutral-200 text-xs font-mono font-medium flex items-center gap-1.5 transition-all disabled:opacity-40 shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {t.exportVaultBtn}
                      </button>
                    ) : (
                      <button
                        onClick={handleCancelExport}
                        className="px-3 py-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 text-xs font-mono transition-all shrink-0"
                      >
                        {t.cancelActionBtn}
                      </button>
                    )}
                  </div>

                  {/* HUD Queue Progress */}
                  {isExporting && (
                    <div className="pt-2 border-t border-[#1e2330] space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="flex items-center gap-1.5 text-neutral-300">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              exportProgress.isWaiting
                                ? "bg-amber-400"
                                : "bg-cyan-400"
                            }`}
                          />
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
                      {/* Progress bar */}
                      <div className="w-full bg-[#0d1017] rounded-full h-1.5 overflow-hidden border border-[#202430]">
                        <div
                          className={`h-full transition-all duration-300 ${
                            exportProgress.isWaiting ? "bg-amber-400" : "bg-cyan-500"
                          }`}
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

                {/* Vault Overview Stats */}
                <div className="border border-[#202430] bg-[#11141d] rounded-xl p-4 space-y-3">
                  <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-400">
                    {t.vaultStorageTitle}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-[#090b10] border border-[#202430] rounded-lg">
                      <span className="text-neutral-500 block text-[11px] mb-0.5">{t.totalDocsLabel}</span>
                      <span className="text-neutral-200 font-mono text-base font-bold">{notes.length}</span>
                    </div>
                    <div className="p-3 bg-[#090b10] border border-[#202430] rounded-lg">
                      <span className="text-neutral-500 block text-[11px] mb-0.5">{t.totalFoldersLabel}</span>
                      <span className="text-neutral-200 font-mono text-base font-bold">{folders.length}</span>
                    </div>
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
