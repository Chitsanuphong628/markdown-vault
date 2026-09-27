"use client";

import { useState, useRef, useEffect, useMemo, useCallback, useSyncExternalStore, memo } from "react";
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
  GripVertical,
} from "lucide-react";

import { Language, I18N_MAIN } from "@/lib/i18n";
import { NoteColorKey } from "@/lib/noteTheme";
import { getShortcuts, formatComboDisplay } from "@/lib/shortcuts";
import PwaInstallControl from "@/components/PwaInstallControl";
import { afterIdForMove, beforeIdForMove } from "@/lib/sidebarOrdering";

const subscribeToCoarsePointer = (callback: () => void) => {
  const mediaQuery = window.matchMedia("(any-pointer: coarse)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
};
const getCoarsePointerSnapshot = () => window.matchMedia("(any-pointer: coarse)").matches;

type SidebarDragItem = { kind: "note" | "folder"; id: string };
type SidebarDropPlacement =
  | { kind: "note"; parentId: string | null; beforeId: string | null; afterId: string | null; targetKey: string }
  | { kind: "folder"; parentId: string | null; beforeId: string | null; afterId: string | null; targetKey: string };

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder?: number;
}

export interface NoteItem {
  id: string;
  title: string;
  folderId: string | null;
  updatedAt: string;
  revision: number;
  sortOrder?: number;
  color?: NoteColorKey;
  excerpt?: string;
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
  onMoveNote?: (noteId: string, targetFolderId: string | null, beforeId?: string | null, afterId?: string | null) => Promise<void>;
  onMoveFolder?: (folderId: string, targetParentId: string | null, beforeId?: string | null, afterId?: string | null) => Promise<void>;
  onOpenSettings?: () => void;
  onLogout: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  hasMoreNotes: boolean;
  isLoadingMoreNotes: boolean;
  onLoadMoreNotes: () => Promise<void>;
  onPrefetchNote?: (id: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

function Sidebar({
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
  onPrefetchNote,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const t = I18N_MAIN[lang];
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const isTouchDevice = useSyncExternalStore(subscribeToCoarsePointer, getCoarsePointerSnapshot, () => false);
  const [revealedDeleteNoteId, setRevealedDeleteNoteId] = useState<string | null>(null);
  const [touchDraggedItem, setTouchDraggedItem] = useState<SidebarDragItem | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const dragSourceRef = useRef<SidebarDragItem | null>(null);
  const touchDragRef = useRef<{
    item: SidebarDragItem;
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
    active: boolean;
    timer: number | null;
  } | null>(null);
  const touchPlacementRef = useRef<SidebarDropPlacement | null>(null);
  const autoScrollTimerRef = useRef<number | null>(null);
  const swipeStartRef = useRef<{ id: string; pointerId: number; x: number; y: number } | null>(null);
  const suppressNoteClickRef = useRef(false);

  // Inline rename state for note & folder
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingType, setRenamingType] = useState<"note" | "folder" | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  const [shortcuts, setShortcuts] = useState(() => getShortcuts());

  useEffect(() => {
    const handleSync = () => setShortcuts(getShortcuts());
    window.addEventListener("nota:shortcuts-changed", handleSync);
    return () => window.removeEventListener("nota:shortcuts-changed", handleSync);
  }, []);

  useEffect(() => () => {
    if (touchDragRef.current && touchDragRef.current.timer !== null) window.clearTimeout(touchDragRef.current.timer);
    if (autoScrollTimerRef.current !== null) window.clearInterval(autoScrollTimerRef.current);
  }, []);

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

  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  const isDescendantFolder = useCallback(
    (folderId: string, targetId: string | null): boolean => {
      if (!targetId) return false;
      if (folderId === targetId) return true;
      const visited = new Set<string>();
      let curr = folders.find((f) => f.id === targetId);
      while (curr && curr.parentId) {
        if (visited.has(curr.id)) break;
        visited.add(curr.id);
        if (curr.parentId === folderId) return true;
        curr = folders.find((f) => f.id === curr!.parentId);
      }
      return false;
    },
    [folders]
  );

  // Group records once so the tree and drop placement use the same sibling order.
  const { foldersByParent, rootFolders, notesByFolder, rootNotes } = useMemo(() => {
    const childFolders: Record<string, FolderItem[]> = {};
    const rootFolderItems: FolderItem[] = [];
    const folderIds = new Set(folders.map((folder) => folder.id));
    for (const folder of folders) {
      const parentId = folder.parentId && folderIds.has(folder.parentId)
        ? folder.parentId
        : null;
      const normalizedFolder = parentId === folder.parentId ? folder : { ...folder, parentId };
      if (parentId === null) rootFolderItems.push(normalizedFolder);
      else (childFolders[parentId] ||= []).push(normalizedFolder);
    }
    const sortFolders = (siblings: FolderItem[]) => siblings.sort((a, b) =>
      (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
      || a.name.localeCompare(b.name)
      || a.id.localeCompare(b.id)
    );
    sortFolders(rootFolderItems);
    Object.values(childFolders).forEach(sortFolders);

    const map: Record<string, NoteItem[]> = {};
    const root: NoteItem[] = [];
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (!n.folderId) {
        root.push(n);
      } else {
        if (!map[n.folderId]) map[n.folderId] = [];
        map[n.folderId].push(n);
      }
    }
    const sortNotes = (siblings: NoteItem[]) => siblings.sort((a, b) => {
      if (searchQuery.trim()) return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
      return (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
        || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
        || a.id.localeCompare(b.id);
    });
    sortNotes(root);
    Object.values(map).forEach(sortNotes);
    return { foldersByParent: childFolders, rootFolders: rootFolderItems, notesByFolder: map, rootNotes: root };
  }, [folders, notes, searchQuery]);

  const getNotesInFolder = useCallback(
    (folderId: string) => notesByFolder[folderId] || [],
    [notesByFolder]
  );

  const getFolderChildren = useCallback(
    (folderId: string) => foldersByParent[folderId] || [],
    [foldersByParent],
  );

  const findDropPlacement = useCallback((
    source: SidebarDragItem,
    target: Element | null,
    clientY: number,
  ): SidebarDropPlacement | null => {
    const targetElement = target?.closest<HTMLElement>("[data-sidebar-drop], [data-sidebar-kind]") ?? null;
    if (!targetElement) return null;
    if (targetElement.dataset.sidebarDrop === "root") {
      return { kind: source.kind, parentId: null, beforeId: null, afterId: null, targetKey: "root" };
    }

    const targetKind = targetElement.dataset.sidebarKind;
    const targetId = targetElement.dataset.sidebarId;
    if (!targetKind || !targetId) return null;

    if (targetKind === "folder") {
      if (source.kind === "note") {
        return { kind: "note", parentId: targetId, beforeId: null, afterId: null, targetKey: `folder:${targetId}` };
      }
      if (source.id === targetId) return null;

      const rect = targetElement.getBoundingClientRect();
      const relativeY = rect.height ? (clientY - rect.top) / rect.height : 0.5;
      if (targetElement.dataset.sidebarDrop === "folder-content" || (relativeY >= 0.28 && relativeY <= 0.72)) {
        if (isDescendantFolder(source.id, targetId)) return null;
        return { kind: "folder", parentId: targetId, beforeId: null, afterId: null, targetKey: `folder:${targetId}` };
      }

      const parentId = targetElement.dataset.sidebarParentId || null;
      const siblings = parentId ? getFolderChildren(parentId) : rootFolders;
      const after = relativeY > 0.72;
      const beforeId = after ? null : beforeIdForMove(siblings, source.id, targetId, false);
      const afterId = after ? afterIdForMove(siblings, source.id, targetId) : null;
      return { kind: "folder", parentId, beforeId, afterId, targetKey: `folder:${targetId}` };
    }

    if (targetKind === "note" && source.kind === "note" && source.id !== targetId) {
      const parentId = targetElement.dataset.sidebarParentId || null;
      const siblings = parentId ? getNotesInFolder(parentId) : rootNotes;
      const rect = targetElement.getBoundingClientRect();
      const after = clientY > rect.top + rect.height / 2;
      const beforeId = after ? null : beforeIdForMove(siblings, source.id, targetId, false);
      const afterId = after ? afterIdForMove(siblings, source.id, targetId) : null;
      return { kind: "note", parentId, beforeId, afterId, targetKey: `note:${targetId}` };
    }

    return null;
  }, [getFolderChildren, getNotesInFolder, isDescendantFolder, rootFolders, rootNotes]);

  const executeDrop = useCallback(async (source: SidebarDragItem, placement: SidebarDropPlacement | null) => {
    setDragOverTarget(null);
    if (!placement || (source.kind === placement.kind && placement.beforeId === source.id)) return;
    if (source.kind === "folder" && isDescendantFolder(source.id, placement.parentId)) return;
    if (source.kind === "note" && placement.kind === "note") {
      await onMoveNote?.(source.id, placement.parentId, placement.beforeId, placement.afterId);
    } else if (source.kind === "folder" && placement.kind === "folder") {
      await onMoveFolder?.(source.id, placement.parentId, placement.beforeId, placement.afterId);
    }
  }, [isDescendantFolder, onMoveFolder, onMoveNote]);

  const handleNativeDragStart = (e: React.DragEvent, item: SidebarDragItem) => {
    dragSourceRef.current = item;
    e.dataTransfer.setData("application/json", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleNativeDragOver = (e: React.DragEvent) => {
    const source = dragSourceRef.current;
    if (!source) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    const placement = findDropPlacement(source, e.target as HTMLElement, e.clientY);
    setDragOverTarget(placement?.targetKey ?? null);
  };

  const handleNativeDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    let source = dragSourceRef.current;
    if (!source) {
      try { source = JSON.parse(e.dataTransfer.getData("application/json")) as SidebarDragItem; } catch { source = null; }
    }
    const placement = source ? findDropPlacement(source, e.target as HTMLElement, e.clientY) : null;
    dragSourceRef.current = null;
    if (source) await executeDrop(source, placement);
    else setDragOverTarget(null);
  };

  const handleTouchDragStart = (e: React.PointerEvent<HTMLButtonElement>, item: SidebarDragItem) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const button = e.currentTarget;
    const drag = {
      item,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
      timer: null as number | null,
    };
    touchDragRef.current = drag;
    drag.timer = window.setTimeout(() => {
      const current = touchDragRef.current;
      if (!current || current.pointerId !== e.pointerId) return;
      current.active = true;
      try { button.setPointerCapture(e.pointerId); } catch { /* Pointer may already be released. */ }
      setTouchDraggedItem(item);
      autoScrollTimerRef.current = window.setInterval(() => {
        const latest = touchDragRef.current;
        const scroll = scrollContainerRef.current;
        if (!latest?.active || !scroll) return;
        const bounds = scroll.getBoundingClientRect();
        if (latest.y < bounds.top + 42) scroll.scrollTop -= 12;
        else if (latest.y > bounds.bottom - 42) scroll.scrollTop += 12;
        const placement = findDropPlacement(latest.item, document.elementFromPoint(latest.x, latest.y), latest.y);
        touchPlacementRef.current = placement;
        setDragOverTarget(placement?.targetKey ?? null);
      }, 45);
    }, 400);
  };

  const handleTouchDragMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = touchDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (!drag.active) {
      if (Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > 12) {
        if (drag.timer !== null) window.clearTimeout(drag.timer);
        touchDragRef.current = null;
      }
      return;
    }
    const placement = findDropPlacement(drag.item, document.elementFromPoint(e.clientX, e.clientY), e.clientY);
    touchPlacementRef.current = placement;
    setDragOverTarget(placement?.targetKey ?? null);
  };

  const finishTouchDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = touchDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (drag.timer !== null) window.clearTimeout(drag.timer);
    if (autoScrollTimerRef.current !== null) window.clearInterval(autoScrollTimerRef.current);
    const placement = touchPlacementRef.current;
    touchDragRef.current = null;
    touchPlacementRef.current = null;
    setTouchDraggedItem(null);
    setDragOverTarget(null);
    if (drag.active) void executeDrop(drag.item, placement);
  };

  const cancelTouchDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = touchDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (drag.timer !== null) window.clearTimeout(drag.timer);
    if (autoScrollTimerRef.current !== null) window.clearInterval(autoScrollTimerRef.current);
    touchDragRef.current = null;
    touchPlacementRef.current = null;
    setTouchDraggedItem(null);
    setDragOverTarget(null);
  };

