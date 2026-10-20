export const MAX_NOTE_BYTES = 100_000;

export type NoteSnapshot = { id: string; notes?: string; notesRevision?: number; notesUpdatedAt?: string };
export type NoteOperation = { notes: string; expectedNotesRevision: number; operationId: string };
export type NoteReceipt = { session: NoteSnapshot; noteWrite: { operationId: string; appliedRevision: number; replayed: boolean } };
export type NoteDraft = { version: 1; content: string; baseContent: string; baseRevision: number; savedAt: number; operation?: NoteOperation };
export type NoteSaveState = {
  value: string;
  status: "saved" | "unsaved" | "saving" | "failed" | "conflict";
  error: string | null;
  conflict: NoteSnapshot | null;
  revision: number;
};

export class NoteSaveError extends Error {
  constructor(message: string, public status = 0, public current?: NoteSnapshot, public retryAfterMs?: number) { super(message); }
}

type Options = {
  save: (operation: NoteOperation) => Promise<NoteReceipt>;
  changed: (state: NoteSaveState, draft: NoteDraft | null) => void;
  saved?: (session: NoteSnapshot) => void;
  newId?: () => string;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
  delay?: (ms: number) => Promise<void>;
};

/** One writer per mounted note. Revisions belong to note content, never chat activity. */
export class NoteSaveController {
  private base: string;
  private state: NoteSaveState;
  private operation?: NoteOperation;
  private pending: Promise<boolean> | null = null;
  private debounce?: ReturnType<typeof setTimeout>;
  private maximum?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private readonly timer: NonNullable<Options["setTimer"]>;
  private readonly clear: NonNullable<Options["clearTimer"]>;

  constructor(private remote: NoteSnapshot, private options: Options, recovered?: NoteDraft | null) {
    this.base = remote.notes ?? "";
    this.state = { value: this.base, revision: remote.notesRevision ?? 0, status: "saved", error: null, conflict: null };
    this.timer = options.setTimer ?? setTimeout;
    this.clear = options.clearTimer ?? clearTimeout;
    if (recovered && recovered.content !== this.base) {
      this.base = recovered.baseContent;
      this.state.value = recovered.content;
      this.state.revision = recovered.baseRevision;
      this.operation = recovered.operation;
      if (recovered.baseRevision !== (remote.notesRevision ?? 0) && !this.operation) {
        this.state.status = "conflict";
        this.state.conflict = remote;
        this.state.error = "A newer version is saved. Your recovered draft is still here.";
      } else {
        this.state.status = "unsaved";
      }
    }
  }

  getSnapshot = (): NoteSaveState => ({ ...this.state });
  getDraft = (): NoteDraft | null => this.state.status === "saved" ? null : ({
    version: 1, content: this.state.value, baseContent: this.base,
    baseRevision: this.state.revision, savedAt: (this.options.now ?? Date.now)(), operation: this.operation,
  });

  private publish() {
    if (!this.disposed) this.options.changed(this.getSnapshot(), this.getDraft());
  }
  private stopTimers() {
    if (this.debounce !== undefined) this.clear(this.debounce);
    if (this.maximum !== undefined) this.clear(this.maximum);
    this.debounce = undefined;
    this.maximum = undefined;
  }

  edit(value: string) {
    this.state.value = value;
    if (this.state.status !== "conflict") {
      // An ambiguous operation must be acknowledged before a newer edit can save.
      this.state.status = value === this.base && !this.operation ? "saved" : this.pending ? "saving" : "unsaved";
      this.state.error = null;
    }
    this.publish();
    if (this.state.status === "saved") this.stopTimers();
    else if (this.state.status !== "conflict") this.schedule();
  }

  schedule() {
    if (this.disposed || this.state.status === "conflict" || this.state.status === "saved") return;
    if (this.debounce !== undefined) this.clear(this.debounce);
    this.debounce = this.timer(() => { void this.flush(); }, 750);
    if (this.maximum === undefined) this.maximum = this.timer(() => { void this.flush(); }, 5_000);
  }

  /** Never replace a dirty draft with a background response. */
  hydrate(remote: NoteSnapshot) {
    if (this.disposed || remote.id !== this.remote.id) return;
    if ((remote.notesRevision ?? 0) < (this.remote.notesRevision ?? 0)) return;
    this.remote = remote;
    if (this.pending) return;
    if (this.state.status === "saved" || this.state.value === (remote.notes ?? "")) {
      this.base = remote.notes ?? "";
      this.state = { value: this.base, revision: remote.notesRevision ?? 0, status: "saved", error: null, conflict: null };
      this.operation = undefined;
      this.stopTimers();
    } else if ((remote.notesRevision ?? 0) !== this.state.revision && !this.operation) {
      this.stopTimers();
      this.state.status = "conflict";
      this.state.conflict = remote;
      this.state.error = "This note changed in another tab. Your draft has been kept.";
    }
    this.publish();
  }

