type UnsavedWork = {
  isUnsaved: () => boolean;
  flush: () => Promise<boolean>;
  hasRecoveryDraft: () => boolean;
};
const work = new Set<UnsavedWork>();

/** Only mounted browser editors register; no content or identity is stored here. */
export function registerUnsavedWork(editor: UnsavedWork) {
  work.add(editor);
  return () => { work.delete(editor); };
}

/** AuthProvider must abort sign-out/navigation when this returns false. */
export async function confirmUnsavedWorkBeforeSignOut(
  confirm: (message: string) => boolean = message => typeof window !== "undefined" && window.confirm(message),
): Promise<boolean> {
  const starting = [...work];
  await Promise.allSettled(starting.filter(editor => editor.isUnsaved()).map(editor => editor.flush()));
  const remaining = [...new Set([...starting, ...work])].filter(editor => editor.isUnsaved());
  if (!remaining.length) return true;
  const recovery = remaining.every(editor => editor.hasRecoveryDraft());
  return confirm(recovery
    ? "Some notes could not be saved. Local recovery drafts are kept on this device for up to 24 hours. Sign out anyway?"
    : "Some notes could not be saved, and local recovery is unavailable for part of your work. Cancel and download a draft, or choose OK to sign out anyway.");
}
