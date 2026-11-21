import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function recoveryRpc(name: string, args: Record<string, string>): Promise<boolean> {
  const { data, error } = await createSupabaseAdminClient().rpc(name, args);
  if (error) throw new Error("Recovery persistence is temporarily unavailable.");
  return data === true;
}
export function createRecoveryIntent(args: { p_nonce_hash: string; p_browser_hash: string; p_email_hash: string; p_rate_key: string }) {
  return recoveryRpc("create_recovery_intent", args);
}
export function authorizeRecoveryIntent(args: { p_nonce_hash: string; p_browser_hash: string; p_email_hash: string; p_user_id: string; p_session_id: string; p_proof_hash: string }) {
  return recoveryRpc("authorize_recovery_intent", args);
}
export function consumeRecoveryProof(args: { p_proof_hash: string; p_user_id: string; p_session_id: string }) {
  return recoveryRpc("consume_recovery_proof", args);
}
export function validateRecoveryProof(args: { p_proof_hash: string; p_user_id: string; p_session_id: string }) {
  return recoveryRpc("validate_recovery_proof", args);
}
