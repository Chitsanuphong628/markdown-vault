"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { FolderItem, NoteItem } from "@/components/Sidebar";
import MarkdownViewer from "@/components/MarkdownViewer";
import { AppLayoutSkeleton, NoteContentSkeleton } from "@/components/Skeletons";
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
  Search,
  Menu,
  Plus,
  Palette,
  Code2,
} from "lucide-react";
import VoiceDictationButton from "@/components/VoiceDictationButton";
import { parseNoteTheme, applyNoteTheme, NOTE_THEMES, NoteColorKey } from "@/lib/noteTheme";
import { Language, I18N_MAIN } from "@/lib/i18n";
import { getShortcuts, matchesShortcut, formatComboDisplay, ShortcutActionId } from "@/lib/shortcuts";
import { NoteWriteCoordinator, type NotePatch, type EditableNote } from "@/lib/noteWriting";
import type { MarkdownNoteEditorHandle } from "@/components/MarkdownNoteEditor";
import type { RichNoteEditorHandle } from "@/components/RichNoteEditor";
import { appendMarkdownBlock, getLatestNoteDraftContent, isNoteDraftDirty } from "@/lib/markdownEditing";
import { getRichEditorCompatibility, type RichEditorUnsupportedReason } from "@/lib/richEditorCompatibility";

// Dynamically load heavy components only when opened or required
const DropzoneModal = dynamic(() => import("@/components/DropzoneModal"), { ssr: false });
const SettingsModal = dynamic(() => import("@/components/SettingsModal"), { ssr: false });
const ChartWizardModal = dynamic(() => import("@/components/ChartWizardModal"), { ssr: false });
const MarkdownNoteEditor = dynamic(() => import("@/components/MarkdownNoteEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400 text-xs gap-2">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <span>Loading editor...</span>
    </div>
  ),
});
const RichNoteEditor = dynamic(() => import("@/components/RichNoteEditor"), { ssr: false });

type EditorMode = "visual" | "markdown";
const EDITOR_MODE_STORAGE_KEY = "nota_preferred_editor_mode";

function readPreferredEditorMode(): EditorMode {
  if (typeof window === "undefined") return "visual";
  try { return localStorage.getItem(EDITOR_MODE_STORAGE_KEY) === "markdown" ? "markdown" : "visual"; }
  catch { return "visual"; }
}

function unsupportedEditorMessage(reason: RichEditorUnsupportedReason, lang: Language): string {
  const labels: Record<RichEditorUnsupportedReason, { en: string; th: string }> = {
    table: { en: "tables", th: "ตาราง" },
    image: { en: "images", th: "รูปภาพ" },
    code: { en: "code and code blocks", th: "โค้ดและโค้ดบล็อก" },
    math: { en: "math", th: "สูตรคณิตศาสตร์" },
    html: { en: "HTML", th: "HTML" },
    advanced: { en: "advanced Markdown", th: "Markdown ขั้นสูง" },
  };
  return lang === "th"
    ? `โน้ตนี้มี${labels[reason].th} จึงเปิดแก้ด้วย Markdown เพื่อรักษาเนื้อหาไว้ครบ`
    : `This note contains ${labels[reason].en}, so it opens in Markdown to preserve its content.`;
}

