"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { FolderItem, NoteItem } from "@/components/Sidebar";
import MarkdownViewer from "@/components/MarkdownViewer";
import DropzoneModal from "@/components/DropzoneModal";
import SettingsModal from "@/components/SettingsModal";
import {
  FileText,
  UploadCloud,
  Edit3,
  Save,
  Trash2,
  Share2,
  Check,
  Globe,
  Lock,
  Sparkles,
  Search,
} from "lucide-react";
import { Language, I18N_MAIN } from "@/lib/i18n";

export default function AppHome() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>("en");
  const t = I18N_MAIN[lang];
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<any | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Editor mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Share state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  // Upload Modal
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Check auth on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data) => {
        setUser(data.user);
        loadFolders();
        loadNotes();
      })
      .catch(() => {
        router.push("/login");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  // Global Keyboard shortcuts (Cmd/Ctrl + K for search, Cmd/Ctrl + , for settings)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"][placeholder*="Search"], input[type="text"][placeholder*="ค้นหา"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Load folders
  const loadFolders = async () => {
    try {
      const res = await fetch("/api/folders");
      const data = await res.json();
      if (data.folders) setFolders(data.folders);
    } catch (err) {
      console.error(err);
    }
  };

  // Load notes (with search)
  const loadNotes = async (q = searchQuery) => {
    try {
      const url = q ? `/api/notes?q=${encodeURIComponent(q)}` : "/api/notes";
      const res = await fetch(url);
      const data = await res.json();
      if (data.notes) setNotes(data.notes);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadNotes(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch single active note details
  useEffect(() => {
    if (!activeNoteId) {
      setActiveNote(null);
      return;
    }

    fetch(`/api/notes/${activeNoteId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.note) {
          setActiveNote(data.note);
          setEditTitle(data.note.title);
          setEditContent(data.note.content);
          setIsShared(Boolean(data.note.isShared));
        }
      });
  }, [activeNoteId]);

  // Handle Toggle Share
  const handleToggleShare = async (newSharedStatus: boolean) => {
    if (!activeNoteId) return;
    try {
      const res = await fetch(`/api/notes/${activeNoteId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isShared: newSharedStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setIsShared(newSharedStatus);
        setActiveNote((prev: any) => ({ ...prev, isShared: newSharedStatus }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyLink = () => {
    if (typeof window === "undefined" || !activeNoteId) return;
    const shareUrl = `${window.location.origin}/share/${activeNoteId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2000);
  };

  // Handle Create Note
  const handleCreateNote = async (folderId?: string | null) => {
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "โน้ตใหม่ไม่มีชื่อ",
          content: "# หัวข้อใหม่\n\nเริ่มพิมพ์ข้อความหรือ Markdown ของคุณที่นี่...",
          folderId: folderId || null,
        }),
      });
      const data = await res.json();
      if (data.note) {
        await loadNotes();
        setActiveNoteId(data.note.id);
        setIsEditing(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Save Note
  const handleSaveNote = async () => {
    if (!activeNoteId) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/notes/${activeNoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
        }),
      });
      const data = await res.json();
      if (data.note) {
        setActiveNote(data.note);
        setIsEditing(false);
        loadNotes();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Note
  const handleDeleteNote = async (id: string) => {
    try {
      await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (activeNoteId === id) {
        setActiveNoteId(null);
        setActiveNote(null);
      }
      loadNotes();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Create Folder
  const handleCreateFolder = async (name: string, parentId?: string | null) => {
    try {
      await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId }),
      });
      loadFolders();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Delete Folder
  const handleDeleteFolder = async (id: string) => {
    try {
      await fetch(`/api/folders/${id}`, { method: "DELETE" });
      if (selectedFolderId === id) setSelectedFolderId(null);
      loadFolders();
      loadNotes();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Move Note
  const handleMoveNote = async (noteId: string, targetFolderId: string | null) => {
    // Optimistic UI update
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, folderId: targetFolderId } : n))
    );
    try {
      await fetch(`/api/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: targetFolderId }),
      });
      loadNotes();
    } catch (err) {
      console.error("Failed to move note:", err);
      loadNotes();
    }
  };

  // Handle Move Folder
  const handleMoveFolder = async (folderId: string, targetParentId: string | null) => {
    // Optimistic UI update
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, parentId: targetParentId } : f))
    );
    try {
      await fetch(`/api/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: targetParentId }),
      });
      loadFolders();
    } catch (err) {
      console.error("Failed to move folder:", err);
      loadFolders();
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (loading || !user) {
    return (
      <div className="h-screen w-screen bg-neutral-950 flex items-center justify-center text-neutral-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-neutral-400">{t.loadingVault}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-neutral-950 text-neutral-200 flex overflow-hidden font-sans antialiased">
      {/* Sidebar Tree Navigation */}
      <Sidebar
        user={user}
        folders={folders}
        notes={notes}
        activeNoteId={activeNoteId}
        selectedFolderId={selectedFolderId}
        lang={lang}
        setLang={setLang}
        onSelectNote={(id) => {
          setActiveNoteId(id);
          setIsEditing(false);
        }}
        onSelectFolder={(id) => setSelectedFolderId(id)}
        onOpenUpload={() => setIsUploadOpen(true)}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        onCreateNote={handleCreateNote}
        onDeleteNote={handleDeleteNote}
        onMoveNote={handleMoveNote}
        onMoveFolder={handleMoveFolder}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0c0d0e] relative overflow-hidden">
        {activeNote ? (
          <>
            {/* Top Toolbar */}
            <div className="h-14 border-b border-neutral-800/80 px-6 flex items-center justify-between bg-neutral-900/40 backdrop-blur-md z-10">
              <div className="flex items-center gap-3 truncate min-w-0">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="font-semibold text-sm text-neutral-200 truncate">
                  {isEditing ? editTitle : activeNote.title}
                </span>
                {isShared && (
                  <span className="hidden sm:flex items-center gap-1.5 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2.5 py-0.5 rounded-full font-medium">
                    <Globe className="w-3 h-3" />
                    <span>{t.publicSharedBadge}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                    >
                      {t.cancelEdit}
                    </button>
                    <button
                      onClick={handleSaveNote}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-indigo-500/20 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSaving ? t.saving : t.saveNote}</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Share Button */}
                    <button
                      onClick={() => setIsShareModalOpen(true)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        isShared
                          ? "bg-emerald-600/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/25"
                          : "bg-neutral-800/90 hover:bg-neutral-700/80 text-neutral-300 border border-neutral-700/50"
                      }`}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>{t.shareNote}</span>
                    </button>

                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800/90 hover:bg-neutral-700/80 text-neutral-300 border border-neutral-700/50 rounded-lg text-xs font-medium transition-all cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{t.editNote}</span>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(t.deleteNoteConfirm(activeNote.title))) {
                          handleDeleteNote(activeNote.id);
                        }
                      }}
                      className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800/80 rounded-lg transition-colors cursor-pointer"
                      title={t.deleteNote}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Note Body: Markdown Viewer OR Editor */}
            {isEditing ? (
              <div className="flex-1 flex flex-col p-8 space-y-5 overflow-y-auto max-w-5xl mx-auto w-full">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                    {t.noteTitleLabel}
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl px-4 py-2.5 text-lg font-bold text-neutral-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                    placeholder={t.noteTitlePlaceholder}
                  />
                </div>
                <div className="flex-1 flex flex-col">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                    {t.markdownContentLabel}
                  </label>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full flex-1 min-h-[500px] bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 text-sm font-mono text-neutral-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 leading-relaxed resize-y shadow-inner"
                    placeholder={t.markdownContentPlaceholder}
                  />
                </div>
              </div>
            ) : (
              <MarkdownViewer
                note={activeNote}
                lang={lang}
                onUpdateContent={async (newContent) => {
                  if (!activeNoteId) return;
                  setActiveNote((prev: any) => ({ ...prev, content: newContent }));
                  setEditContent(newContent);
                  await fetch(`/api/notes/${activeNoteId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content: newContent }),
                  });
                }}
              />
            )}
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative">
            {/* Subtle background glow */}
            <div className="absolute w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -top-20" />
            
            <div className="w-20 h-20 rounded-3xl bg-neutral-900/90 border border-neutral-800 flex items-center justify-center text-indigo-400 mb-6 shadow-2xl shadow-indigo-500/10 ring-1 ring-neutral-800">
              <UploadCloud className="w-9 h-9 animate-pulse" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100 mb-3 tracking-tight">
              {t.emptyHeroTitle}
            </h2>
            <p className="text-neutral-400 text-sm max-w-lg mb-8 leading-relaxed">
              {t.emptyHeroDesc}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setIsUploadOpen(true)}
                className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 flex items-center gap-2 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{t.dropNowBtn}</span>
              </button>
              <button
                onClick={() => handleCreateNote(selectedFolderId)}
                className="py-2.5 px-5 bg-neutral-800/90 hover:bg-neutral-700/80 text-neutral-200 border border-neutral-700/50 rounded-xl text-sm font-medium transition-all flex items-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>{t.createEmptyBtn}</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Share Modal */}
      {isShareModalOpen && activeNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Share2 className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-neutral-100">{t.shareModalTitle}</h3>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
              {t.shareModalDesc}
            </p>

            <div className="p-4 bg-neutral-950/70 border border-neutral-800 rounded-xl space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isShared ? (
                    <Globe className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Lock className="w-4 h-4 text-neutral-500" />
                  )}
                  <span className="text-sm font-medium text-neutral-200">
                    {isShared ? t.isPublicOn : t.isPublicOff}
                  </span>
                </div>
                <button
                  onClick={() => handleToggleShare(!isShared)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isShared
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30"
                      : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-600/20"
                  }`}
                >
                  {isShared ? t.disableShareBtn : t.enableShareBtn}
                </button>
              </div>

              {isShared && (
                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1.5">
                    {t.shareLinkLabel}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={
                        typeof window !== "undefined"
                          ? `${window.location.origin}/share/${activeNote.id}`
                          : ""
                      }
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-300 font-mono select-all focus:outline-none"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/50 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedShareLink ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">{t.copiedBtn}</span>
                        </>
                      ) : (
                        <span>{t.copyBtn}</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="px-4 py-2 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                {t.closeBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dropzone / Upload Modal */}
      <DropzoneModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        folders={folders}
        currentFolderId={selectedFolderId}
        lang={lang}
        onSuccess={() => {
          loadFolders();
          loadNotes();
        }}
      />

      {/* Settings & Integrations Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
        notes={notes}
        folders={folders}
        onAccountDeleted={() => {
          setIsSettingsOpen(false);
          router.push("/login");
        }}
      />
    </div>
  );
}