  useSavedVersion() {
    const remote = this.state.conflict;
    if (!remote || this.pending) return;
    this.operation = undefined;
    this.base = remote.notes ?? "";
    this.state = { value: this.base, revision: remote.notesRevision ?? 0, status: "saved", error: null, conflict: null };
    this.remote = remote;
    this.publish();
  }

  async keepDraftAndSave() {
    const remote = this.state.conflict;
    if (!remote || this.pending) return false;
    this.operation = undefined;
    this.base = remote.notes ?? "";
    this.state.revision = remote.notesRevision ?? 0;
    this.state.conflict = null;
    this.state.error = null;
    this.state.status = "unsaved";
    this.remote = remote;
    return this.flush();
  }

  recoverVersion(content: string) {
    if (this.pending || this.state.status !== "saved" || this.disposed) return;
    this.stopTimers();
    this.state.value = content;
    this.state.status = "conflict";
    this.state.conflict = this.remote;
    this.state.error = "Earlier version loaded as a draft. Compare it with the saved note, then choose which to keep.";
    this.publish();
  }

  flush(): Promise<boolean> {
    this.stopTimers();
    if (this.disposed || this.state.status === "conflict") return Promise.resolve(false);
    if (this.pending) return this.pending;
    if (this.state.value === this.base && !this.operation) {
      this.state.status = "saved";
      this.publish();
      return Promise.resolve(true);
    }
    this.pending = this.writeUntilCurrent().finally(() => { this.pending = null; });
    return this.pending;
  }

  private async writeUntilCurrent(): Promise<boolean> {
    while (!this.disposed) {
      this.operation ??= {
        notes: this.state.value, expectedNotesRevision: this.state.revision,
        operationId: (this.options.newId ?? (() => crypto.randomUUID()))(),
      };
      const operation = this.operation;
      if (new TextEncoder().encode(operation.notes).byteLength > MAX_NOTE_BYTES) {
        this.state.status = "failed";
        this.state.error = "This note exceeds 100,000 bytes. Shorten it before saving.";
        this.operation = undefined;
        this.publish();
        return false;
      }
      this.state.status = "saving";
      this.state.error = null;
      this.publish(); // Persist retry identity before the request can commit.
      let receipt: NoteReceipt | undefined;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          receipt = await this.options.save(operation);
          break;
        } catch (caught) {
          const error = caught instanceof NoteSaveError ? caught : new NoteSaveError("The connection was interrupted. Your draft is still here.");
          if (this.disposed) return false;
          if (error.status === 409 && error.current) {
            this.remote = error.current;
            this.state.status = "conflict";
            this.state.conflict = error.current;
            this.state.error = "A newer version is saved. Compare it before saving your draft.";
            this.operation = undefined;
            this.publish();
            return false;
          }
          const retryable = error.status === 0 || error.status === 429 || error.status >= 500;
          if (attempt < 3 && retryable) {
            const backoff = error.retryAfterMs ?? (1_000 * 2 ** attempt + Math.floor(Math.random() * 200));
            await (this.options.delay ?? (ms => new Promise(resolve => setTimeout(resolve, ms))))(Math.min(30_000, backoff));
            if (this.disposed) return false;
            continue;
          }
          this.state.status = "failed";
          this.state.error = error.message;
          // Retain an ambiguous operation across manual retries and reloads.
          if (!retryable) this.operation = undefined;
          this.publish();
          return false;
        }
      }
      if (!receipt || this.disposed) return false;
      if (receipt.noteWrite.operationId !== operation.operationId || !Number.isSafeInteger(receipt.session.notesRevision)) {
        this.state.status = "failed";
        this.state.error = "The server did not confirm this save. Retry to check its outcome.";
        this.publish();
        return false;
      }
      // A focus revalidation may arrive before an older save response. Keep the newest known revision.
      const current = (this.remote.notesRevision ?? 0) > (receipt.session.notesRevision ?? 0) ? this.remote : receipt.session;
      this.remote = current;
      this.operation = undefined;
      this.base = current.notes ?? "";
      this.state.revision = current.notesRevision ?? 0;
      this.options.saved?.(current);
      if (this.state.revision !== receipt.noteWrite.appliedRevision && this.state.value !== this.base) {
        this.state.status = "conflict";
        this.state.conflict = current;
        this.state.error = "Your earlier save succeeded, then another tab saved a newer version. Your draft is kept.";
        this.publish();
        return false;
      }
      if (this.state.value === this.base) {
        this.state.status = "saved";
        this.state.error = null;
        this.state.conflict = null;
        this.publish();
        return true;
      }
      // The draft changed during this request. Serialize its next revision.
      this.publish();
    }
    return false;
  }

  dispose() { this.disposed = true; this.stopTimers(); }
}
