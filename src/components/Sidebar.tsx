"use client";

import { useState } from "react";
import {
  Folder as FolderIcon,
  FolderPlus,
  FileText,
  FilePlus,
  ChevronRight,
  ChevronDown,
  Trash2,
  UploadCloud,
  LogOut,
  Search,
  BookOpen,
  Sparkles,
} from "lucide-react";

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
}

export interface NoteItem {
  id: string;
  title: string;
  folderId: string | null;
  updatedAt: string;
}

interface SidebarProps {
  user: { id: string; name: string; email: string };
  folders: FolderItem[];
  notes: NoteItem[];
  activeNoteId: string | null;
  selectedFolderId: string | null;
  onSelectNote: (id: string) => void;
  onSelectFolder: (id: string | null) => void;
  onOpenUpload: () => void;
  onCreateFolder: (name: string, parentId?: string | null) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onCreateNote: (folderId?: string | null) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
  onLogout: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export default function Sidebar({
  user,
  folders,
  notes,
  activeNoteId,
  selectedFolderId,
  onSelectNote,
  onSelectFolder,
  onOpenUpload,
  onCreateFolder,
  onDeleteFolder,
  onCreateNote,
  onDeleteNote,
  onLogout,
  searchQuery,
  setSearchQuery,
}: SidebarProps) {
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const toggleFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await onCreateFolder(newFolderName.trim(), selectedFolderId);
    setNewFolderName("");
    setIsCreatingFolder(false);
  };

  // Group notes into folder
  const rootNotes = notes.filter((n) => !n.folderId);
  const getNotesInFolder = (folderId: string) => notes.filter((n) => n.folderId === folderId);

  return (
    <aside className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col h-full select-none">
      {/* App Branding & User Profile */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm leading-tight text-neutral-100 flex items-center gap-1.5">
              Markdown Vault
            </h2>
            <p className="text-[11px] text-neutral-400 truncate max-w-[130px]">
              {user.name || user.email}
            </p>
          </div>
        </div>
        <button
          onClick={onLogout}
          title="ออกจากระบบ"
          className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800/80 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Action Buttons: Import / New Note / New Folder */}
      <div className="p-3 border-b border-neutral-800/80 space-y-2">
        <button
          onClick={onOpenUpload}
          className="w-full py-2 px-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
        >
          <UploadCloud className="w-4 h-4" />
          <span>โยน / นำเข้าไฟล์ .md</span>
        </button>

        <div className="flex gap-1.5">
          <button
            onClick={() => onCreateNote(selectedFolderId)}
            className="flex-1 py-1.5 px-2.5 bg-neutral-800 hover:bg-neutral-700/80 text-neutral-200 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <FilePlus className="w-3.5 h-3.5 text-indigo-400" />
            <span>สร้างโน้ต</span>
          </button>
          <button
            onClick={() => setIsCreatingFolder(true)}
            className="flex-1 py-1.5 px-2.5 bg-neutral-800 hover:bg-neutral-700/80 text-neutral-200 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
            <span>สร้างโฟลเดอร์</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-3 pt-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="ค้นหาโน้ตหรือเนื้อหา..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-950/70 border border-neutral-800/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* New Folder Inline Input */}
      {isCreatingFolder && (
        <form onSubmit={handleCreateFolderSubmit} className="p-3 bg-neutral-950/40 border-b border-neutral-800/60">
          <div className="text-[11px] text-neutral-400 mb-1">ชื่อโฟลเดอร์ใหม่:</div>
          <div className="flex gap-1.5">
            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. คู่มือ, โปรเจกต์"
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-500"
            >
              สร้าง
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingFolder(false)}
              className="px-1.5 py-1 text-neutral-400 hover:text-neutral-200 text-xs"
            >
              ✕
            </button>
          </div>
        </form>
      )}

      {/* Folder & Notes Tree Navigation */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 text-xs">
        {/* All Notes / Root selection */}
        <div
          onClick={() => onSelectFolder(null)}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
            selectedFolderId === null && !activeNoteId
              ? "bg-neutral-800 text-neutral-100 font-medium"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>โน้ตทั้งหมด ({notes.length})</span>
          </div>
        </div>

        {/* Folders List */}
        {folders.map((folder) => {
          const isOpen = !!openFolders[folder.id];
          const folderNotes = getNotesInFolder(folder.id);
          const isSelected = selectedFolderId === folder.id;

          return (
            <div key={folder.id} className="space-y-0.5">
              <div
                onClick={() => {
                  onSelectFolder(folder.id);
                  setOpenFolders((p) => ({ ...p, [folder.id]: !p[folder.id] }));
                }}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-indigo-950/40 text-indigo-300 font-medium"
                    : "text-neutral-300 hover:bg-neutral-800/60"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    onClick={(e) => toggleFolder(folder.id, e)}
                    className="p-0.5 hover:bg-neutral-700/60 rounded"
                  >
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                    )}
                  </span>
                  <FolderIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{folder.name}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-neutral-500 mr-1">{folderNotes.length}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`ลบโฟลเดอร์ "${folder.name}" หรือไม่?`)) {
                        onDeleteFolder(folder.id);
                      }
                    }}
                    className="p-1 hover:text-rose-400 rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Sub-notes inside folder */}
              {isOpen && (
                <div className="pl-6 space-y-0.5 border-l border-neutral-800/80 ml-3">
                  {folderNotes.length === 0 ? (
                    <div className="text-[11px] text-neutral-500 py-1 pl-2 italic">
                      โฟลเดอร์ว่างเปล่า
                    </div>
                  ) : (
                    folderNotes.map((note) => (
                      <div
                        key={note.id}
                        onClick={() => onSelectNote(note.id)}
                        className={`group flex items-center justify-between px-2 py-1 rounded-md cursor-pointer transition-colors ${
                          activeNoteId === note.id
                            ? "bg-indigo-600 text-white font-medium"
                            : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <FileText className="w-3 h-3 shrink-0" />
                          <span className="truncate">{note.title}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`ลบโน้ต "${note.title}"?`)) {
                              onDeleteNote(note.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-300 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Root Notes (No folder) */}
        {rootNotes.length > 0 && (
          <div className="pt-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 px-2.5 mb-1">
              ไฟล์นอกโฟลเดอร์
            </div>
            {rootNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => onSelectNote(note.id)}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  activeNoteId === note.id
                    ? "bg-indigo-600 text-white font-medium"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{note.title}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`ลบโน้ต "${note.title}"?`)) {
                      onDeleteNote(note.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-300 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
