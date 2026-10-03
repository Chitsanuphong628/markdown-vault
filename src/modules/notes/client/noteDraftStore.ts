export interface NoteDraftRecord {
  userId: string;
  noteId: string;
  title: string;
  content: string;
  baseRevision: number;
  baseTitle: string;
  baseContent: string;
  folderId?: string | null;
  /** Unique per page document so copied sessionStorage cannot make tabs share a draft key. */
  tabId?: string;
  /** Stable for a normal reload; used only to recognize recovery in the same browser tab. */
  editorTabId?: string;
  updatedAt: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length?: number;
  key?(index: number): string | null;
}

const DRAFT_KEY_PREFIX = "nota:draft:v1";
const EDITOR_TAB_ID_KEY = "nota:editor-tab:v1";
const EDITOR_TAB_LEASE_PREFIX = "nota:editor-tab-lease:v1:";
const EDITOR_TAB_LEASE_TTL_MS = 60_000;

function editorTabLeaseKey(tabId: string): string {
  return `${EDITOR_TAB_LEASE_PREFIX}${encodeURIComponent(tabId)}`;
}

export function refreshEditorTabLease(storage: StorageLike, tabId: string, ownerId: string, now = Date.now()): boolean {
  try {
    const key = editorTabLeaseKey(tabId);
    const current = storage.getItem(key);
    if (current) {
      const lease = JSON.parse(current) as { ownerId?: unknown; expiresAt?: unknown };
      if (typeof lease.ownerId === "string" && lease.ownerId !== ownerId
        && typeof lease.expiresAt === "number" && lease.expiresAt > now) return false;
    }
    storage.setItem(key, JSON.stringify({ ownerId, expiresAt: now + EDITOR_TAB_LEASE_TTL_MS }));
    return true;
  } catch {
    return false;
  }
}

export function claimEditorTabId(
  sessionStorage: StorageLike,
  sharedStorage: StorageLike,
  createId: () => string,
  ownerId: string,
  now = Date.now(),
): string {
  let candidate: string | null = null;
  try {
    candidate = sessionStorage.getItem(EDITOR_TAB_ID_KEY);
  } catch { /* Session storage can be unavailable in restricted browser contexts. */ }

  if (!candidate || candidate.length > 128 || !refreshEditorTabLease(sharedStorage, candidate, ownerId, now)) {
    candidate = null;
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const nextCandidate = createId();
      if (refreshEditorTabLease(sharedStorage, nextCandidate, ownerId, now)) {
        candidate = nextCandidate;
        break;
      }
    }
    // If browser storage is unavailable, keep editing with an in-memory id.
    // Local draft persistence is unavailable in that browser context as well.
    if (!candidate) candidate = createId();
  }

  try { sessionStorage.setItem(EDITOR_TAB_ID_KEY, candidate); } catch { /* Keep the in-memory claim if storage is unavailable. */ }
  return candidate;
}

export function releaseEditorTabLease(storage: StorageLike, tabId: string, ownerId: string): void {
  try {
    const key = editorTabLeaseKey(tabId);
    const current = storage.getItem(key);
    if (!current) return;
    const lease = JSON.parse(current) as { ownerId?: unknown };
    if (lease.ownerId === ownerId) storage.removeItem(key);
  } catch { /* Stale leases expire if browser storage is unavailable. */ }
}

export function getNoteDraftKey(userId: string, noteId: string, tabId?: string): string {
  const key = `${DRAFT_KEY_PREFIX}:${encodeURIComponent(userId)}:${encodeURIComponent(noteId)}`;
  return tabId ? `${key}:tab:${encodeURIComponent(tabId)}` : key;
}

function isNoteDraftRecord(value: unknown, userId: string, noteId: string, tabId?: string): value is NoteDraftRecord {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<NoteDraftRecord>;
  return draft.userId === userId
    && draft.noteId === noteId
    && draft.tabId === tabId
    && typeof draft.title === "string"
    && typeof draft.content === "string"
    && typeof draft.baseTitle === "string"
    && typeof draft.baseContent === "string"
    && (draft.folderId === undefined || draft.folderId === null || typeof draft.folderId === "string")
    && (draft.tabId === undefined || typeof draft.tabId === "string")
    && (draft.editorTabId === undefined || typeof draft.editorTabId === "string")
    && Number.isInteger(draft.baseRevision)
    && (draft.baseRevision as number) >= -1
    && typeof draft.updatedAt === "string";
}

export function readNoteDraft(storage: StorageLike, userId: string, noteId: string, tabId?: string): NoteDraftRecord | null {
  const key = getNoteDraftKey(userId, noteId, tabId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isNoteDraftRecord(parsed, userId, noteId, tabId)) return parsed;
    storage.removeItem(key);
  } catch {
    try { storage.removeItem(key); } catch { /* Storage can be disabled or full. */ }
  }
  return null;
}

export function listNoteDrafts(storage: StorageLike, userId: string): NoteDraftRecord[] {
  if (typeof storage.key !== "function" || typeof storage.length !== "number") return [];
  const prefix = `${DRAFT_KEY_PREFIX}:${encodeURIComponent(userId)}:`;
  const drafts: NoteDraftRecord[] = [];
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key?.(index));
  for (const key of keys) {
    if (!key?.startsWith(prefix)) continue;
    try {
      const suffix = key.slice(prefix.length);
      const tabMarker = suffix.lastIndexOf(":tab:");
      const encodedNoteId = tabMarker === -1 ? suffix : suffix.slice(0, tabMarker);
      const tabId = tabMarker === -1 ? undefined : decodeURIComponent(suffix.slice(tabMarker + 5));
      const noteId = decodeURIComponent(encodedNoteId);
      const draft = readNoteDraft(storage, userId, noteId, tabId);
      if (draft) drafts.push(draft);
    } catch {
      try { storage.removeItem(key); } catch { /* Ignore invalid or unavailable storage entries. */ }
    }
  }
  return drafts.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function selectNoteDraftForEditor(drafts: NoteDraftRecord[], ownerId: string, editorTabId: string): NoteDraftRecord | null {
  return drafts.find((draft) => draft.tabId === ownerId)
    ?? drafts.find((draft) => {
      const storedEditorTabId = draft.editorTabId ?? (draft.tabId === ownerId ? undefined : draft.tabId);
      return storedEditorTabId === editorTabId;
    })
    ?? drafts[0]
    ?? null;
}

export function isNoteDraftFromCurrentEditor(
  draft: NoteDraftRecord,
  ownerId: string,
  editorTabId: string,
  ownsEditorTabLease: boolean,
  matchingEditorTabDraftCount = 1,
): boolean {
  if (!draft.tabId || draft.tabId === ownerId) return true;
  const storedEditorTabId = draft.editorTabId ?? draft.tabId;
  return ownsEditorTabLease && matchingEditorTabDraftCount === 1 && storedEditorTabId === editorTabId;
}

export function saveNoteDraft(storage: StorageLike, draft: NoteDraftRecord): void {
  storage.setItem(getNoteDraftKey(draft.userId, draft.noteId, draft.tabId), JSON.stringify(draft));
}

export function discardNoteDraft(storage: StorageLike, userId: string, noteId: string, tabId?: string): void {
  storage.removeItem(getNoteDraftKey(userId, noteId, tabId));
}

export function discardNoteDrafts(storage: StorageLike, userId: string, noteId: string): void {
  for (const draft of listNoteDrafts(storage, userId)) {
    if (draft.noteId === noteId) storage.removeItem(getNoteDraftKey(userId, noteId, draft.tabId));
  }
}
