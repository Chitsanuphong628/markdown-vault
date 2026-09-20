"use client";

import { useState } from "react";
import {
  X,
  Cpu,
  User,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  Zap,
  FolderTree,
  FileText,
  Share2,
  Trash2,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import Image from "next/image";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: { id: string; name: string; email: string };
}

const MCP_TOOLS = [
  {
    name: "list_notes",
    category: "Read",
    desc: "Scan and fetch all notes in the vault with folder info, search queries, and limits.",
    icon: FileText,
  },
  {
    name: "get_note",
    category: "Read",
    desc: "Fetch complete Markdown body and metadata for a specific note ID.",
    icon: FileText,
  },
  {
    name: "create_note",
    category: "Write",
    desc: "Allow AI agents to create new Markdown documents directly inside any target folder.",
    icon: Zap,
  },
  {
    name: "update_note",
    category: "Write",
    desc: "Update document title, Markdown content, or move notes between folders.",
    icon: Sliders,
  },
  {
    name: "delete_note",
    category: "Write",
    desc: "Safely delete a note from the user's private vault.",
    icon: Trash2,
  },
  {
    name: "list_folders",
    category: "Read",
    desc: "Retrieve hierarchical folder structure and nested parent-child trees.",
    icon: FolderTree,
  },
  {
    name: "create_folder",
    category: "Write",
    desc: "Create new organized categories or nested sub-folders.",
    icon: FolderTree,
  },
  {
    name: "delete_folder",
    category: "Write",
    desc: "Remove an empty or obsolete folder category.",
    icon: Trash2,
  },
  {
    name: "share_note",
    category: "Share",
    desc: "Toggle public read-only web link sharing for any document.",
    icon: Share2,
  },
  {
    name: "scan_and_cleanup",
    category: "Maintenance",
    desc: "Health check and reorganize unfiled root documents.",
    icon: Sparkles,
  },
];

export default function SettingsModal({ isOpen, onClose, user }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"mcp" | "account">("mcp");
  const [copiedConfig, setCopiedConfig] = useState<string | null>(null);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-[#0e1015] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[640px] max-h-[90vh]">
        {/* Modal Top Header */}
        <div className="h-14 border-b border-neutral-800/80 px-6 flex items-center justify-between bg-neutral-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center p-1.5 shadow-xs">
              <Image
                src="/logo.png"
                alt="Nota Logo"
                width={18}
                height={18}
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
              <span>Settings</span>
              <span className="text-[10px] text-neutral-500 font-mono font-normal">⌘,</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Split Navigation & Content */}
        <div className="flex-1 flex min-h-0">
          {/* Internal Left Navigation */}
          <aside className="w-52 border-r border-neutral-800/80 bg-neutral-950/40 p-3 space-y-1 shrink-0">
            <button
              onClick={() => setActiveTab("mcp")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === "mcp"
                  ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/25 shadow-xs font-semibold"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
              }`}
            >
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>MCP & Integrations</span>
            </button>

            <button
              onClick={() => setActiveTab("account")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === "account"
                  ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/25 shadow-xs font-semibold"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
              }`}
            >
              <User className="w-4 h-4 text-neutral-400" />
              <span>Account & Profile</span>
            </button>
          </aside>

          {/* Tab Content Panel */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === "mcp" ? (
              <>
                {/* Server Status Hero */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-neutral-900/60 border border-indigo-500/20 flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                        MCP Server Live & Ready
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-neutral-100">
                      Model Context Protocol (MCP)
                    </h3>
                    <p className="text-xs text-neutral-400 max-w-md leading-relaxed">
                      Connect your Nota knowledge vault directly to Claude Desktop, Cursor, and autonomous AI agents with native read/write protocol tools.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono bg-neutral-900 text-neutral-300 border border-neutral-800 px-2 py-1 rounded-md">
                    v1.0.0 (Stdio)
                  </span>
                </div>

                {/* Integration Guides (Claude & Cursor) */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Quick Setup Configs</span>
                  </h4>

                  {/* Claude Desktop Config */}
                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-200">
                        Claude Desktop (<code className="text-indigo-400 font-mono">claude_desktop_config.json</code>)
                      </span>
                      <button
                        onClick={() => handleCopy(claudeConfig, "claude")}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        {copiedConfig === "claude" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy JSON</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="text-[11px] font-mono bg-neutral-900/90 text-neutral-300 p-3 rounded-lg overflow-x-auto border border-neutral-800/60 leading-relaxed">
                      {claudeConfig}
                    </pre>
                  </div>

                  {/* Cursor Config */}
                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-200">
                        Cursor IDE (<code className="text-purple-400 font-mono">~/.cursor/mcp.json</code>)
                      </span>
                      <button
                        onClick={() => handleCopy(cursorConfig, "cursor")}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        {copiedConfig === "cursor" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy JSON</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="text-[11px] font-mono bg-neutral-900/90 text-neutral-300 p-3 rounded-lg overflow-x-auto border border-neutral-800/60 leading-relaxed">
                      {cursorConfig}
                    </pre>
                  </div>
                </div>

                {/* Available Tools Listing */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Supported MCP Tools ({MCP_TOOLS.length})</span>
                    </h4>
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> All Connected
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {MCP_TOOLS.map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <div
                          key={tool.name}
                          className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-3 space-y-1 hover:border-neutral-700 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-indigo-300 flex items-center gap-1.5">
                              <Icon className="w-3.5 h-3.5 text-indigo-400" />
                              {tool.name}
                            </span>
                            <span
                              className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded border ${
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
                          <p className="text-[11px] text-neutral-400 leading-relaxed">
                            {tool.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              /* Account & Profile Tab */
              <div className="space-y-6">
                <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-4">
                  <h3 className="text-sm font-semibold text-neutral-100">User Profile</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-neutral-500 block mb-1">Display Name</span>
                      <span className="text-neutral-200 font-medium">
                        {user.name || "Anonymous Member"}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block mb-1">Email Address</span>
                      <span className="text-neutral-200 font-medium">{user.email}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-neutral-500 block mb-1">User Identifier (UUID)</span>
                      <span className="text-neutral-400 font-mono text-[11px] bg-neutral-900 px-2 py-1 rounded border border-neutral-800 inline-block">
                        {user.id}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-2">
                  <h3 className="text-sm font-semibold text-neutral-100">About Nota</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Nota is an intelligent Markdown knowledge management hub engineered for speed, structured thinking, and seamless AI agent interoperability.
                  </p>
                  <div className="pt-2 flex items-center gap-3 text-xs text-neutral-500">
                    <span>Engine: Next.js 16 + Turbopack</span>
                    <span>•</span>
                    <span>Database: Supabase PostgreSQL</span>
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