export default function AppHome() {
  const router = useRouter();
  const [lang, setLangState] = useState<Language>("en");

  // Load language from localStorage on mount
  useEffect(() => {
    const savedLang = localStorage.getItem("nota_lang") as Language;
    if (savedLang === "en" || savedLang === "th") {
      setLangState(savedLang);
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem("nota_lang", newLang);
    } catch (e) {
      console.error(e);
    }
  };

  const t = I18N_MAIN[lang];
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [notesPage, setNotesPage] = useState(0);
  const [hasMoreNotes, setHasMoreNotes] = useState(false);
  const [isLoadingMoreNotes, setIsLoadingMoreNotes] = useState(false);
  const notesRequestIdRef = useRef(0);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const activeNoteIdRef = useRef<string | null>(null);
  const editorInstanceRef = useRef<MarkdownNoteEditorHandle | null>(null);
  const richEditorInstanceRef = useRef<RichNoteEditorHandle | null>(null);
  const draftTouchedRef = useRef(false);
  const draftVersionRef = useRef(0);
  const markDraftTouched = () => {
    draftTouchedRef.current = true;
    draftVersionRef.current += 1;
  };
  const [isLoadingNote, setIsLoadingNote] = useState(false);
  const selectActiveNote = (id: string | null) => {
    activeNoteIdRef.current = id;
    draftTouchedRef.current = false;
    setActiveNoteId(id);
    if (id && !noteWrites.getNote(id)) {
      setIsLoadingNote(true);
    }
  };
  const [activeNote, setActiveNote] = useState<any | null>(null);
  const [noteWrites] = useState(() => new NoteWriteCoordinator(async (id, patch, revision) => {
    const response = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, revision }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.note) throw new Error(data.error || `Failed to update note (${response.status})`);
    return data.note as EditableNote;
  }, (saved) => {
    setNotes((previous) => previous.map((note) => note.id === saved.id ? {
      ...note, title: saved.title, folderId: saved.folderId, revision: saved.revision,
      color: parseNoteTheme(saved.content).color,
    } : note));
    setActiveNote((previous: EditableNote | null) => previous?.id === saved.id ? saved : previous);
    setOperationError((previous) => previous?.noteId === saved.id ? null : previous);
  }, (id, error) => setOperationError({ noteId: id, message: error.message })));
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Editor mode state
  const [isEditing, setIsEditing] = useState(false);
  const [activeEditorMode, setActiveEditorMode] = useState<EditorMode>("visual");
  const [richEditorDirty, setRichEditorDirty] = useState(false);
  const [focusEditorOnOpen, setFocusEditorOnOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [operationError, setOperationError] = useState<{ noteId: string | null; message: string } | null>(null);
  const editorCompatibility = useMemo(
    () => getRichEditorCompatibility(isEditing ? editContent : activeNote?.content || ""),
    [isEditing, editContent, activeNote?.content],
  );
  const isDraftDirty = Boolean(isEditing && activeNote && (
    richEditorDirty || isNoteDraftDirty(activeNote, { title: editTitle, content: editContent })
  ));

  const rememberEditorMode = (mode: EditorMode) => {
    try { localStorage.setItem(EDITOR_MODE_STORAGE_KEY, mode); } catch { /* Preference remains active for this session. */ }
  };

  const getLatestDraftContent = () => getLatestNoteDraftContent(
    activeEditorMode,
    editContent,
    richEditorInstanceRef.current,
  );

  const confirmDiscardDraft = () => {
    const latestContent = isEditing ? getLatestDraftContent() : editContent;
    const dirty = Boolean(isEditing && activeNote && isNoteDraftDirty(activeNote, { title: editTitle, content: latestContent }));
    return !dirty || window.confirm(
      lang === "th" ? "มีการแก้ไขที่ยังไม่บันทึก ต้องการทิ้งการแก้ไขหรือไม่?" : "Discard unsaved changes?",
    );
  };

  const beginEditing = (content = activeNote?.content || "") => {
    const compatibility = getRichEditorCompatibility(content);
    setActiveEditorMode(compatibility.supported ? readPreferredEditorMode() : "markdown");
    setRichEditorDirty(false);
    setFocusEditorOnOpen(false);
    setIsEditing(true);
  };

  const handleEditorModeChange = (mode: EditorMode) => {
    if (mode === "visual" && !getRichEditorCompatibility(editContent).supported) return;
    const latestContent = getLatestDraftContent();
    setEditContent(latestContent);
    setActiveEditorMode(mode);
    rememberEditorMode(mode);
    setRichEditorDirty(false);
  };

  const cancelEditing = () => {
    if (!confirmDiscardDraft()) return;
    draftTouchedRef.current = false;
    setRichEditorDirty(false);
    setFocusEditorOnOpen(false);
    if (activeNote) {
      setEditTitle(activeNote.title);
      setEditContent(activeNote.content);
    }
    setIsEditing(false);
  };

  useEffect(() => {
    if (!isDraftDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = true;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDraftDirty]);

  // Share state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  // Upload Modal
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Mobile Drawer State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Chart Wizard & Color Picker state
  const [isChartWizardOpen, setIsChartWizardOpen] = useState(false);
  const [isInsertMenuOpen, setIsInsertMenuOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  // Keyboard shortcuts state
  const [shortcuts, setShortcuts] = useState(() => getShortcuts());

  useEffect(() => {
    const handleSync = () => setShortcuts(getShortcuts());
    window.addEventListener("nota:shortcuts-changed", handleSync);
    return () => window.removeEventListener("nota:shortcuts-changed", handleSync);
  }, []);

  // Check auth on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data) => {
        setUser(data.user);
        Promise.all([loadFolders(), loadNotes()]);
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

  const rememberNoteRevisions = (incomingNotes: Array<{ id: string; revision?: number }> | undefined) => {
    incomingNotes?.forEach((note) => {
      if (Number.isInteger(note.revision)) noteWrites.observeRevision(note.id, note.revision as number);
    });
  };

  // Load notes (with search)
  const loadNotes = async (q = searchQuery, page = 0, append = false) => {
    const requestId = notesRequestIdRef.current + 1;
    notesRequestIdRef.current = requestId;
    if (append) setIsLoadingMoreNotes(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (q) params.set("q", q);
      const url = `/api/notes?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load notes (${res.status})`);
      const data = await res.json();
      if (requestId !== notesRequestIdRef.current) return;
      if (Array.isArray(data.notes)) {
        rememberNoteRevisions(data.notes);
        setNotes((previous) => (append ? [...previous, ...data.notes] : data.notes));
        setNotesPage(Number.isInteger(data.page) ? data.page : page);
        setHasMoreNotes(Boolean(data.hasMore));

        // Idle-prefetch top 3 recent notes for zero-delay initial clicks
        const topNotes = data.notes.slice(0, 3);
        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
          window.requestIdleCallback(() => {
            topNotes.forEach((n: { id: string }) => prefetchNote(n.id));
          });
        } else {
          setTimeout(() => {
            topNotes.forEach((n: { id: string }) => prefetchNote(n.id));
          }, 150);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (append && requestId === notesRequestIdRef.current) setIsLoadingMoreNotes(false);
    }
  };

  // Prefetch note details to memory cache (e.g. on sidebar hover or idle)
  const prefetchedIdsRef = useRef<Set<string>>(new Set());
  const prefetchNote = useCallback(
    (id: string) => {
      if (!id || noteWrites.hasFreshNote(id) || prefetchedIdsRef.current.has(id)) return;
      prefetchedIdsRef.current.add(id);
      fetch(`/api/notes/${id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.note) {
            noteWrites.observeNote(data.note);
          }
        })
        .catch(() => {
          prefetchedIdsRef.current.delete(id);
        });
    },
    [noteWrites]
  );

  const patchNote = async (id: string, patch: NotePatch | ((current: EditableNote) => NotePatch)) => {
    return noteWrites.write(id, patch);
  };

  const isInitialSearchMountRef = useRef(true);

  useEffect(() => {
    if (isInitialSearchMountRef.current) {
      isInitialSearchMountRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      loadNotes(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch single active note details (Instant SWR cache + background revalidation)
  useEffect(() => {
    setIsEditingTitle(false);
    if (!activeNoteId) {
      setActiveNote(null);
      setIsLoadingNote(false);
      return;
    }

    // 1. Instant Cache Hit (0ms transition)
    const cached = noteWrites.getNote(activeNoteId);
    if (cached) {
      setActiveNote(cached);
      if (!draftTouchedRef.current) {
        setEditTitle(cached.title);
        setEditContent(cached.content);
      }
      setIsShared(Boolean((cached as any).isShared));
      setIsLoadingNote(false);
    } else {
      setIsLoadingNote(true);
    }

    // 2. Background Revalidation (SWR)
    let cancelled = false;
    fetch(`/api/notes/${activeNoteId}`)
      .then((res) => { if (!res.ok) throw new Error("Failed to load note"); return res.json(); })
      .then((data) => {
        if (!cancelled && data.note && noteWrites.observeNote(data.note)) {
          setActiveNote(data.note);
          if (!draftTouchedRef.current) {
            setEditTitle(data.note.title);
            setEditContent(data.note.content);
          }
          setIsShared(Boolean(data.note.isShared));
          setIsLoadingNote(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load note", err);
        if (!cancelled) setIsLoadingNote(false);
      });
    return () => { cancelled = true; };
  }, [activeNoteId, noteWrites]);

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
        setActiveNote((prev: any) => ({ ...prev, isShared: newSharedStatus, shareToken: data.note.shareToken }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyLink = () => {
    if (typeof window === "undefined" || !activeNoteId) return;
    if (!activeNote?.shareToken) return;
    const shareUrl = `${window.location.origin}/share/${activeNote.shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2000);
  };

  // Handle Create Note
  const handleCreateNote = async (folderId?: string | null) => {
    if (!confirmDiscardDraft()) return;
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "โน้ตใหม่ไม่มีชื่อ",
          content: "",
          folderId: folderId || null,
        }),
      });
      const data = await res.json();
      if (data.note) {
        noteWrites.observeNote(data.note);
        await loadNotes();
        setEditTitle(data.note.title);
        setEditContent(data.note.content);
        selectActiveNote(data.note.id);
        setActiveEditorMode(readPreferredEditorMode());
        setRichEditorDirty(false);
        setFocusEditorOnOpen(true);
        setIsEditing(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Save Note
  const handleSaveNote = async () => {
    if (!activeNoteId || isSaving) return;
    const targetId = activeNoteId;
    const latestContent = getLatestDraftContent();
    const savedVersion = draftVersionRef.current;
    setIsSaving(true);
    try {
      await patchNote(targetId, {
        title: editTitle,
        content: latestContent,
      });
      if (activeNoteIdRef.current === targetId && draftVersionRef.current === savedVersion) {
        draftTouchedRef.current = false;
        setRichEditorDirty(false);
        setFocusEditorOnOpen(false);
        setIsEditing(false);
      }
      await loadNotes();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Global Keyboard shortcuts with custom mappings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.getAttribute("contenteditable") === "true");

      // 1. Search Vault
      if (matchesShortcut(e, shortcuts.search)) {
        e.preventDefault();
        const searchInput = document.querySelector(
          'input[type="text"][placeholder*="Search"], input[type="text"][placeholder*="ค้นหา"]'
        ) as HTMLInputElement;
        if (searchInput) searchInput.focus();
        return;
      }

      // 2. Open Settings
      if (matchesShortcut(e, shortcuts.settings)) {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
        return;
      }

      // 3. New Note
      if (matchesShortcut(e, shortcuts.newNote) && !isInputFocused) {
        e.preventDefault();
        handleCreateNote(selectedFolderId);
        return;
      }

      // 4. Toggle Edit/View
      if (matchesShortcut(e, shortcuts.toggleEdit) && activeNote && !isInputFocused) {
        e.preventDefault();
        if (isEditing) cancelEditing();
        else beginEditing();
        return;
      }

      // 5. Save Note
      if (matchesShortcut(e, shortcuts.saveNote) && isEditing) {
        e.preventDefault();
        handleSaveNote();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, selectedFolderId, activeNote, isEditing, editTitle, editContent]);

  // Handle Delete Note
  const handleDeleteNote = async (id: string) => {
    if (id === activeNoteId && !confirmDiscardDraft()) return;
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "ลบโน้ตไม่สำเร็จ");
      }
      noteWrites.evictNote(id);
      prefetchedIdsRef.current.delete(id);
      if (activeNoteId === id) {
        selectActiveNote(null);
        setActiveNote(null);
      }
      await loadNotes();
    } catch (err: any) {
      console.error(err);
      setOperationError({ noteId: id, message: err.message || "ลบโน้ตไม่สำเร็จ" });
    }
  };

  // Handle note theme color change
  const handleSelectTheme = async (newColor: NoteColorKey) => {
    if (!activeNoteId || !activeNote) return;
    setIsColorPickerOpen(false);
    if (isEditing) {
      markDraftTouched();
      const latestContent = getLatestDraftContent();
      setEditContent(applyNoteTheme(latestContent, newColor));
      return;
    }
    try {
      const targetId = activeNoteId;
      const saved = await patchNote(targetId, (current) => ({ content: applyNoteTheme(current.content, newColor) }));
      if (activeNoteIdRef.current === targetId) setEditContent(saved.content);
    } catch (err) {
      console.error("Failed to update note theme", err);
    }
  };

  // Handle voice transcript insertion
  const handleVoiceTranscript = async (text: string) => {
    if (!activeNoteId || !activeNote) return;
    if (isEditing) {
      markDraftTouched();
      if (activeEditorMode === "visual" && richEditorInstanceRef.current) {
        richEditorInstanceRef.current.insertText(text);
      } else {
        setEditContent((prev) => (prev ? `${prev}\n${text}` : text));
      }
    } else {
      try {
        const targetId = activeNoteId;
        const saved = await patchNote(targetId, (current) => ({ content: current.content ? `${current.content}\n\n${text}` : text }));
        if (activeNoteIdRef.current === targetId) setEditContent(saved.content);
      } catch (err) {
        console.error("Failed to append voice transcript", err);
      }
    }
  };

  // Handle chart insertion from wizard
  const handleInsertChart = async (markdown: string) => {
    if (!activeNoteId || !activeNote) return;
    setIsInsertMenuOpen(false);
    if (isEditing) {
      markDraftTouched();
      if (activeEditorMode === "visual") {
        const latestContent = getLatestDraftContent();
        setEditContent(appendMarkdownBlock(latestContent, markdown));
        setRichEditorDirty(false);
        setActiveEditorMode("markdown");
      } else if (editorInstanceRef.current?.insertMarkdown) {
        editorInstanceRef.current.insertMarkdown(markdown);
      } else {
        setEditContent((prev) => appendMarkdownBlock(prev, markdown));
      }
    } else {
      try {
        const targetId = activeNoteId;
        const saved = await patchNote(targetId, (current) => ({ content: appendMarkdownBlock(current.content, markdown) }));
        if (activeNoteIdRef.current === targetId) setEditContent(saved.content);
      } catch (err) {
        console.error("Failed to insert chart", err);
      }
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
      const response = await fetch(`/api/folders/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Could not delete folder (${response.status})`);
      }
      setOperationError((previous) => previous?.noteId === null ? null : previous);
      if (selectedFolderId === id) setSelectedFolderId(null);
      loadFolders();
      loadNotes();
    } catch (err) {
      console.error(err);
      setOperationError({ noteId: null, message: err instanceof Error ? err.message : "ลบโฟลเดอร์ไม่สำเร็จ" });
    }
  };

  // Handle Rename Note
  const handleRenameNote = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      await patchNote(id, { title: newTitle.trim() });
      if (activeNoteIdRef.current === id) setEditTitle(newTitle.trim());
      await loadNotes();
    } catch (err) {
      console.error("Failed to rename note:", err);
    }
  };

  const handleRenameActiveNote = async (newTitle: string) => {
    setIsEditingTitle(false);
    if (!activeNote) return;
    const trimmed = newTitle.trim();
    if (!trimmed || trimmed === activeNote.title) {
      setEditTitle(activeNote.title);
      return;
    }
    await handleRenameNote(activeNote.id, trimmed);
  };

  // Handle Rename Folder
  const handleRenameFolder = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    // Optimistic update
    setFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: newName.trim() } : f))
    );
    try {
      await fetch(`/api/folders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      loadFolders();
    } catch (err) {
      console.error("Failed to rename folder:", err);
      loadFolders();
    }
  };

  // Handle Move Note
  const handleMoveNote = async (noteId: string, targetFolderId: string | null) => {
    try {
      await patchNote(noteId, { folderId: targetFolderId });
      await loadNotes();
    } catch (err) {
      console.error("Failed to move note:", err);
      setOperationError({
        noteId,
        message: lang === "th" ? "ไม่สามารถย้ายโน้ตได้" : "Failed to move note",
      });
    }
  };

  // Handle Move Folder
  const handleMoveFolder = async (folderId: string, targetParentId: string | null) => {
    const originalFolders = [...folders];
    // Optimistic UI update
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, parentId: targetParentId } : f))
    );
    try {
      const res = await fetch(`/api/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: targetParentId }),
      });
      if (!res.ok) {
        throw new Error("Failed to move folder");
      }
      loadFolders();
    } catch (err) {
      console.error("Failed to move folder:", err);
      setFolders(originalFolders);
      setOperationError({
        noteId: null,
        message: lang === "th" ? "ไม่สามารถย้ายโฟลเดอร์ได้" : "Failed to move folder",
      });
      loadFolders();
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    if (!confirmDiscardDraft()) return;
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const { color: activeColorKey } = parseNoteTheme(isEditing ? editContent : activeNote?.content || "");
  const activeTheme = NOTE_THEMES[activeColorKey] || NOTE_THEMES.default;

  if (loading || !user) {
    return <AppLayoutSkeleton />;
  }

  return (
    <div className="h-screen w-screen bg-neutral-950 text-neutral-200 flex overflow-hidden font-sans antialiased">
      {operationError && (
        <div role="alert" className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-[90vw] rounded-lg border border-rose-500/40 bg-rose-950 px-4 py-3 text-sm text-rose-100 shadow-xl flex items-center gap-3">
          <span>{operationError.message}</span>
          <button type="button" onClick={() => setOperationError(null)} aria-label="Dismiss error" className="text-rose-200 hover:text-white">×</button>
        </div>
      )}
      {/* Sidebar Tree Navigation */}
      <Sidebar
        user={user}
        folders={folders}
        notes={notes}
        activeNoteId={activeNoteId}
        selectedFolderId={selectedFolderId}
        lang={lang}
        setLang={setLang}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onPrefetchNote={prefetchNote}
        onSelectNote={(id) => {
          if (id === activeNoteId) {
            setIsMobileSidebarOpen(false);
            return;
          }
          if (!confirmDiscardDraft()) return;
          selectActiveNote(id);
          setIsEditing(false);
          setRichEditorDirty(false);
          setFocusEditorOnOpen(false);
          setIsMobileSidebarOpen(false);
        }}
        onSelectFolder={(id) => {
          setSelectedFolderId(id);
        }}
        onOpenUpload={() => setIsUploadOpen(true)}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        onCreateNote={async (fId) => {
          await handleCreateNote(fId);
          setIsMobileSidebarOpen(false);
        }}
        onDeleteNote={handleDeleteNote}
        onRenameNote={handleRenameNote}
        onRenameFolder={handleRenameFolder}
        onMoveNote={handleMoveNote}
        onMoveFolder={handleMoveFolder}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        hasMoreNotes={hasMoreNotes}
        isLoadingMoreNotes={isLoadingMoreNotes}
        onLoadMoreNotes={() => loadNotes(searchQuery, notesPage + 1, true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0c0d0e] relative overflow-hidden">
        {isLoadingNote ? (
          <NoteContentSkeleton onOpenMobile={() => setIsMobileSidebarOpen(true)} />
        ) : activeNote ? (
          <>
            {/* Top Toolbar */}
            <div className="h-14 border-b border-neutral-800/80 px-3 sm:px-6 flex items-center justify-between bg-neutral-900/40 backdrop-blur-md z-10">
              <div className="flex items-center gap-2 sm:gap-3 truncate min-w-0">
                {/* Mobile Menu Hamburger Button */}
                <button
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="md:hidden p-1.5 -ml-1 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Open Sidebar"
                >
                  <Menu className="w-5 h-5" />
                </button>

                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                    activeColorKey !== "default"
                      ? activeTheme.badgeBg
                      : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="font-semibold text-sm text-neutral-100 bg-neutral-800/80 hover:bg-neutral-800 focus:bg-neutral-900 border border-neutral-700/60 focus:border-indigo-500/80 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 w-44 sm:w-64 md:w-80 transition-all truncate"
                    placeholder={t.noteTitlePlaceholder}
                    title={lang === "th" ? "แก้ไขชื่อโน้ต" : "Edit note title"}
                  />
                ) : isEditingTitle ? (
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleRenameActiveNote(editTitle);
                      } else if (e.key === "Escape") {
                        setIsEditingTitle(false);
                        setEditTitle(activeNote.title);
                      }
                    }}
                    onBlur={() => {
                      void handleRenameActiveNote(editTitle);
                    }}
                    className="font-semibold text-sm text-neutral-100 bg-neutral-900 border border-indigo-500/80 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 w-44 sm:w-64 md:w-80 shadow-lg transition-all"
                    placeholder={t.noteTitlePlaceholder}
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditTitle(activeNote.title);
                      setIsEditingTitle(true);
                      setTimeout(() => {
                        titleInputRef.current?.focus();
                        titleInputRef.current?.select();
                      }, 50);
                    }}
                    className="group flex items-center gap-1.5 font-semibold text-sm text-neutral-200 hover:text-white px-2 py-1 -mx-2 rounded-lg hover:bg-neutral-800/70 border border-transparent hover:border-neutral-700/60 transition-all cursor-pointer max-w-[200px] sm:max-w-xs md:max-w-md truncate text-left"
                    title={lang === "th" ? "คลิกเพื่อแก้ไขชื่อโน้ต" : "Click to edit title"}
                  >
                    <span className="truncate">{activeNote.title || (lang === "th" ? "โน้ตไม่มีชื่อ" : "Untitled Note")}</span>
                    <Edit3 className="w-3 h-3 text-neutral-500 group-hover:text-indigo-400 opacity-60 group-hover:opacity-100 transition-all shrink-0" />
                  </button>
                )}
                {isShared && (
                  <span className="hidden sm:flex items-center gap-1.5 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2.5 py-0.5 rounded-full font-medium">
                    <Globe className="w-3 h-3" />
                    <span>{t.publicSharedBadge}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Voice Dictation Button (Always available with ⌥Space / ⌘J) */}
                <VoiceDictationButton lang={lang} onTranscript={handleVoiceTranscript} />

                {isEditing ? (
                  <>
                    <div className="relative">
                      <button
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={isInsertMenuOpen}
                        onClick={() => setIsInsertMenuOpen(open => !open)}
                        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-neutral-800/90 hover:bg-neutral-700/80 text-neutral-300 border border-neutral-700/50 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{lang === "th" ? "แทรก" : "Insert"}</span>
                      </button>
                      {isInsertMenuOpen && (
                        <div role="menu" className="absolute right-0 top-full z-50 mt-1 min-w-48 rounded-md border border-neutral-700 bg-neutral-900 p-1 shadow-xl">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => { setIsInsertMenuOpen(false); setIsChartWizardOpen(true); }}
                            className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs text-neutral-200 hover:bg-neutral-800"
                          >
                            <Code2 className="h-4 w-4 text-neutral-400" />
                            {lang === "th" ? "แผนภาพและกราฟ" : "Chart and diagram"}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Theme Color Picker */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                        title={t.noteColor}
                        className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 bg-neutral-800/90 hover:bg-neutral-700/80 text-neutral-300 border border-neutral-700/50 rounded-lg text-xs font-medium transition-all cursor-pointer"
                      >
                        <Palette className="w-3.5 h-3.5 text-amber-400" />
                        <span className={`w-2 h-2 rounded-full ${activeTheme.dotColor}`} />
                      </button>

                      {isColorPickerOpen && (
                        <div className="absolute top-full mt-2 right-0 z-50 bg-neutral-900 border border-neutral-700/80 shadow-2xl rounded-xl p-2.5 flex items-center gap-2 animate-in fade-in zoom-in-95">
                          {(Object.keys(NOTE_THEMES) as NoteColorKey[]).map((cKey) => {
                            const themeOpt = NOTE_THEMES[cKey];
                            return (
                              <button
                                key={cKey}
                                type="button"
                                onClick={() => handleSelectTheme(cKey)}
                                title={themeOpt.label[lang] || themeOpt.label.en}
                                className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${themeOpt.dotColor} ${
                                  activeColorKey === cKey
                                    ? "ring-2 ring-white ring-offset-2 ring-offset-neutral-900"
                                    : ""
                                }`}
                              >
                                {activeColorKey === cKey && (
                                  <Check className="w-3 h-3 text-white stroke-[3]" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="w-[1px] h-4 bg-neutral-800 mx-1" />

                    {/* Cancel & Save */}
                    <button
                      onClick={cancelEditing}
                      className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                    >
                      {t.cancelEdit}
                    </button>
                    <button
                      onClick={handleSaveNote}
                      disabled={isSaving}
                      title={`${t.saveNote} (${formatComboDisplay(shortcuts.saveNote)})`}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-indigo-500/20 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSaving ? t.saving : t.saveNote}</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Theme Color Picker */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                        title={t.noteColor}
                        className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 bg-neutral-800/90 hover:bg-neutral-700/80 text-neutral-300 border border-neutral-700/50 rounded-lg text-xs font-medium transition-all cursor-pointer"
                      >
                        <Palette className="w-3.5 h-3.5 text-amber-400" />
                        <span className={`w-2 h-2 rounded-full ${activeTheme.dotColor}`} />
                      </button>

                      {isColorPickerOpen && (
                        <div className="absolute top-full mt-2 right-0 z-50 bg-neutral-900 border border-neutral-700/80 shadow-2xl rounded-xl p-2.5 flex items-center gap-2 animate-in fade-in zoom-in-95">
                          {(Object.keys(NOTE_THEMES) as NoteColorKey[]).map((cKey) => {
                            const themeOpt = NOTE_THEMES[cKey];
                            return (
                              <button
                                key={cKey}
                                type="button"
                                onClick={() => handleSelectTheme(cKey)}
                                title={themeOpt.label[lang] || themeOpt.label.en}
                                className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${themeOpt.dotColor} ${
                                  activeColorKey === cKey
                                    ? "ring-2 ring-white ring-offset-2 ring-offset-neutral-900"
                                    : ""
                                }`}
                              >
                                {activeColorKey === cKey && (
                                  <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Find in Note Button */}
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent("nota:open-find"))}
                      title={`${t.findInNote} (${formatComboDisplay(shortcuts.findInNote)})`}
                      className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-neutral-800/90 hover:bg-neutral-700/80 text-neutral-300 border border-neutral-700/50 rounded-lg text-xs font-medium transition-all cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" />
                    </button>

                    {/* Share Button */}
                    <button
                      onClick={() => setIsShareModalOpen(true)}
                      title={t.shareNote}
                      className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        isShared
                          ? "bg-emerald-600/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/25"
                          : "bg-neutral-800/90 hover:bg-neutral-700/80 text-neutral-300 border border-neutral-700/50"
                      }`}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{t.shareNote}</span>
                    </button>

                    <div className="w-[1px] h-4 bg-neutral-800 mx-1" />

                    {/* Edit Button */}
                    <button
                      onClick={() => beginEditing(activeNote.content)}
                      title={`${t.editNote} (${formatComboDisplay(shortcuts.toggleEdit)})`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800/90 hover:bg-neutral-700/80 text-neutral-200 border border-neutral-700/50 rounded-lg text-xs font-medium transition-all cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="hidden sm:inline">{t.editNote}</span>
                    </button>

                    {/* Delete Button */}
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
              <div className={`flex-1 min-h-0 flex flex-col gap-4 p-4 sm:p-8 max-w-7xl mx-auto w-full transition-colors duration-300 ${
                NOTE_THEMES[parseNoteTheme(activeNote?.content || "").color]?.editorBg || "bg-neutral-950"
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div role="group" aria-label={lang === "th" ? "โหมดแก้ไขโน้ต" : "Note editing mode"} className="inline-flex items-center rounded-md border border-neutral-800 p-0.5">
                    <button
                      type="button"
                      aria-pressed={activeEditorMode === "visual"}
                      disabled={!editorCompatibility.supported}
                      onClick={() => handleEditorModeChange("visual")}
                      className={`rounded px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${activeEditorMode === "visual" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200"}`}
                    >
                      {lang === "th" ? "เขียนง่าย" : "Visual"}
                    </button>
                    <button
                      type="button"
                      aria-pressed={activeEditorMode === "markdown"}
                      onClick={() => handleEditorModeChange("markdown")}
                      className={`rounded px-3 py-1.5 text-xs transition-colors ${activeEditorMode === "markdown" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200"}`}
                    >
                      Markdown
                    </button>
                  </div>
                  {!editorCompatibility.supported && (
                    <span role="status" className="max-w-xl text-xs text-neutral-500">
                      {unsupportedEditorMessage(editorCompatibility.reason, lang)}
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                    {t.noteTitleLabel}
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => { markDraftTouched(); setEditTitle(e.target.value); }}
                    className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl px-4 py-2.5 text-lg font-bold text-neutral-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                    placeholder={t.noteTitlePlaceholder}
                  />
                </div>
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      {activeEditorMode === "visual" ? (lang === "th" ? "เนื้อหาโน้ต" : "Note content") : t.markdownContentLabel}
                    </label>
                    <span className="text-xs text-neutral-500" role="status">
                      {isSaving ? t.saving : isDraftDirty ? (lang === "th" ? "ยังไม่บันทึก" : "Unsaved changes") : (lang === "th" ? "บันทึกแล้ว" : "Saved")}
                    </span>
                  </div>
                  {activeEditorMode === "visual" ? (
                    <RichNoteEditor
                      ref={richEditorInstanceRef}
                      initialContent={editContent}
                      onChange={(value) => { markDraftTouched(); setEditContent(value); }}
                      onDirtyChange={setRichEditorDirty}
                      autoFocus={focusEditorOnOpen}
                      lang={lang}
                    />
                  ) : (
                    <MarkdownNoteEditor
                      ref={editorInstanceRef}
                      noteId={activeNote.id}
                      value={editContent}
                      onChange={(value) => { markDraftTouched(); setEditContent(value); }}
                      autoFocus={focusEditorOnOpen}
                      lang={lang}
                    />
                  )}
                </div>
              </div>
            ) : (
              <MarkdownViewer
                note={activeNote}
                lang={lang}
                onUpdateContent={async (newContent) => {
                  if (!activeNoteId) return;
                  try {
                    const targetId = activeNoteId;
                    const updatedNote = await patchNote(targetId, { content: newContent });
                    if (activeNoteIdRef.current === targetId) setEditContent(updatedNote.content);
                  } catch (err) {
                    console.error("Failed to update note content", err);
                  }
                }}
              />
            )}
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 text-center relative">
            {/* Mobile Top Bar with Menu button for Empty State */}
            <div className="md:hidden absolute top-4 left-4 z-10">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-2 text-neutral-400 hover:text-neutral-100 bg-neutral-900/90 border border-neutral-800 rounded-xl shadow-lg transition-colors cursor-pointer flex items-center gap-2 text-xs"
              >
                <Menu className="w-4 h-4" />
                <span>Menu</span>
              </button>
            </div>

            {/* Subtle background glow */}
            <div className="absolute w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -top-20" />
            
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-neutral-900/90 border border-neutral-800 flex items-center justify-center text-indigo-400 mb-5 sm:mb-6 shadow-2xl shadow-indigo-500/10 ring-1 ring-neutral-800">
              <UploadCloud className="w-8 h-8 sm:w-9 sm:h-9 animate-pulse" />
            </div>
            <h2 className="text-xl sm:text-3xl font-bold text-neutral-100 mb-2.5 sm:mb-3 tracking-tight">
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
                          ? `${window.location.origin}/share/${activeNote.shareToken}`
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
        lang={lang}
        setLang={setLang}
        onLogout={handleLogout}
        onAccountDeleted={() => {
          setIsSettingsOpen(false);
          router.push("/login");
        }}
      />

      {/* Visual Chart Wizard Modal */}
      <ChartWizardModal
        isOpen={isChartWizardOpen}
        onClose={() => setIsChartWizardOpen(false)}
        onInsertChart={handleInsertChart}
        lang={lang}
      />
    </div>
  );
}
