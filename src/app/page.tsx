"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { FolderItem, NoteItem } from "@/components/Sidebar";
import { AppLayoutSkeleton, NoteContentSkeleton } from "@/components/Skeletons";
import {
  FileText,
  UploadCloud,
  Trash2,
  Share2,
  Check,
  Globe,
  Lock,
  Search,
  Menu,
  RotateCcw,
} from "lucide-react";
import VoiceDictationButton from "@/components/VoiceDictationButton";
import { parseNoteTheme } from "@/lib/noteTheme";
import { Language, I18N_MAIN } from "@/lib/i18n";
import { getShortcuts, matchesShortcut, formatComboDisplay } from "@/lib/shortcuts";
import { NoteWriteCoordinator, type NotePatch, type EditableNote } from "@/lib/noteWriting";
import type { MarkdownNoteEditorHandle } from "@/components/MarkdownNoteEditor";
import type { RichNoteEditorHandle } from "@/components/RichNoteEditor";
import { appendMarkdownBlock, getLatestNoteDraftContent, isNoteDraftDirty } from "@/lib/markdownEditing";
import { readPreferredEditorMode as readStoredEditorMode, recordEditorModeChoice, type EditorMode } from "@/lib/editorModePreference";
import { getRichEditorCompatibility, type RichEditorUnsupportedReason } from "@/lib/richEditorCompatibility";
import { claimEditorTabId, discardNoteDraft, discardNoteDrafts, isNoteDraftFromCurrentEditor, listNoteDrafts, readNoteDraft, refreshEditorTabLease, releaseEditorTabLease, saveNoteDraft, selectNoteDraftForEditor, type NoteDraftRecord } from "@/lib/noteDraftStore";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

// Dynamically load heavy components only when opened or required
const DropzoneModal = dynamic(() => import("@/components/DropzoneModal"), { ssr: false });
const SettingsModal = dynamic(() => import("@/components/SettingsModal"), { ssr: false });
const ChartWizardModal = dynamic(() => import("@/components/ChartWizardModal"), { ssr: false });
const MarkdownNoteEditor = dynamic(() => import("@/components/MarkdownNoteEditor"), {
  ssr: false,
  loading: () => <EditorLoading />,
});
const RichNoteEditor = dynamic(() => import("@/components/RichNoteEditor"), { ssr: false });

type AutosaveState = "saved" | "saving" | "error";
type DraftConflict = { remote: EditableNote; draft?: NoteDraftRecord; localDrafts?: NoteDraftRecord[] };

function EditorLoading() {
  const [lang] = useLanguagePreference();
  return (
    <div role="status" className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-xs text-neutral-400">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      <span>{I18N_MAIN[lang].loadingEditor}</span>
    </div>
  );
}

