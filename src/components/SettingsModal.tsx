"use client";

import { useState, useEffect } from "react";
import {
  X,
  Cpu,
  User,
  Copy,
  Check,
  Terminal,
  FileText,
  Zap,
  FolderTree,
  Share2,
  Trash2,
  Sliders,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import Image from "next/image";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: { id: string; name: string; email: string };
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

export default function SettingsModal({ isOpen, onClose, user }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"mcp" | "account">("mcp");
  const [activeConfigTab, setActiveConfigTab] = useState<"claude" | "cursor">("claude");
  const [copiedConfig, setCopiedConfig] = useState<string | null>(null);

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
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-xs shadow-emerald-400" />
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
                <div className="border border-[#202430] bg-[#11141d] rounded-xl p-4 space-y-3">
                  <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-400">
                    User Credentials
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-neutral-500 block text-[11px] mb-0.5">Name</span>
                      <span className="text-neutral-200 font-medium font-mono">
                        {user.name || "Default User"}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[11px] mb-0.5">Email</span>
                      <span className="text-neutral-200 font-medium font-mono">{user.email}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-neutral-500 block text-[11px] mb-0.5">UUID</span>
                      <code className="text-neutral-400 font-mono text-[11px] bg-[#090b10] px-2 py-1 rounded border border-[#202430] inline-block">
                        {user.id}
                      </code>
                    </div>
                  </div>
                </div>

                <div className="border border-[#202430] bg-[#11141d] rounded-xl p-4 space-y-2 text-xs">
                  <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-400">
                    System Architecture
                  </div>
                  <div className="flex items-center gap-4 text-neutral-400 font-mono text-[11px]">
                    <span>App: Nota Web</span>
                    <span>•</span>
                    <span>Stack: Next.js 16 + Turbopack</span>
                    <span>•</span>
                    <span>DB: Supabase</span>
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
