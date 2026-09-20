"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Cpu,
  User,
  Copy,
  Check,
  Download,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import JSZip from "jszip";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: { id: string; name: string; email: string };
  notes?: Array<{ id: string; title: string; folderId: string | null }>;
  folders?: Array<{ id: string; name: string }>;
  onAccountDeleted?: () => void;
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
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"mcp" | "account">("mcp");
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
          args: ["/Users/chitsanuphong/Documents/dataAipredict/note.md/mcp-server/index.js"],
          env: {},
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
            args: ["/Users/chitsanuphong/Documents/dataAipredict/note.md/mcp-server/index.js"],
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
            <span className="font-bold text-xs tracking-tight text-neutral-100">Settings</span>
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
          <aside className="w-48 border-r border-[#202430] bg-[#090b10] p-2 space-y-1 shrink-0">
            <button
              onClick={() => setActiveTab("mcp")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === "mcp"
                  ? "bg-[#181c29] text-indigo-300 border border-[#30374e] font-semibold"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-[#131620]"
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>MCP & Protocols</span>
            </button>

            <button
              onClick={() => setActiveTab("account")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === "account"
                  ? "bg-[#181c29] text-indigo-300 border border-[#30374e] font-semibold"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-[#131620]"
              }`}
            >
              <User className="w-3.5 h-3.5 text-neutral-400" />
              <span>Account & System</span>
            </button>
          </aside>

          {/* Right Content View */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {activeTab === "mcp" ? (
              <>
                {/* Status Bar */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#11141d] border border-[#202430]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-neutral-200">
                      MCP Server: <span className="text-emerald-400">Online</span>
                    </span>
                    <span className="text-[11px] font-mono text-neutral-500">stdio / local</span>
                  </div>
                  <span className="text-[10px] font-mono bg-[#181c29] text-neutral-400 border border-[#272d3d] px-2 py-0.5 rounded-md">
                    10 RPC Tools Active
                  </span>
                </div>

                {/* Setup Config Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 bg-[#131622] p-1 rounded-lg border border-[#202430]">
                      <button
                        onClick={() => setActiveConfigTab("claude")}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer ${
                          activeConfigTab === "claude"
                            ? "bg-[#222738] text-indigo-300 font-semibold shadow-xs"
                            : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        Claude Desktop
                      </button>
                      <button
                        onClick={() => setActiveConfigTab("cursor")}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer ${
                          activeConfigTab === "cursor"
                            ? "bg-[#222738] text-indigo-300 font-semibold shadow-xs"
                            : "text-neutral-400 hover:text-neutral-200"
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
            ) : (
              /* Account & System Tab */
              <div className="space-y-4">
                {/* Profile Information (No UUID) */}
                <div className="border border-[#202430] bg-[#11141d] rounded-xl p-4 space-y-3">
                  <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-400">
                    Profile Information
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-neutral-500 block text-[11px] mb-0.5">Name</span>
                      <span className="text-neutral-200 font-medium">
                        {user.name || "Default User"}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[11px] mb-0.5">Email</span>
                      <span className="text-neutral-200 font-medium font-mono">{user.email}</span>
                    </div>
                  </div>
                </div>

                {/* Data Management: Export Vault with Resilient Queue */}
                <div className="border border-[#202430] bg-[#11141d] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-400">
                        Data Management
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        Download an offline archive of all your notes and folders as a .zip file.
                      </div>
                    </div>
                    {!isExporting ? (
                      <button
                        onClick={handleExportVault}
                        disabled={notes.length === 0}
                        className="px-3 py-1.5 rounded-lg bg-[#181c26] hover:bg-[#222736] border border-[#262c3d] text-neutral-200 text-xs font-mono font-medium flex items-center gap-1.5 transition-all disabled:opacity-40 shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export Vault (.zip)
                      </button>
                    ) : (
                      <button
                        onClick={handleCancelExport}
                        className="px-3 py-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 text-xs font-mono transition-all shrink-0"
                      >
                        Cancel
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

                {/* Danger Zone: Account Deletion */}
                <div className="border border-rose-950/40 bg-rose-950/10 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-rose-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Danger Zone
                  </div>
                  <div className="text-xs text-neutral-400 leading-relaxed">
                    Permanently delete your account, notes, and folders from Supabase. This action cannot be undone.
                  </div>

                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-mono font-medium transition-all"
                    >
                      Delete Account
                    </button>
                  ) : (
                    <div className="p-3 bg-[#0c0e14] border border-rose-900/30 rounded-lg space-y-2.5">
                      <div className="text-xs text-neutral-300">
                        Please type <code className="font-mono text-rose-300 bg-rose-950/50 px-1 py-0.5 rounded border border-rose-800/40">{user.email}</code> to confirm:
                      </div>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder={user.email}
                        className="w-full bg-[#11141d] border border-[#202430] focus:border-rose-500/50 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 font-mono outline-none"
                      />
                      {deleteError && (
                        <div className="text-[11px] text-rose-400 font-mono">
                          {deleteError}
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={handleDeleteAccount}
                          disabled={deleteConfirmText !== user.email || isDeletingAccount}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-medium transition-all disabled:opacity-30 disabled:hover:bg-rose-600 flex items-center gap-1.5"
                        >
                          {isDeletingAccount && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {isDeletingAccount ? "Deleting..." : "Permanently Delete"}
                        </button>
                        <button
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeleteConfirmText("");
                            setDeleteError("");
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#181c26] hover:bg-[#222736] text-neutral-400 text-xs font-mono transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