function readPreferredEditorMode(): EditorMode {
  if (typeof window === "undefined") return "visual";
  try { return readStoredEditorMode(window.localStorage); }
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

function partialEditorMessage(reasons: string[], lang: Language): string {
  const labels: Record<string, { en: string; th: string }> = {
    html: { en: "HTML", th: "HTML" },
    heading: { en: "headings above level 3", th: "หัวข้อตั้งแต่ระดับ 4" },
    list: { en: "numbered lists starting above 1", th: "รายการลำดับเลขที่เริ่มเกิน 1" },
    linkReference: { en: "reference links", th: "ลิงก์อ้างอิง" },
    definition: { en: "link definitions", th: "คำจำกัดความของลิงก์" },
    footnoteDefinition: { en: "footnotes", th: "เชิงอรรถ" },
    footnoteReference: { en: "footnotes", th: "เชิงอรรถ" },
    imageReference: { en: "reference images", th: "รูปภาพแบบอ้างอิง" },
    "gfm-alert": { en: "GitHub alert blocks", th: "กล่องแจ้งเตือน" },
    "parse-error": { en: "unrecognized Markdown", th: "Markdown ที่ระบบอ่านไม่ครบ" },
  };
  const parts = [...new Set(reasons)].map(reason => labels[reason] || labels.advanced || { en: "special Markdown", th: "Markdown รูปแบบพิเศษ" });
  const names = parts.map(part => part[lang]).join(lang === "th" ? " และ " : ", ");
  return lang === "th"
    ? `ส่วน ${names} แก้ได้ในช่อง Markdown`
    : `${names} can be edited in its Markdown source block.`;
}

export default function AppHome() {
  const router = useRouter();
  const [lang, setLang] = useLanguagePreference();

  const t = I18N_MAIN[lang];
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  currentUserIdRef.current = user?.id ?? null;
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
  const editorTabIdRef = useRef<string | null>(null);
  const editorTabOwnerIdRef = useRef<string | null>(null);
  const preserveDraftAfterLeaseLossRef = useRef<() => void>(() => {});
  const createEditorTabId = () => typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const getEditorTabOwnerId = () => {
    if (editorTabOwnerIdRef.current) return editorTabOwnerIdRef.current;
    editorTabOwnerIdRef.current = createEditorTabId();
    return editorTabOwnerIdRef.current;
  };
  const getEditorTabId = () => {
    if (editorTabIdRef.current) return editorTabIdRef.current;
    try {
      editorTabIdRef.current = typeof window !== "undefined"
        ? claimEditorTabId(window.sessionStorage, window.localStorage, createEditorTabId, getEditorTabOwnerId())
        : createEditorTabId();
    } catch {
      editorTabIdRef.current = createEditorTabId();
    }
    return editorTabIdRef.current;
  };
  const getEditorTabOwnerIdRef = useRef(getEditorTabOwnerId);
  getEditorTabOwnerIdRef.current = getEditorTabOwnerId;
  const getEditorTabIdRef = useRef(getEditorTabId);
  getEditorTabIdRef.current = getEditorTabId;
  const createEditorTabIdRef = useRef(createEditorTabId);
  createEditorTabIdRef.current = createEditorTabId;
  useEffect(() => {
    const ownerId = getEditorTabOwnerIdRef.current();
    const tabId = getEditorTabIdRef.current();
    const renewLease = () => {
      try {
        const currentTabId = editorTabIdRef.current ?? tabId;
        if (refreshEditorTabLease(window.localStorage, currentTabId, ownerId)) return;
        const replacementTabId = claimEditorTabId(window.sessionStorage, window.localStorage, createEditorTabIdRef.current, ownerId);
        editorTabIdRef.current = replacementTabId;
        if (replacementTabId !== currentTabId) preserveDraftAfterLeaseLossRef.current();
      } catch { /* Editing remains available when browser storage is restricted. */ }
    };
    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted) return;
      try { releaseEditorTabLease(window.localStorage, editorTabIdRef.current ?? tabId, ownerId); } catch { /* Stale leases expire. */ }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") renewLease();
    };
    renewLease();
    const interval = window.setInterval(renewLease, 20_000);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", renewLease);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", renewLease);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      try { releaseEditorTabLease(window.localStorage, editorTabIdRef.current ?? tabId, ownerId); } catch { /* Stale leases expire. */ }
    };
  }, []);
  const draftTouchedRef = useRef(false);
  const draftVersionRef = useRef(0);
  const [activeNote, setActiveNote] = useState<EditableNote | null>(null);
  const [richEditorAlignmentFailureNoteId, setRichEditorAlignmentFailureNoteId] = useState<string | null>(null);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("saved");
  const [draftConflict, setDraftConflict] = useState<DraftConflict | null>(null);
  const localCreateRequestsRef = useRef(new Map<string, Promise<EditableNote>>());
  const [operationError, setOperationError] = useState<{ noteId: string | null; message: string } | null>(null);
  const [noteWrites] = useState(() => new NoteWriteCoordinator(async (id, patch, revision) => {
    const response = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, revision }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.note) {
      const error = new Error(data.error || `Failed to update note (${response.status})`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return data.note as EditableNote;
  }, (saved) => {
    setNotes((previous) => {
      const exists = previous.some((note) => note.id === saved.id);
      const updated = previous.map((note) => note.id === saved.id ? {
        ...note, title: saved.title, folderId: saved.folderId, revision: saved.revision,
        updatedAt: String(saved.updatedAt || new Date().toISOString()),
        color: parseNoteTheme(saved.content).color,
      } : note);
      return (exists ? updated : [{
        id: saved.id,
        title: saved.title,
        folderId: saved.folderId,
        updatedAt: String(saved.updatedAt || new Date().toISOString()),
        revision: saved.revision,
        color: parseNoteTheme(saved.content).color,
      }, ...updated]).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    });
    setActiveNote((previous) => previous?.id === saved.id ? saved : previous);
    setOperationError((previous) => previous?.noteId === saved.id ? null : previous);
  }, (id, error) => {
    if (activeNoteIdRef.current === id) setAutosaveState("error");
    const status = (error as Error & { status?: number }).status;
    if (status === 409) {
      fetch(`/api/notes/${id}`)
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          if (data?.note && activeNoteIdRef.current === id) {
            let localDrafts: NoteDraftRecord[] = [];
            const currentUserId = currentUserIdRef.current;
            if (currentUserId) {
              try {
                localDrafts = listNoteDrafts(window.localStorage, currentUserId)
                  .filter((draft) => draft.noteId === id && (draft.title !== data.note.title || draft.content !== data.note.content));
              } catch { /* Keep the active editor copy available if storage is restricted. */ }
            }
            const ownerId = editorTabOwnerIdRef.current;
            const currentDraft = ownerId
              ? selectNoteDraftForEditor(localDrafts, ownerId, editorTabIdRef.current ?? "")
              : localDrafts[0] ?? null;
            setDraftConflict({
              remote: data.note as EditableNote,
              draft: currentDraft ?? undefined,
              localDrafts: localDrafts.length ? localDrafts : undefined,
            });
          }
        })
        .catch(() => undefined);
    }
  }));
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isLoadingNote, setIsLoadingNote] = useState(false);
  const selectActiveNote = (id: string | null) => {
    activeNoteIdRef.current = id;
    setRichEditorAlignmentFailureNoteId(null);
    draftTouchedRef.current = false;
    draftVersionRef.current = 0;
    setDraftConflict(null);
    setAutosaveState("saved");
    setActiveNoteId(id);
    if (id && !id.startsWith("local:") && !noteWrites.getNote(id)) {
      setIsLoadingNote(true);
    }
  };
  const markDraftTouched = () => {
    draftTouchedRef.current = true;
    draftVersionRef.current += 1;
    setAutosaveState("saving");
  };

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Editor mode state
  const [activeEditorMode, setActiveEditorMode] = useState<EditorMode>("visual");
  const initializedEditorModeForRef = useRef<string | null>(null);
  const [richEditorDirty, setRichEditorDirty] = useState(false);
  const [focusEditorOnOpen, setFocusEditorOnOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const editTitleRef = useRef("");
  const editContentRef = useRef("");
  const updateEditTitle = (title: string) => {
    markDraftTouched();
    editTitleRef.current = title;
    setEditTitle(title);
  };
  const updateEditContent = (content: string) => {
    markDraftTouched();
    setRichEditorAlignmentFailureNoteId(null);
    editContentRef.current = content;
    setEditContent(content);
  };
  const editorCompatibility = useMemo(
    () => getRichEditorCompatibility(editContent),
    [editContent],
  );
  const richEditorAlignmentFailed = activeNote?.id === richEditorAlignmentFailureNoteId;
  const isDraftDirty = Boolean(activeNote && (
    richEditorDirty || isNoteDraftDirty(activeNote, { title: editTitle, content: editContent })
  ));

  const rememberEditorMode = (mode: EditorMode) => {
    try { recordEditorModeChoice(window.localStorage, mode); } catch { /* Preference remains active for this session. */ }
  };

  const getLatestDraftContent = () => getLatestNoteDraftContent(
    activeEditorMode,
    editContentRef.current,
    richEditorInstanceRef.current,
  );

  const storeDraftSnapshot = (target: EditableNote, title: string, content: string): NoteDraftRecord | null => {
    if (!user || typeof window === "undefined") return null;
    if (!isNoteDraftDirty(target, { title, content })) {
      try { discardNoteDraft(window.localStorage, user.id, target.id, getEditorTabOwnerId()); } catch { /* Storage may be unavailable. */ }
      return null;
    }
    const draft: NoteDraftRecord = {
      userId: user.id,
      noteId: target.id,
      title,
      content,
      baseRevision: target.revision,
      baseTitle: target.title,
      baseContent: target.content,
      folderId: target.folderId,
      tabId: getEditorTabOwnerId(),
      editorTabId: getEditorTabId(),
      updatedAt: new Date().toISOString(),
    };
    try { saveNoteDraft(window.localStorage, draft); } catch { /* Keep editing; the server save may still work. */ }
    return draft;
  };

  const stashCurrentDraft = () => {
    if (!activeNote || !activeNoteId) return;
    const content = getLatestDraftContent();
    editContentRef.current = content;
    storeDraftSnapshot(activeNote, editTitleRef.current, content);
  };
  preserveDraftAfterLeaseLossRef.current = stashCurrentDraft;

  const applyCreatedNote = (temporaryId: string, saved: EditableNote, capturedVersion: number) => {
    if (!user || typeof window === "undefined") return;
    noteWrites.observeNote(saved);
    const currentlyEditingThisNote = activeNoteIdRef.current === temporaryId;
    const currentTitle = currentlyEditingThisNote ? editTitleRef.current : undefined;
    const currentContent = currentlyEditingThisNote ? getLatestDraftContent() : undefined;
    const recovered = readNoteDraft(window.localStorage, user.id, temporaryId, getEditorTabOwnerId());
    const title = (currentTitle ?? recovered?.title ?? saved.title).trim()
      ? currentTitle ?? recovered?.title ?? saved.title
      : saved.title;
    const content = currentContent ?? recovered?.content ?? saved.content;

    try {
      discardNoteDraft(window.localStorage, user.id, temporaryId, getEditorTabOwnerId());
      if (isNoteDraftDirty(saved, { title, content })) {
        saveNoteDraft(window.localStorage, {
          userId: user.id,
          noteId: saved.id,
          title,
          content,
          baseRevision: saved.revision,
          baseTitle: saved.title,
          baseContent: saved.content,
          folderId: saved.folderId,
          tabId: getEditorTabOwnerId(),
          editorTabId: getEditorTabId(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        discardNoteDraft(window.localStorage, user.id, saved.id, getEditorTabOwnerId());
      }
    } catch { /* Retain the in-memory copy if browser storage is unavailable. */ }

    setNotes((previous) => previous.some((note) => note.id === saved.id) ? previous : [{
      id: saved.id,
      title: saved.title,
      folderId: saved.folderId,
      updatedAt: String(saved.updatedAt || new Date().toISOString()),
      revision: saved.revision,
      color: parseNoteTheme(saved.content).color,
    }, ...previous]);

    if (currentlyEditingThisNote) {
      activeNoteIdRef.current = saved.id;
      setActiveNoteId(saved.id);
      setActiveNote(saved);
      setFocusEditorOnOpen(false);
      if (!editTitleRef.current.trim()) {
        editTitleRef.current = saved.title;
        setEditTitle(saved.title);
      }
      if (draftVersionRef.current === capturedVersion) {
        editTitleRef.current = saved.title;
        editContentRef.current = saved.content;
        setEditTitle(saved.title);
        setEditContent(saved.content);
        draftTouchedRef.current = false;
        setRichEditorDirty(false);
        setAutosaveState("saved");
        try { discardNoteDraft(window.localStorage, user.id, saved.id, getEditorTabOwnerId()); } catch { /* Storage may be unavailable. */ }
      } else {
        editContentRef.current = content;
        setEditContent(content);
        setAutosaveState("saving");
      }
    }
    void loadNotes();
  };

  async function persistDraftFor(target: EditableNote, title: string, content: string, version: number): Promise<void> {
    if (!user) return;
    storeDraftSnapshot(target, title, content);
    if (!isNoteDraftDirty(target, { title, content })) {
      if (activeNoteIdRef.current === target.id) setAutosaveState("saved");
      return;
    }

    if (target.id.startsWith("local:")) {
      const pending = localCreateRequestsRef.current.get(target.id);
      if (pending) {
        const saved = await pending;
        await persistDraftFor(saved, title, content, version);
        return;
      }
      const responsePromise = (async () => {
        const response = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim() || t.noteTitlePlaceholder,
            content,
            folderId: target.folderId,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.note) throw new Error(data.error || `Failed to create note (${response.status})`);
        return data.note as EditableNote;
      })();
      localCreateRequestsRef.current.set(target.id, responsePromise);
      try {
        const saved = await responsePromise;
        applyCreatedNote(target.id, saved, version);
      } finally {
        if (localCreateRequestsRef.current.get(target.id) === responsePromise) {
          localCreateRequestsRef.current.delete(target.id);
        }
      }
      return;
    }

    const titleToSave = title.trim() || target.title || t.noteTitlePlaceholder;
    const saved = await noteWrites.write(target.id, { title: titleToSave, content });
    if (user && typeof window !== "undefined") {
      const currentDraft = readNoteDraft(window.localStorage, user.id, target.id, getEditorTabOwnerId());
      if (currentDraft?.title === title && currentDraft.content === content) {
        discardNoteDraft(window.localStorage, user.id, target.id, getEditorTabOwnerId());
      }
    }
    if (activeNoteIdRef.current === target.id && draftVersionRef.current === version) {
      editTitleRef.current = saved.title;
      editContentRef.current = saved.content;
      setEditTitle(saved.title);
      setEditContent(saved.content);
      draftTouchedRef.current = false;
      setRichEditorDirty(false);
      setAutosaveState("saved");
    } else if (activeNoteIdRef.current === target.id && !editTitleRef.current.trim()) {
      editTitleRef.current = saved.title;
      setEditTitle(saved.title);
    }
    void loadNotes();
  }

  const saveActiveDraft = async () => {
    if (!activeNote || !activeNoteId || draftConflict) return;
    const content = getLatestDraftContent();
    editContentRef.current = content;
    const title = editTitleRef.current;
    const version = draftVersionRef.current;
    setAutosaveState(isNoteDraftDirty(activeNote, { title, content }) ? "saving" : "saved");
    try {
      await persistDraftFor(activeNote, title, content, version);
    } catch (error) {
      console.error("Failed to save note", error);
      if (activeNoteIdRef.current === activeNote.id) setAutosaveState("error");
    }
  };

  const stashDraftRef = useRef(stashCurrentDraft);
  stashDraftRef.current = stashCurrentDraft;
  const saveDraftRef = useRef(saveActiveDraft);
  saveDraftRef.current = saveActiveDraft;

  useEffect(() => {
    const retrySaveWhenOnline = () => {
      if (navigator.onLine) void saveDraftRef.current();
    };
    window.addEventListener("online", retrySaveWhenOnline);
    return () => window.removeEventListener("online", retrySaveWhenOnline);
  }, []);

  useEffect(() => {
    if (!isDraftDirty || !activeNote || !activeNoteId) return;
    const timer = setTimeout(() => stashDraftRef.current(), 250);
    return () => clearTimeout(timer);
  }, [isDraftDirty, activeNote, activeNoteId, editTitle, editContent, richEditorDirty]);

  useEffect(() => {
    if (!isDraftDirty || !activeNote || !activeNoteId || draftConflict) return;
    const timer = setTimeout(() => { void saveDraftRef.current(); }, 700);
    return () => clearTimeout(timer);
  }, [isDraftDirty, activeNote, activeNoteId, editTitle, editContent, richEditorDirty, draftConflict]);

  useEffect(() => {
    if (!isDraftDirty || !activeNote || !activeNoteId) return;
    const handlePageHide = () => stashDraftRef.current();
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [isDraftDirty, activeNote, activeNoteId, editTitle, editContent]);

  const handleEditorModeChange = (mode: EditorMode) => {
    if (mode === "visual" && !getRichEditorCompatibility(editContent).supported) return;
    if (mode === "visual") setRichEditorAlignmentFailureNoteId(null);
    const latestContent = getLatestDraftContent();
    editContentRef.current = latestContent;
    setEditContent(latestContent);
    setActiveEditorMode(mode);
    rememberEditorMode(mode);
    setRichEditorDirty(false);
  };

  // Share state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [shareError, setShareError] = useState("");

  // Upload Modal
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Mobile Drawer State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Chart Wizard state
  const [isChartWizardOpen, setIsChartWizardOpen] = useState(false);
  const [chartWizardInstanceKey, setChartWizardInstanceKey] = useState(0);

  const openChartWizard = () => {
    setChartWizardInstanceKey((key) => key + 1);
    setIsChartWizardOpen(true);
  };

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
        try {
          const localDrafts = listNoteDrafts(window.localStorage, data.user.id)
            .filter((draft) => draft.noteId.startsWith("local:") && (draft.title.trim() || draft.content.trim()));
          const recovered = selectNoteDraftForEditor(localDrafts, getEditorTabOwnerIdRef.current(), getEditorTabIdRef.current());
          if (recovered) {
            const note: EditableNote = {
              id: recovered.noteId,
              title: recovered.baseTitle,
              content: recovered.baseContent,
              folderId: recovered.folderId ?? null,
              revision: recovered.baseRevision,
            };
            activeNoteIdRef.current = note.id;
            draftVersionRef.current = 1;
            draftTouchedRef.current = true;
            setActiveNoteId(note.id);
            setActiveNote(note);
            initializedEditorModeForRef.current = note.id;
            editTitleRef.current = recovered.title;
            editContentRef.current = recovered.content;
            setEditTitle(recovered.title);
            setEditContent(recovered.content);
            setActiveEditorMode(readPreferredEditorMode());
            setAutosaveState("saving");
          }
        } catch { /* Browsers can disable local storage; continue with server data. */ }
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
      if (!res.ok) throw new Error("load-folders");
      const data = await res.json();
      if (data.folders) {
        setFolders(data.folders);
        setOperationError(previous => previous?.message === t.loadFoldersError ? null : previous);
      }
    } catch (err) {
      console.error(err);
      setOperationError({ noteId: null, message: t.loadFoldersError });
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
      setOperationError(previous => previous?.message === t.loadNotesError ? null : previous);
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
      if (requestId === notesRequestIdRef.current) {
        setOperationError({ noteId: null, message: t.loadNotesError });
      }
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

  const applyLoadedNote = (note: EditableNote & { isShared?: boolean }) => {
    setActiveNote(note);
    setFocusEditorOnOpen(false);
    setIsShared(Boolean(note.isShared));
    if (initializedEditorModeForRef.current !== note.id) {
      const compatible = getRichEditorCompatibility(note.content);
      setActiveEditorMode(compatible.supported ? readPreferredEditorMode() : "markdown");
      initializedEditorModeForRef.current = note.id;
    }
    if (!user) {
      editTitleRef.current = note.title;
      editContentRef.current = note.content;
      setEditTitle(note.title);
      setEditContent(note.content);
      setAutosaveState("saved");
      return;
    }
    let draft: NoteDraftRecord | null = null;
    let draftsForNote: NoteDraftRecord[] = [];
    const editorOwnerId = getEditorTabOwnerId();
    const editorSessionTabId = getEditorTabId();
    try {
      draftsForNote = listNoteDrafts(window.localStorage, user.id).filter((item) => item.noteId === note.id);
      draft = selectNoteDraftForEditor(draftsForNote, editorOwnerId, editorSessionTabId)
        || readNoteDraft(window.localStorage, user.id, note.id);
    } catch { /* Continue without local recovery. */ }
    if (draft && (draft.title !== note.title || draft.content !== note.content)) {
      editTitleRef.current = draft.title;
      editContentRef.current = draft.content;
      setEditTitle(draft.title);
      setEditContent(draft.content);
      draftTouchedRef.current = true;
      draftVersionRef.current += 1;
      const sameBase = draft.baseRevision === note.revision
        && draft.baseTitle === note.title
        && draft.baseContent === note.content;
      let ownsEditorTabLease = false;
      try { ownsEditorTabLease = refreshEditorTabLease(window.localStorage, editorSessionTabId, editorOwnerId); } catch { /* Local recovery can still show a conflict choice. */ }
      const matchingEditorTabDraftCount = draftsForNote.filter((item) => {
        const storedEditorTabId = item.editorTabId ?? (item.tabId === editorOwnerId ? undefined : item.tabId);
        return storedEditorTabId === editorSessionTabId;
      }).length;
      const fromOtherTab = !isNoteDraftFromCurrentEditor(draft, editorOwnerId, editorSessionTabId, ownsEditorTabLease, matchingEditorTabDraftCount);
      const localDrafts = fromOtherTab
        ? draftsForNote.filter((item) => item.title !== note.title || item.content !== note.content)
        : undefined;
      setDraftConflict(sameBase && !fromOtherTab ? null : { remote: note, draft, localDrafts });
      setAutosaveState(sameBase && !fromOtherTab ? "saving" : "error");
    } else {
      if (draft) {
        try { discardNoteDraft(window.localStorage, user.id, note.id, draft?.tabId); } catch { /* Storage may be unavailable. */ }
      }
      editTitleRef.current = note.title;
      editContentRef.current = note.content;
      setEditTitle(note.title);
      setEditContent(note.content);
      draftTouchedRef.current = false;
      draftVersionRef.current = 0;
      setDraftConflict(null);
      setAutosaveState("saved");
    }
  };

  // Fetch single active note details (Instant SWR cache + background revalidation)
  useEffect(() => {
    if (!activeNoteId) {
      setActiveNote(null);
      setIsLoadingNote(false);
      return;
    }
    if (activeNoteId.startsWith("local:")) {
      setIsLoadingNote(false);
      return;
    }

    // 1. Instant Cache Hit (0ms transition)
    const cached = noteWrites.getNote(activeNoteId);
    if (cached) {
      applyLoadedNote(cached);
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
          applyLoadedNote(data.note);
          setIsLoadingNote(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load note", err);
        if (!cancelled) {
          setIsLoadingNote(false);
          setOperationError({ noteId: activeNoteId, message: t.loadNoteError });
        }
      });
    return () => { cancelled = true; };
  }, [activeNoteId, noteWrites, user, t.loadNoteError]);

  // Handle Toggle Share
  const handleToggleShare = async (newSharedStatus: boolean) => {
    if (!activeNoteId) return;
    setShareError("");
    try {
      const res = await fetch(`/api/notes/${activeNoteId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isShared: newSharedStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.note) throw new Error("share-update");
      setIsShared(newSharedStatus);
      setActiveNote((prev: any) => ({ ...prev, isShared: newSharedStatus, shareToken: data.note.shareToken }));
    } catch (err) {
      console.error(err);
      setShareError(t.shareError);
    }
  };

  const handleCopyLink = async () => {
    if (typeof window === "undefined" || !activeNoteId) return;
    if (!activeNote?.shareToken) return;
    const shareUrl = `${window.location.origin}/share/${activeNote.shareToken}`;
    setShareError("");
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2000);
    } catch {
      setShareError(t.copyLinkError);
    }
  };

  // Handle Create Note
  const handleCreateNote = async (folderId?: string | null) => {
    stashCurrentDraft();
    void saveActiveDraft();
    const randomId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const note: EditableNote = {
      id: `local:${randomId}`,
      title: "",
      content: "",
      folderId: folderId ?? selectedFolderId,
      revision: -1,
    };
    selectActiveNote(note.id);
    setActiveNote(note);
    editTitleRef.current = "";
    editContentRef.current = "";
    setEditTitle("");
    setEditContent("");
    setActiveEditorMode(readPreferredEditorMode());
    setRichEditorDirty(false);
    setFocusEditorOnOpen(true);
    initializedEditorModeForRef.current = note.id;
  };

  const handleSaveNote = saveActiveDraft;

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
        handleEditorModeChange(activeEditorMode === "visual" ? "markdown" : "visual");
        return;
      }

      // 5. Save Note
      if (matchesShortcut(e, shortcuts.saveNote) && activeNote) {
        e.preventDefault();
        handleSaveNote();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, selectedFolderId, activeNote, activeEditorMode, editTitle, editContent, editorCompatibility.supported]);

  // Handle Delete Note
  const handleDeleteNote = async (id: string) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete-note");
      noteWrites.evictNote(id);
      prefetchedIdsRef.current.delete(id);
      if (user && typeof window !== "undefined") {
        try { discardNoteDrafts(window.localStorage, user.id, id); } catch { /* Storage may be unavailable. */ }
      }
      if (activeNoteId === id) {
        selectActiveNote(null);
        setActiveNote(null);
      }
      await loadNotes();
    } catch (err: any) {
      console.error(err);
      setOperationError({ noteId: id, message: t.deleteNoteError });
    }
  };

  // Handle voice transcript insertion
  const handleVoiceTranscript = async (text: string) => {
    if (!activeNoteId || !activeNote) return;
    if (activeEditorMode === "visual" && richEditorInstanceRef.current) {
      richEditorInstanceRef.current.insertText(text);
    } else {
      updateEditContent(editContentRef.current ? `${editContentRef.current}\n${text}` : text);
    }
  };

  // Handle chart insertion from wizard
  const handleInsertChart = async (markdown: string) => {
    if (!activeNoteId || !activeNote) return;
    if (activeEditorMode === "visual") {
      richEditorInstanceRef.current?.insertMarkdown(markdown);
    } else if (editorInstanceRef.current?.insertMarkdown) {
      editorInstanceRef.current.insertMarkdown(markdown);
    } else {
      updateEditContent(appendMarkdownBlock(editContentRef.current, markdown));
    }
  };

  // Handle Create Folder
  const handleCreateFolder = async (name: string, parentId?: string | null) => {
    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId }),
      });
      if (!response.ok) throw new Error("create-folder");
      loadFolders();
    } catch (err) {
      console.error(err);
      setOperationError({ noteId: null, message: t.createFolderError });
    }
  };

  // Handle Delete Folder
  const handleDeleteFolder = async (id: string) => {
    try {
      const response = await fetch(`/api/folders/${id}`, { method: "DELETE" });
      if (!response.ok) {
        setOperationError({ noteId: null, message: response.status === 409 ? t.folderNotEmptyError : t.deleteFolderError });
        return;
      }
      setOperationError((previous) => previous?.noteId === null ? null : previous);
      if (selectedFolderId === id) setSelectedFolderId(null);
      loadFolders();
      loadNotes();
    } catch (err) {
      console.error(err);
      setOperationError({ noteId: null, message: t.deleteFolderError });
    }
  };

  // Handle Rename Note
  const handleRenameNote = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      await patchNote(id, { title: newTitle.trim() });
      if (activeNoteIdRef.current === id) {
        editTitleRef.current = newTitle.trim();
        setEditTitle(newTitle.trim());
      }
      await loadNotes();
    } catch (err) {
      console.error("Failed to rename note:", err);
      setOperationError({ noteId: id, message: t.renameNoteError });
    }
  };

  // Handle Rename Folder
  const handleRenameFolder = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    // Optimistic update
    setFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: newName.trim() } : f))
    );
    try {
      const response = await fetch(`/api/folders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!response.ok) throw new Error("rename-folder");
      loadFolders();
    } catch (err) {
      console.error("Failed to rename folder:", err);
      setOperationError({ noteId: null, message: t.renameFolderError });
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
      const status = (err as Error & { status?: number }).status;
      setOperationError({
        noteId,
        message: status === 404 ? t.itemNotFoundError : status === 409 ? t.noteChangedError : t.moveNoteError,
      });
    }
  };

  // Handle Move Folder
  const handleMoveFolder = async (folderId: string, targetParentId: string | null) => {
    const originalFolders = [...folders];
    let failureMessage = t.moveFolderError;
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
        if (res.status === 400) failureMessage = t.folderMoveInvalidError;
        else if (res.status === 404) failureMessage = t.itemNotFoundError;
        throw new Error("Failed to move folder");
      }
      loadFolders();
    } catch (err) {
      console.error("Failed to move folder:", err);
      setFolders(originalFolders);
      setOperationError({
        noteId: null,
        message: failureMessage,
      });
      loadFolders();
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    stashCurrentDraft();
    void saveActiveDraft();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const selectLocalConflictDraft = (draft: NoteDraftRecord) => {
    if (!draftConflict) return;
    setDraftConflict({ ...draftConflict, draft });
    editTitleRef.current = draft.title;
    editContentRef.current = draft.content;
    setEditTitle(draft.title);
    setEditContent(draft.content);
    draftTouchedRef.current = true;
    draftVersionRef.current += 1;
    setRichEditorDirty(false);
    setAutosaveState("error");
  };

  const keepMineAfterConflict = async () => {
    if (!draftConflict || !activeNoteId) return;
    const remote = draftConflict.remote;
    noteWrites.observeNote(remote);
    setActiveNote(remote);
    const selectedDraft = draftConflict.draft;
    const currentEditorContent = getLatestDraftContent();
    const content = selectedDraft && editContentRef.current === selectedDraft.content
      ? selectedDraft.content
      : currentEditorContent;
    editContentRef.current = content;
    const title = editTitleRef.current;
    const version = draftVersionRef.current;
    setDraftConflict(null);
    setAutosaveState("saving");
    try {
      await persistDraftFor(remote, title, content, version);
      const selectedDraftId = draftConflict.draft?.tabId;
      if (selectedDraftId && selectedDraftId !== getEditorTabOwnerId() && user && typeof window !== "undefined") {
        try { discardNoteDraft(window.localStorage, user.id, remote.id, selectedDraftId); } catch { /* Storage may be unavailable. */ }
      }
    } catch (error) {
      console.error("Failed to resolve note conflict", error);
      setAutosaveState("error");
    }
  };

  const useSavedAfterConflict = () => {
    if (!draftConflict || !user || typeof window === "undefined") return;
    const remote = draftConflict.remote;
    noteWrites.observeNote(remote);
    setActiveNote(remote);
    editTitleRef.current = remote.title;
    editContentRef.current = remote.content;
    setEditTitle(remote.title);
    setEditContent(remote.content);
    draftTouchedRef.current = false;
    draftVersionRef.current += 1;
    setRichEditorDirty(false);
    setDraftConflict(null);
    setAutosaveState("saved");
    try {
      discardNoteDraft(window.localStorage, user.id, remote.id, draftConflict.draft?.tabId ?? getEditorTabOwnerId());
    } catch { /* Storage may be unavailable. */ }
  };

  if (loading || !user) {
    return <AppLayoutSkeleton lang={lang} />;
  }

  return (
    <div className="h-[100dvh] w-full bg-neutral-950 text-neutral-200 flex overflow-hidden font-sans antialiased">
      {operationError && (
        <div role="alert" className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-[90vw] rounded-lg border border-rose-500/40 bg-rose-950 px-4 py-3 text-sm text-rose-100 shadow-xl flex items-center gap-3">
          <span>{operationError.message}</span>
          <button type="button" onClick={() => setOperationError(null)} aria-label={t.dismissError} className="text-rose-200 hover:text-white">×</button>
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
          stashCurrentDraft();
          void saveActiveDraft();
          selectActiveNote(id);
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
          <NoteContentSkeleton lang={lang} onOpenMobile={() => setIsMobileSidebarOpen(true)} />
        ) : activeNote ? (
          <>
            {/* Note title and writing controls */}
            <div className="min-h-14 border-b border-neutral-800/80 bg-neutral-900/40 px-2 py-2 sm:px-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 z-10">
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400"
                  aria-label={t.openNotes}
                >
                  <Menu className="h-5 w-5" />
                </button>
                <FileText className="h-5 w-5 shrink-0 text-indigo-400" aria-hidden="true" />
                <input
                  type="text"
                  value={editTitle}
                  onChange={(event) => updateEditTitle(event.target.value)}
                  className="min-w-0 flex-1 max-w-2xl rounded-lg border border-transparent bg-transparent px-2 py-2 text-base font-semibold text-neutral-100 placeholder:text-neutral-600 hover:border-neutral-800 focus:border-neutral-700 focus:bg-neutral-900 focus:outline-none"
                  placeholder={t.noteTitlePlaceholder}
                  aria-label={t.noteTitleLabel}
                />
                {isShared && (
                  <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/25 px-2.5 py-1 text-[10px] font-medium text-emerald-400 sm:flex">
                    <Globe className="h-3 w-3" />{t.publicSharedBadge}
                  </span>
                )}
              </div>

              <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-1 md:w-auto md:justify-end md:gap-1.5">
                {autosaveState === "error" && !draftConflict ? (
                  <>
                    <span role="status" aria-live="polite" className="max-w-24 truncate text-[10px] text-neutral-500 md:max-w-36 md:text-xs">{t.saveFailed}</span>
                    <button type="button" onClick={() => void saveActiveDraft()} title={t.retrySave} aria-label={t.retrySave} className="inline-flex h-10 items-center gap-1 rounded-lg px-2 text-xs text-neutral-300 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-indigo-400">
                      <RotateCcw className="h-4 w-4" /><span className="hidden sm:inline">{t.retrySave}</span>
                    </button>
                  </>
                ) : (
                  <span role="status" aria-live="polite" className="max-w-16 truncate text-[10px] text-neutral-500 md:max-w-36 md:text-xs">
                    {autosaveState === "saving"
                      ? t.saving
                      : autosaveState === "error"
                        ? t.saveFailed
                        : t.saved}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleEditorModeChange(activeEditorMode === "visual" ? "markdown" : "visual")}
                  disabled={activeEditorMode === "markdown" && !editorCompatibility.supported}
                  title={activeEditorMode === "visual" ? t.editMarkdown : t.switchToWrite}
                  aria-label={activeEditorMode === "visual" ? t.markdownMode : t.writeMode}
                  className="min-h-10 rounded-lg border border-neutral-800 px-2.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-indigo-400"
                >
                  {activeEditorMode === "visual" ? t.markdownMode : t.writeMode}
                </button>
                <VoiceDictationButton lang={lang} onTranscript={handleVoiceTranscript} />
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("nota:open-find"))}
                  title={`${t.findInNote} (${formatComboDisplay(shortcuts.findInNote)})`}
                  aria-label={t.findInNote}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400"
                >
                  <Search className="h-4 w-4" />
                </button>
                {!activeNote.id.startsWith("local:") && (
                  <button
                    type="button"
                    onClick={() => { setShareError(""); setIsShareModalOpen(true); }}
                    title={t.shareNote}
                    aria-label={t.shareNote}
                    className={`flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-indigo-400 ${isShared ? "text-emerald-300 hover:bg-emerald-950/40" : "text-neutral-400 hover:bg-neutral-800 hover:text-white"}`}
                  >
                    <Share2 className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.shareNote}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (activeNote.id.startsWith("local:")) {
                      if (user) {
                        try { discardNoteDraft(window.localStorage, user.id, activeNote.id, getEditorTabOwnerId()); } catch { /* Storage may be unavailable. */ }
                      }
                      selectActiveNote(null);
                      setActiveNote(null);
                    } else if (confirm(t.deleteNoteConfirm(activeNote.title))) {
                      void handleDeleteNote(activeNote.id);
                    }
                  }}
                  title={activeNote.id.startsWith("local:") ? t.closeNewNote : t.deleteNote}
                  aria-label={activeNote.id.startsWith("local:") ? t.closeNewNote : t.deleteNote}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-800 hover:text-rose-400 focus-visible:outline-2 focus-visible:outline-indigo-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {draftConflict && (
              <div role="alert" className="space-y-3 border-b border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p>{draftConflict.localDrafts && draftConflict.localDrafts.length > 1 ? t.draftConflictMany : t.draftConflictOne}</p>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => void keepMineAfterConflict()} className="min-h-10 rounded-md bg-amber-200 px-3 text-xs font-semibold text-neutral-950 hover:bg-amber-100">{t.keepSelectedDraft}</button>
                    <button type="button" onClick={useSavedAfterConflict} className="min-h-10 rounded-md border border-amber-200/40 px-3 text-xs text-amber-100 hover:bg-amber-900/50">{t.useSavedDraft}</button>
                  </div>
                </div>
                {draftConflict.localDrafts && draftConflict.localDrafts.length > 1 && (
                  <div className="flex flex-wrap gap-2" aria-label={t.localDrafts}>
                    {draftConflict.localDrafts.map((localDraft, index) => (
                      <button
                        key={localDraft.tabId || `${localDraft.noteId}-${index}`}
                        type="button"
                        aria-pressed={draftConflict.draft === localDraft}
                        onClick={() => selectLocalConflictDraft(localDraft)}
                        className={`min-h-10 max-w-full rounded-md border px-3 py-2 text-left text-xs focus-visible:outline-2 focus-visible:outline-amber-200 ${draftConflict.draft === localDraft ? "border-amber-200 bg-amber-200/10" : "border-amber-200/30 hover:bg-amber-900/40"}`}
                      >
                        <span className="block max-w-64 truncate font-medium">{localDraft.title.trim() || t.noteTitlePlaceholder}</span>
                        <span className="block max-w-64 truncate text-amber-100/60">{localDraft.content.replace(/\s+/g, " ").slice(0, 90)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex min-h-0 min-w-0 flex-1 flex-col px-3 py-3 sm:px-6 sm:py-5 md:px-8">
              {!editorCompatibility.supported || richEditorAlignmentFailed || (editorCompatibility.supported && editorCompatibility.coverage === "partial") ? (
                <p role="status" className="mb-2 text-xs text-neutral-500">
                  {!editorCompatibility.supported
                    ? unsupportedEditorMessage(editorCompatibility.reason, lang)
                    : richEditorAlignmentFailed
                      ? (lang === "th" ? "เปิด Markdown เพื่อรักษารูปแบบเดิมของโน้ตนี้" : "Markdown is open to preserve this note's original formatting.")
                      : partialEditorMessage(editorCompatibility.opaqueReasons, lang)}
                </p>
              ) : null}
              {activeEditorMode === "visual" ? (
                <RichNoteEditor
                  key={activeNote.id}
                  ref={richEditorInstanceRef}
                  initialContent={editContent}
                  onChange={updateEditContent}
                  onDirtyChange={setRichEditorDirty}
                  onAlignmentFailure={() => {
                    setRichEditorAlignmentFailureNoteId(activeNote.id);
                    setActiveEditorMode("markdown");
                  }}
                  autoFocus={focusEditorOnOpen}
                  lang={lang}
                  onOpenDiagram={openChartWizard}
                />
              ) : (
                <MarkdownNoteEditor
                  key={activeNote.id}
                  ref={editorInstanceRef}
                  noteId={activeNote.id}
                  value={editContent}
                  onChange={updateEditContent}
                  autoFocus={focusEditorOnOpen}
                  lang={lang}
                />
              )}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="relative flex flex-1 flex-col items-center justify-center p-4 text-center sm:p-8">
            {/* Mobile Top Bar with Menu button for Empty State */}
            <div className="lg:hidden absolute top-4 left-4 z-10">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="flex min-h-10 items-center gap-2 rounded-lg border border-neutral-800 px-3 text-xs text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100 focus-visible:outline-2 focus-visible:outline-indigo-400"
              >
                <Menu className="w-4 h-4" />
                <span>{t.notesMenu}</span>
              </button>
            </div>

            <FileText className="mb-4 h-7 w-7 text-neutral-500" aria-hidden="true" />
            <h2 className="mb-2 text-lg font-semibold tracking-tight text-neutral-100 sm:text-xl">
              {t.emptyHeroTitle}
            </h2>
            <p className="mb-6 max-w-lg text-sm leading-relaxed text-neutral-400">
              {t.emptyHeroDesc}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => handleCreateNote(selectedFolderId)}
                className="flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-300"
              >
                <FileText className="h-4 w-4" />
                <span>{t.createEmptyBtn}</span>
              </button>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-neutral-800 px-4 text-sm text-neutral-300 hover:bg-neutral-900 focus-visible:outline-2 focus-visible:outline-indigo-400"
              >
                <UploadCloud className="h-4 w-4" />
                <span>{t.dropNowBtn}</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Share Modal */}
      {isShareModalOpen && activeNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="share-modal-title" className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Share2 className="w-4 h-4" />
                </div>
                <h3 id="share-modal-title" className="font-semibold text-neutral-100">{t.shareModalTitle}</h3>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                aria-label={t.closeBtn}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
              {t.shareModalDesc}
            </p>

            {shareError && <p role="alert" className="mb-4 text-sm text-rose-300">{shareError}</p>}

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
                  aria-label={isShared ? t.disableShareBtn : t.enableShareBtn}
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
        key={chartWizardInstanceKey}
        isOpen={isChartWizardOpen}
        onClose={() => setIsChartWizardOpen(false)}
        onInsertChart={handleInsertChart}
        lang={lang}
        initialType="flowchart"
      />
    </div>
  );
}
