export type NotePatch = { title?: string; content?: string; folderId?: string | null };
export type EditableNote = {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  revision: number;
  [key: string]: unknown;
};
type PersistNote = (id: string, patch: NotePatch, revision: number) => Promise<EditableNote>;

/** Serializes writes per note; only server-confirmed revisions become current. */
export class NoteWriteCoordinator {
  private readonly revisions = new Map<string, number>();
  private readonly notes = new Map<string, EditableNote>();
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(
    private readonly persist: PersistNote,
    private readonly onSaved?: (note: EditableNote) => void,
    private readonly onFailure?: (id: string, error: Error) => void,
  ) {}

  observeRevision(id: string, revision: number): void {
    if (!Number.isInteger(revision) || revision < 0) return;
    const current = this.revisions.get(id);
    if (current === undefined || revision > current) {
      this.revisions.set(id, revision);
      const note = this.notes.get(id);
      if (note && note.revision < revision) this.notes.delete(id);
    }
  }

  observeNote(note: EditableNote): boolean {
    const current = this.revisions.get(note.id);
    if (!Number.isInteger(note.revision) || (current !== undefined && note.revision < current)) return false;
    this.revisions.set(note.id, note.revision);
    this.notes.set(note.id, note);
    return true;
  }

  getNote(id: string): EditableNote | undefined { return this.notes.get(id); }

  hasFreshNote(id: string, revision?: number): boolean {
    const note = this.notes.get(id);
    if (!note) return false;
    if (revision !== undefined && note.revision !== revision) return false;
    return true;
  }

  write(id: string, change: NotePatch | ((current: EditableNote) => NotePatch)): Promise<EditableNote> {
    const previous = this.queues.get(id) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      const revision = this.revisions.get(id);
      if (revision === undefined) throw new Error("Note version is unavailable; reload the note before saving");
      const current = this.notes.get(id);
      if (typeof change === "function" && !current) throw new Error("Note content is unavailable; reload before editing");
      const patch = typeof change === "function" ? change(current!) : change;
      const saved = await this.persist(id, patch, revision);
      if (!Number.isInteger(saved.revision) || saved.revision <= revision) throw new Error("Invalid saved note revision");
      if (!this.observeNote(saved)) throw new Error("A newer note version is available; reload before editing");
      this.onSaved?.(saved);
      return saved;
    }).catch((cause: unknown) => {
      const error = cause instanceof Error ? cause : new Error("Could not save note");
      this.onFailure?.(id, error);
      throw error;
    });
    const tracked = operation.finally(() => {
      if (this.queues.get(id) === tracked) this.queues.delete(id);
    });
    this.queues.set(id, tracked);
    return tracked;
  }
}
