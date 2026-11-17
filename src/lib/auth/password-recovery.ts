import type { SupabaseClient } from "@supabase/supabase-js";

export function validRecoveryPassword(password: string) {
  return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password)
    && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
}

export async function completePasswordRecovery(supabase: SupabaseClient, password: string) {
  if (!validRecoveryPassword(password)) throw new Error("Use at least 8 characters, including uppercase, lowercase, a number and a special character.");
  // Retain the existing caller signature; an ambient browser session is never recovery proof.
  void supabase;
  const response = await fetch("/api/auth/recovery/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error ?? "Your recovery session expired. Request a new link.");
  return { signedOut: result.signedOut === true };
}