  const handleNotePointerDown = (e: React.PointerEvent<HTMLDivElement>, noteId: string) => {
    if (e.pointerType !== "touch" || (e.target as HTMLElement).closest("button, input")) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* The browser may have already ended the pointer. */ }
    swipeStartRef.current = { id: noteId, pointerId: e.pointerId, x: e.clientX, y: e.clientY };
  };

  const handleNotePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.pointerId !== e.pointerId) return;
    const deltaX = e.clientX - start.x;
    const deltaY = e.clientY - start.y;
    if (Math.abs(deltaX) >= 56 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      suppressNoteClickRef.current = true;
      setRevealedDeleteNoteId(deltaX < 0 ? start.id : null);
    }
  };

  const renderNote = (note: NoteItem, nested: boolean) => {
    const isRevealed = revealedDeleteNoteId === note.id;
    const parentId = note.folderId || "";
    const handleNoteClick = () => {
      if (suppressNoteClickRef.current) {
        suppressNoteClickRef.current = false;
        return;
      }
      if (isRevealed) {
        setRevealedDeleteNoteId(null);
        return;
      }
      setRevealedDeleteNoteId(null);
      onSelectNote(note.id);
    };
    return (
      <div key={note.id} data-sidebar-kind="note" data-sidebar-id={note.id} data-sidebar-parent-id={parentId} data-sidebar-note className="relative overflow-hidden rounded-lg bg-rose-950/70">
        <button
          type="button"
          disabled={!isRevealed}
          tabIndex={isRevealed ? 0 : -1}
          aria-hidden={!isRevealed}
          aria-label={lang === "th" ? `ลบโน้ต ${note.title}` : `Delete note ${note.title}`}
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(t.deleteNoteConfirm(note.title))) void onDeleteNote(note.id);
            setRevealedDeleteNoteId(null);
          }}
          className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-rose-100 hover:bg-rose-800/70"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <div
          draggable={!isTouchDevice && renamingId !== note.id}
          onDragStart={(e) => handleNativeDragStart(e, { kind: "note", id: note.id })}
          onDragEnd={() => { dragSourceRef.current = null; setDragOverTarget(null); }}
          onDragOver={handleNativeDragOver}
          onDrop={handleNativeDrop}
          onClick={handleNoteClick}
          onPointerDown={(e) => handleNotePointerDown(e, note.id)}
          onPointerUp={handleNotePointerUp}
          onPointerCancel={() => { swipeStartRef.current = null; }}
          onMouseEnter={() => onPrefetchNote?.(note.id)}
          onFocus={() => onPrefetchNote?.(note.id)}
          className={`group relative flex min-h-10 items-center justify-between border px-2 ${nested ? "py-1.5" : "px-2.5 py-1.5"} rounded-lg transition-transform duration-150 outline-none ${touchDraggedItem?.id === note.id ? "opacity-50" : ""} ${dragOverTarget === `note:${note.id}` ? "border-indigo-500 bg-indigo-600/20" : "border-transparent"} ${activeNoteId === note.id ? "bg-neutral-800/90 text-neutral-100 font-medium shadow-sm" : "bg-neutral-900 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/70"}`}
          style={{ transform: isRevealed ? "translateX(-56px)" : undefined, touchAction: "pan-y" }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
            <FileText className={`shrink-0 ${nested ? "h-3 w-3" : "h-3.5 w-3.5"}`} />
            {renamingId === note.id && renamingType === "note" ? (
              <div className="flex min-w-0 flex-1 items-center" onClick={(e) => e.stopPropagation()}>
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleFinishRename();
                    if (e.key === "Escape") handleCancelRename();
                  }}
                  onBlur={() => void handleFinishRename()}
                  className="w-full rounded border border-indigo-400 bg-neutral-900 px-1.5 py-0.5 text-xs text-neutral-100 outline-none"
                />
              </div>
            ) : (
              <span title={t.renameNoteHint} onDoubleClick={(e) => handleStartRename(note.id, "note", note.title, e)} className="flex min-w-0 flex-1 select-none flex-col">
                <span className="truncate">{note.title}</span>
                {searchQuery.trim() && note.excerpt && <span className="truncate text-[10px] font-normal text-neutral-500">{note.excerpt}</span>}
              </span>
            )}
          </div>
          <div className="ml-1 flex shrink-0 items-center">
            <button
              type="button"
              data-drag-handle
              aria-label={lang === "th" ? `ลากเพื่อจัดตำแหน่ง ${note.title}` : `Reorder ${note.title}`}
              onPointerDown={(e) => handleTouchDragStart(e, { kind: "note", id: note.id })}
              onPointerMove={handleTouchDragMove}
              onPointerUp={finishTouchDrag}
              onPointerCancel={cancelTouchDrag}
              onClick={(e) => e.stopPropagation()}
              className={`flex h-9 w-8 touch-none items-center justify-center rounded text-neutral-500 hover:bg-neutral-700 hover:text-neutral-200 ${isTouchDevice ? "" : "lg:hidden"}`}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={lang === "th" ? `ลบโน้ต ${note.title}` : `Delete note ${note.title}`}
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(t.deleteNoteConfirm(note.title))) void onDeleteNote(note.id);
              }}
              className="hidden p-1 text-neutral-500 hover:text-rose-300 lg:flex lg:opacity-0 lg:group-hover:opacity-100"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderFolder = (folder: FolderItem, depth: number): React.ReactNode => {
    const isOpen = searchQuery.trim().length > 0 || !!openFolders[folder.id];
    const folderNotes = getNotesInFolder(folder.id);
    const childFolders = getFolderChildren(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const isDropTarget = dragOverTarget === `folder:${folder.id}`;
    const childCount = folderNotes.length + childFolders.length;

    return (
      <div key={folder.id} className="space-y-0.5">
        <div
          data-sidebar-kind="folder"
          data-sidebar-id={folder.id}
          data-sidebar-parent-id={folder.parentId || ""}
          draggable={!isTouchDevice}
          onDragStart={(e) => handleNativeDragStart(e, { kind: "folder", id: folder.id })}
          onDragEnd={() => { dragSourceRef.current = null; setDragOverTarget(null); }}
          onDragOver={handleNativeDragOver}
          onDrop={handleNativeDrop}
          onClick={() => {
            onSelectFolder(folder.id);
            setOpenFolders((previous) => ({ ...previous, [folder.id]: !previous[folder.id] }));
          }}
          className={`group flex min-h-10 items-center justify-between rounded-lg border px-2 py-1.5 outline-none transition-colors ${isDropTarget ? "border-indigo-500 bg-indigo-600/25 text-indigo-200 ring-1 ring-indigo-500/30" : isSelected ? "border-indigo-500/30 bg-indigo-950/40 font-medium text-indigo-300" : "border-transparent text-neutral-300 hover:bg-neutral-800/60"}`}
          style={{ paddingLeft: `${8 + Math.min(depth, 6) * 12}px` }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <button
              type="button"
              aria-label={isOpen ? (lang === "th" ? "ยุบโฟลเดอร์" : "Collapse folder") : (lang === "th" ? "ขยายโฟลเดอร์" : "Expand folder")}
              aria-expanded={isOpen}
              onClick={(e) => toggleFolder(folder.id, e)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-neutral-700/60"
            >
              {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-neutral-400" /> : <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />}
            </button>
            <FolderIcon className={`h-3.5 w-3.5 shrink-0 ${isDropTarget ? "text-indigo-300" : "text-amber-400"}`} />
            {renamingId === folder.id && renamingType === "folder" ? (
              <div className="flex min-w-0 flex-1 items-center" onClick={(e) => e.stopPropagation()}>
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleFinishRename();
                    if (e.key === "Escape") handleCancelRename();
                  }}
                  onBlur={() => void handleFinishRename()}
                  className="w-full rounded border border-indigo-500 bg-neutral-900 px-1.5 py-0.5 text-xs font-medium text-neutral-100 outline-none"
                />
              </div>
            ) : (
              <span title={t.renameNoteHint} onDoubleClick={(e) => handleStartRename(folder.id, "folder", folder.name, e)} className="min-w-0 flex-1 truncate select-none">
                {folder.name}
              </span>
            )}
          </div>
          <div className="ml-1 flex shrink-0 items-center gap-1">
            {!hasMoreNotes && <span className="mr-1 text-[10px] text-neutral-500">{folderNotes.length}</span>}
            <button
              type="button"
              data-drag-handle
              aria-label={lang === "th" ? `ลากเพื่อจัดตำแหน่งโฟลเดอร์ ${folder.name}` : `Reorder folder ${folder.name}`}
              onPointerDown={(e) => handleTouchDragStart(e, { kind: "folder", id: folder.id })}
              onPointerMove={handleTouchDragMove}
              onPointerUp={finishTouchDrag}
              onPointerCancel={cancelTouchDrag}
              onClick={(e) => e.stopPropagation()}
              className={`flex h-9 w-8 touch-none items-center justify-center rounded text-neutral-500 hover:bg-neutral-700 hover:text-neutral-200 ${isTouchDevice ? "" : "lg:hidden"}`}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={lang === "th" ? `ลบโฟลเดอร์ ${folder.name}` : `Delete folder ${folder.name}`}
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(t.deleteFolderConfirm(folder.name))) void onDeleteFolder(folder.id);
              }}
              className="rounded p-1 text-neutral-500 hover:text-rose-400 lg:opacity-0 lg:group-hover:opacity-100"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="ml-3 space-y-0.5 border-l border-neutral-800/80 pl-3">
            {childFolders.map((child) => renderFolder(child, depth + 1))}
            {folderNotes.map((note) => renderNote(note, true))}
            {childCount === 0 && !hasMoreNotes && (
              <div
                data-sidebar-drop="folder-content"
                data-sidebar-kind="folder"
                data-sidebar-id={folder.id}
                data-sidebar-parent-id={folder.parentId || ""}
                onDragOver={handleNativeDragOver}
                onDrop={handleNativeDrop}
                className={`min-h-10 rounded-md border border-dashed px-2 py-2 text-[11px] ${isDropTarget ? "border-indigo-500 text-indigo-300" : "border-neutral-800/70 text-neutral-500"}`}
              >
                {isDropTarget ? t.emptyFolderHover : t.emptyFolder}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden animate-in fade-in duration-200"
        />
      )}

      <aside
        className={`w-72 bg-neutral-900/95 border-r border-neutral-800/80 flex flex-col h-full select-none shrink-0 shadow-2xl backdrop-blur-md transition-transform duration-300 ease-in-out
          fixed inset-y-0 left-0 z-50 lg:relative lg:z-20 lg:translate-x-0
          ${isOpenMobile ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", paddingLeft: "env(safe-area-inset-left)" }}
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
                title={`${t.settingsTitle} (${formatComboDisplay(shortcuts.settings)})`}
                className="p-1.5 text-neutral-400 hover:text-indigo-400 hover:bg-neutral-800/80 rounded-lg transition-colors cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {/* Mobile Close Drawer Button */}
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="lg:hidden p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80 rounded-lg transition-colors cursor-pointer ml-1"
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
              className="w-full bg-neutral-950/60 border border-neutral-800 rounded-lg pl-7 pr-12 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
            <kbd className="hidden sm:inline-block absolute right-2 top-2 px-1 py-0.2 bg-neutral-900/80 border border-neutral-700/60 rounded text-[10px] text-neutral-400 font-mono leading-none pointer-events-none">
              {formatComboDisplay(shortcuts.search)}
            </kbd>
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
        ref={scrollContainerRef}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2.5 text-xs"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        onPointerDown={(event) => {
          if (!(event.target as HTMLElement).closest("[data-sidebar-note]")) setRevealedDeleteNoteId(null);
        }}
      >
        <div
          data-sidebar-drop="root"
          onDragOver={handleNativeDragOver}
          onDrop={handleNativeDrop}
          onClick={() => onSelectFolder(null)}
          className={`flex min-h-10 items-center justify-between rounded-lg border px-2.5 py-1.5 outline-none transition-colors ${dragOverTarget === "root" ? "border-indigo-500 bg-indigo-600/20 text-indigo-300" : selectedFolderId === null && !activeNoteId ? "border-neutral-700/60 bg-neutral-800 font-medium text-neutral-100" : "border-transparent text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200"}`}
        >
          <span className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-indigo-400" />{t.notesCount(notes.length)}</span>
          {dragOverTarget === "root" && <span className="text-[10px] font-medium text-indigo-300">{t.dropToUnfile}</span>}
        </div>

        {rootFolders.map((folder) => renderFolder(folder, 0))}

        {rootNotes.length > 0 && (
          <div className="space-y-0.5 pt-2">
            <div className="mb-1 flex items-center justify-between px-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              <span>{t.rootFilesHeader}</span>
              {!isTouchDevice && <span className="text-[9px] font-normal text-neutral-600">{t.canDragHint}</span>}
            </div>
            {rootNotes.map((note) => renderNote(note, false))}
          </div>
        )}

        {hasMoreNotes && (
          <button
            type="button"
            onClick={onLoadMoreNotes}
            disabled={isLoadingMoreNotes}
            className="w-full mt-2 rounded-lg border border-neutral-800 bg-neutral-950/50 px-3 py-2 text-[11px] text-neutral-400 hover:border-indigo-500/50 hover:text-indigo-300 disabled:cursor-wait disabled:opacity-60 transition-colors"
          >
            {isLoadingMoreNotes ? t.loadingMoreNotes : t.loadMoreNotes}
          </button>
        )}
      </div>

      <PwaInstallControl lang={lang} />

      {/* Sidebar Footer with Language & Logout */}
      <div className="p-3 bg-neutral-950/40 flex items-center justify-between">
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

const MemoizedSidebar = memo(Sidebar);
export default MemoizedSidebar;
