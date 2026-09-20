"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { FolderItem, NoteItem } from "@/components/Sidebar";
import MarkdownViewer from "@/components/MarkdownViewer";
import DropzoneModal from "@/components/DropzoneModal";
import {
  FileText,
  UploadCloud,
  Edit3,
  Eye,
  Save,
  Trash2,
  Folder as FolderIcon,
  Search,
  BookOpen,
  Sparkles,
} from "lucide-react";

export default function AppHome() {
  const router = useRouter();
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

  // Upload Modal
  const [isUploadOpen, setIsUploadOpen] = useState(false);

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
        }
      });
  }, [activeNoteId]);

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
          <p className="text-sm">กำลังโหลดคลังโน้ต...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-neutral-950 text-neutral-200 flex overflow-hidden font-sans">
      {/* Sidebar Tree Navigation */}
      <Sidebar
        user={user}
        folders={folders}
        notes={notes}
        activeNoteId={activeNoteId}
        selectedFolderId={selectedFolderId}
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
        onLogout={handleLogout}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0c0d0e] relative overflow-hidden">
        {activeNote ? (
          <>
            {/* Top Toolbar */}
            <div className="h-14 border-b border-neutral-800/80 px-6 flex items-center justify-between bg-neutral-900/60 backdrop-blur-md">
              <div className="flex items-center gap-3 truncate">
                <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="font-semibold text-sm text-neutral-200 truncate">
                  {isEditing ? editTitle : activeNote.title}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleSaveNote}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSaving ? "กำลังบันทึก..." : "บันทึกโน้ต"}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700/80 text-neutral-300 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>แก้ไข</span>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`ลบโน้ต "${activeNote.title}" หรือไม่?`)) {
                          handleDeleteNote(activeNote.id);
                        }
                      }}
                      className="p-2 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded-lg transition-colors"
                      title="ลบโน้ตนี้"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Note Body: Markdown Viewer OR Editor */}
            {isEditing ? (
              <div className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">
                    ชื่อโน้ต
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-lg font-bold text-neutral-100 focus:outline-none focus:border-indigo-500"
                    placeholder="ใส่หัวข้อโน้ต..."
                  />
                </div>
                <div className="flex-1 flex flex-col">
                  <label className="block text-xs font-medium text-neutral-400 mb-1">
                    เนื้อหา Markdown
                  </label>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full flex-1 min-h-[450px] bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-sm font-mono text-neutral-200 focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
                    placeholder="เขียน Markdown ที่นี่..."
                  />
                </div>
              </div>
            ) : (
              <MarkdownViewer note={activeNote} />
            )}
          </>
        ) : (
          /* Empty State: Prompt to Drop or Select Note */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-3xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-center text-indigo-400 mb-6 shadow-xl shadow-indigo-500/5">
              <UploadCloud className="w-10 h-10 animate-bounce" />
            </div>
            <h2 className="text-2xl font-bold text-neutral-100 mb-2">
              โยนไฟล์ Markdown (.md) เพื่อเริ่มอ่านได้ทันที
            </h2>
            <p className="text-neutral-400 text-sm max-w-md mb-6 leading-relaxed">
              ลากไฟล์ .md จากคอมพิวเตอร์ของคุณมาวาง หรือกดปุ่มด้านล่างเพื่อนำเข้าเอกสาร
              ระบบจะจัดหน้าให้อ่านง่าย สวยงาม พร้อมสารบัญหัวข้อและจัดโครงสร้างอัตโนมัติ
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsUploadOpen(true)}
                className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>โยน / นำเข้าไฟล์ .md ตอนนี้</span>
              </button>
              <button
                onClick={() => handleCreateNote(selectedFolderId)}
                className="py-2.5 px-5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-sm font-medium transition-all flex items-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>สร้างโน้ตใหม่เปล่าๆ</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Dropzone / Upload Modal */}
      <DropzoneModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        folders={folders}
        currentFolderId={selectedFolderId}
        onSuccess={() => {
          loadFolders();
          loadNotes();
        }}
      />
    </div>
  );
}
