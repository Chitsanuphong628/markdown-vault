"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
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
  Sparkles,
  Settings,
  X,
} from "lucide-react";

import { Language, I18N_MAIN } from "@/lib/i18n";
import { NoteColorKey, NOTE_THEMES } from "@/lib/noteTheme";

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
  revision: number;
  color?: NoteColorKey;
}

interface SidebarProps {
  user: { id: string; name: string; email: string };
  folders: FolderItem[];
  notes: NoteItem[];
  activeNoteId: string | null;
  selectedFolderId: string | null;
  lang: Language;
  setLang: (lang: Language) => void;
  onSelectNote: (id: string) => void;
  onSelectFolder: (id: string | null) => void;
  onOpenUpload: () => void;
  onCreateFolder: (name: string, parentId?: string | null) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onCreateNote: (folderId?: string | null) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
  onRenameNote?: (id: string, newTitle: string) => Promise<void>;
  onRenameFolder?: (id: string, newName: string) => Promise<void>;
  onMoveNote?: (noteId: string, targetFolderId: string | null) => Promise<void>;
  onMoveFolder?: (folderId: string, targetParentId: string | null) => Promise<void>;
  onOpenSettings?: () => void;
  onLogout: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  hasMoreNotes: boolean;
  isLoadingMoreNotes: boolean;
  onLoadMoreNotes: () => Promise<void>;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  user,
  folders,
  notes,
  activeNoteId,
  selectedFolderId,
  lang,
  setLang,
  onSelectNote,
  onSelectFolder,
  onOpenUpload,
  onCreateFolder,
  onDeleteFolder,
  onCreateNote,
  onDeleteNote,
  onRenameNote,
  onRenameFolder,
  onMoveNote,
  onMoveFolder,
  onOpenSettings,
  onLogout,
  searchQuery,
  setSearchQuery,
  hasMoreNotes,
  isLoadingMoreNotes,
  onLoadMoreNotes,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const t = I18N_MAIN[lang];
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Inline rename state for note & folder
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingType, setRenamingType] = useState<"note" | "folder" | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleStartRename = (id: string, type: "note" | "folder", currentName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRenamingId(id);
    setRenamingType(type);
    setRenameValue(currentName);
  };

  const handleFinishRename = async () => {
    if (!renamingId || !renamingType) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      if (renamingType === "note" && onRenameNote) {
        await onRenameNote(renamingId, trimmed);
      } else if (renamingType === "folder" && onRenameFolder) {
        await onRenameFolder(renamingId, trimmed);
      }
    }
    setRenamingId(null);
    setRenamingType(null);
    setRenameValue("");
  };

  const handleCancelRename = () => {
    setRenamingId(null);
    setRenamingType(null);
    setRenameValue("");
  };

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

  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null); // "root" or folder.id

  const handleDragStartNote = (e: React.DragEvent, noteId: string) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ type: "note", id: noteId }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragStartFolder = (e: React.DragEvent, folderId: string) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ type: "folder", id: folderId }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dragOverTarget !== targetId) {
      setDragOverTarget(targetId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverTarget === targetId) {
      setDragOverTarget(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);

    const rawData = e.dataTransfer.getData("application/json");
    if (!rawData) return;

    try {
      const data = JSON.parse(rawData);
      if (data.type === "note" && data.id) {
        if (onMoveNote) {
          await onMoveNote(data.id, targetFolderId);
        }
      } else if (data.type === "folder" && data.id) {
        // Prevent moving folder into itself
        if (data.id === targetFolderId) return;
        if (onMoveFolder) {
          await onMoveFolder(data.id, targetFolderId);
        }
      }
    } catch (err) {
      console.error("Drop error:", err);
    }
  };

  // Group notes into folder
  const rootNotes = notes.filter((n) => !n.folderId);
  const getNotesInFolder = (folderId: string) => notes.filter((n) => n.folderId === folderId);

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
        />
      )}

      <aside
        className={`w-72 bg-neutral-900/95 border-r border-neutral-800/80 flex flex-col h-full select-none shrink-0 shadow-2xl backdrop-blur-md transition-transform duration-300 ease-in-out
          fixed inset-y-0 left-0 z-50 md:relative md:z-20 md:translate-x-0
          ${isOpenMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* App Branding & User Profile */}
        <div className="p-3.5 border-b border-neutral-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-neutral-950/80 border border-neutral-800 flex items-center justify-center shadow-md shadow-indigo-500/10 shrink-0 p-1.5">
              <Image
                src="/logo.png"
                alt="Nota Logo"
                width={24}
                height={24}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm tracking-tight text-neutral-100">
                {t.appName}
              </h2>
              <p className="text-[11px] text-neutral-400 truncate max-w-[125px]">
                {user.name || user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                title="Settings & Integrations (⌘,)"
                className="p-1.5 text-neutral-400 hover:text-indigo-400 hover:bg-neutral-800/80 rounded-lg transition-colors cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {/* Mobile Close Drawer Button */}
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="md:hidden p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80 rounded-lg transition-colors cursor-pointer ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

      {/* Compact Action Bar & Search (Linear / VS Code style) */}
      <div className="px-3 pt-2.5 pb-1 space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-950/60 border border-neutral-800 rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <div className="flex items-center gap-0.5 shrink-0 bg-neutral-950/40 p-0.5 rounded-lg border border-neutral-800/80">
            <button
              onClick={() => onCreateNote(selectedFolderId)}
              title={t.newNote}
              className="p-1.5 text-neutral-400 hover:text-indigo-300 hover:bg-neutral-800/70 rounded-md transition-colors cursor-pointer"
            >
              <FilePlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsCreatingFolder(true)}
              title={t.newFolder}
              className="p-1.5 text-neutral-400 hover:text-amber-300 hover:bg-neutral-800/70 rounded-md transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onOpenUpload}
              title={t.importMd}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/70 rounded-md transition-colors cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* New Folder Inline Input */}
      {isCreatingFolder && (
        <form onSubmit={handleCreateFolderSubmit} className="p-3 mx-3 mt-2 bg-neutral-950/70 border border-neutral-800 rounded-xl">
          <div className="text-[11px] font-medium text-neutral-400 mb-1">{t.newFolderTitle}</div>
          <div className="flex gap-1.5">
            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={t.newFolderPlaceholder}
              className="flex-1 bg-neutral-900 border border-neutral-700/80 rounded-lg px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-500 transition-colors shadow-xs"
            >
              {t.createBtn}
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
      <div
        className="flex-1 overflow-y-auto p-2.5 space-y-1 text-xs"
        onDragOver={(e) => handleDragOver(e, "root")}
        onDragLeave={(e) => handleDragLeave(e, "root")}
        onDrop={(e) => handleDrop(e, null)}
      >
        {/* All Notes / Root selection (Drop zone to move note out of folders) */}
        <div
          onClick={() => onSelectFolder(null)}
          onDragOver={(e) => handleDragOver(e, "root")}
          onDragLeave={(e) => handleDragLeave(e, "root")}
          onDrop={(e) => handleDrop(e, null)}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors outline-none border ${
            dragOverTarget === "root"
              ? "bg-indigo-600/20 border-2 border-dashed border-indigo-500 text-indigo-300 scale-[1.01]"
              : selectedFolderId === null && !activeNoteId
              ? "bg-neutral-800 text-neutral-100 font-medium shadow-xs border-neutral-700/60"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 border-transparent"
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t.notesCount(notes.length)}</span>
          </div>
          {dragOverTarget === "root" && (
            <span className="text-[10px] text-indigo-400 font-medium animate-pulse">
              {t.dropToUnfile}
            </span>
          )}
        </div>

        {/* Folders List */}
        {folders.map((folder) => {
          const isOpen = !!openFolders[folder.id];
          const folderNotes = getNotesInFolder(folder.id);
          const isSelected = selectedFolderId === folder.id;
          const isDragOver = dragOverTarget === folder.id;

          return (
            <div key={folder.id} className="space-y-0.5">
              <div
                draggable
                onDragStart={(e) => handleDragStartFolder(e, folder.id)}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDragLeave={(e) => handleDragLeave(e, folder.id)}
                onDrop={(e) => handleDrop(e, folder.id)}
                onClick={() => {
                  onSelectFolder(folder.id);
                  setOpenFolders((p) => ({ ...p, [folder.id]: !p[folder.id] }));
                }}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors outline-none border ${
                  isDragOver
                    ? "bg-indigo-600/25 border-indigo-500 text-indigo-200 ring-2 ring-indigo-500/30 scale-[1.01]"
                    : isSelected
                    ? "bg-indigo-950/40 text-indigo-300 font-medium border-indigo-500/30"
                    : "text-neutral-300 hover:bg-neutral-800/60 border-transparent"
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
                  <FolderIcon
                    className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                      isDragOver ? "text-indigo-400 scale-110" : "text-amber-400"
                    }`}
                  />
                  {/* Folder Title or Inline Edit Input */}
                  {renamingId === folder.id && renamingType === "folder" ? (
                    <div
                      className="flex-1 flex items-center gap-1 min-w-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleFinishRename();
                          if (e.key === "Escape") handleCancelRename();
                        }}
                        onBlur={handleFinishRename}
                        className="w-full bg-neutral-900 border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-neutral-100 outline-none font-medium"
                      />
                    </div>
                  ) : (
                    <span
                      title="Double-click to rename"
                      onDoubleClick={(e) => handleStartRename(folder.id, "folder", folder.name, e)}
                      className="truncate flex-1 select-none"
                    >
                      {folder.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-neutral-500 mr-1">{folderNotes.length}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(t.deleteFolderConfirm(folder.name))) {
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
                <div
                  className="pl-6 space-y-0.5 border-l border-neutral-800/80 ml-3 transition-all"
                  onDragOver={(e) => handleDragOver(e, folder.id)}
                  onDragLeave={(e) => handleDragLeave(e, folder.id)}
                  onDrop={(e) => handleDrop(e, folder.id)}
                >
                  {folderNotes.length === 0 ? (
                    <div className="text-[11px] text-neutral-500 py-1.5 pl-2 italic border border-dashed border-neutral-800/60 rounded-md my-0.5">
                      {isDragOver ? t.emptyFolderHover : t.emptyFolder}
                    </div>
                  ) : (
                    folderNotes.map((note) => {
                      const theme = note.color && note.color !== "default" ? NOTE_THEMES[note.color] : null;
                      return (
                        <div
                          key={note.id}
                          draggable={renamingId !== note.id}
                          onDragStart={(e) => handleDragStartNote(e, note.id)}
                          onClick={() => onSelectNote(note.id)}
                          className={`group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing transition-colors outline-none border ${
                            activeNoteId === note.id
                              ? "bg-neutral-800/90 text-neutral-100 font-medium border-neutral-700/60 shadow-sm"
                              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate flex-1 min-w-0 mr-2">
                            {theme ? (
                              <span className={`w-2 h-2 rounded-full shrink-0 ${theme.dotColor}`} />
                            ) : (
                              <FileText className="w-3 h-3 shrink-0" />
                            )}
                          {renamingId === note.id && renamingType === "note" ? (
                            <div
                              className="flex-1 flex items-center min-w-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                ref={renameInputRef}
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleFinishRename();
                                  if (e.key === "Escape") handleCancelRename();
                                }}
                                onBlur={handleFinishRename}
                                className="w-full bg-neutral-900 border border-indigo-400 rounded px-1.5 py-0.5 text-xs text-neutral-100 outline-none"
                              />
                            </div>
                          ) : (
                            <span
                              title="Double-click to rename"
                              onDoubleClick={(e) => handleStartRename(note.id, "note", note.title, e)}
                              className="truncate flex-1 select-none"
                            >
                              {note.title}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(t.deleteNoteConfirm(note.title))) {
                              onDeleteNote(note.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-300 transition-opacity shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Root Notes (No folder) */}
        {rootNotes.length > 0 && (
          <div
            className="pt-2"
            onDragOver={(e) => handleDragOver(e, "root")}
            onDragLeave={(e) => handleDragLeave(e, "root")}
            onDrop={(e) => handleDrop(e, null)}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 px-2.5 mb-1 flex items-center justify-between">
              <span>{t.rootFilesHeader}</span>
              <span className="text-[9px] text-neutral-600 font-normal">{t.canDragHint}</span>
            </div>
            {rootNotes.map((note) => {
              const theme = note.color && note.color !== "default" ? NOTE_THEMES[note.color] : null;
              return (
                <div
                  key={note.id}
                  draggable={renamingId !== note.id}
                  onDragStart={(e) => handleDragStartNote(e, note.id)}
                  onClick={() => onSelectNote(note.id)}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-grab active:cursor-grabbing transition-colors outline-none border ${
                    activeNoteId === note.id
                      ? "bg-neutral-800/90 text-neutral-100 font-medium border-neutral-700/60 shadow-sm"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1 min-w-0 mr-2">
                    {theme ? (
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${theme.dotColor}`} />
                    ) : (
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                    )}
                  {renamingId === note.id && renamingType === "note" ? (
                    <div
                      className="flex-1 flex items-center min-w-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleFinishRename();
                          if (e.key === "Escape") handleCancelRename();
                        }}
                        onBlur={handleFinishRename}
                        className="w-full bg-neutral-900 border border-indigo-400 rounded px-1.5 py-0.5 text-xs text-neutral-100 outline-none"
                      />
                    </div>
                  ) : (
                    <span
                      title="Double-click to rename"
                      onDoubleClick={(e) => handleStartRename(note.id, "note", note.title, e)}
                      className="truncate flex-1 select-none"
                    >
                      {note.title}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(t.deleteNoteConfirm(note.title))) {
                      onDeleteNote(note.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-300 transition-opacity shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          </div>
        )}

        {hasMoreNotes && (
          <button
            type="button"
            onClick={onLoadMoreNotes}
            disabled={isLoadingMoreNotes}
            className="w-full mt-2 rounded-lg border border-neutral-800 bg-neutral-950/50 px-3 py-2 text-[11px] text-neutral-400 hover:border-indigo-500/50 hover:text-indigo-300 disabled:cursor-wait disabled:opacity-60 transition-colors"
          >
            {isLoadingMoreNotes ? "กำลังโหลด..." : "โหลดโน้ตเพิ่มเติม"}
          </button>
        )}
      </div>

      {/* Sidebar Footer with Language & Logout */}
      <div className="p-3 border-t border-neutral-800/80 bg-neutral-950/40 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "th" : "en")}
            className="px-2 py-1 bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 rounded-md border border-neutral-700/50 text-[11px] font-medium transition-colors cursor-pointer"
          >
            {lang.toUpperCase()}
          </button>
        </div>

        <button
          type="button"
          onClick={onLogout}
          title={t.logoutTitle}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{t.logoutTitle}</span>
        </button>
      </div>
    </aside>
    </>
  );
}
