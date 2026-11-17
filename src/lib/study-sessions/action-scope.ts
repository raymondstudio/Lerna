/** Invalidates async continuations when their owning editor unmounts or remounts. */
export class StudyActionScope {
  private generation = 0;
  private active = false;
  activate() { this.active = true; this.generation++; }
  close() { this.active = false; this.generation++; }
  capture() {
    const generation = this.generation;
    return () => this.active && this.generation === generation;
  }
}

/** Every awaited boundary must retain the editor that initiated completion. */
export async function completeCurrentStudySession<T>(options: {
  isCurrent: () => boolean;
  flush: () => Promise<boolean>;
  save: () => Promise<T>;
  completed: (session: T) => void;
  summary: () => Promise<void>;
}): Promise<"completed" | "unsaved" | "obsolete"> {
  const saved = await options.flush();
  if (!options.isCurrent()) return "obsolete";
  if (!saved) return "unsaved";
  const session = await options.save();
  if (!options.isCurrent()) return "obsolete";
  options.completed(session);
  await options.summary();
  return options.isCurrent() ? "completed" : "obsolete";
}
