import { AuthApiError, authApiErrorResponse, requireActiveUserApi } from "@/lib/auth/require-active-user-api";

// Keep the existing export so callers handle active-user and admin failures alike.
export { AuthApiError as AdminApiError } from "@/lib/auth/require-active-user-api";

export async function requireAdminApi(options: { requireMfa?: boolean } = {}) {
  const context = await requireActiveUserApi();
  try {
    const { data, error } = await context.supabase.rpc("is_admin", { user_id: context.user.id });
    if (error) throw new AuthApiError("Role verification is temporarily unavailable. Please retry.", 503, "AUTH_UNAVAILABLE");
    if (data !== true) throw new AuthApiError("You do not have access to this operation.", 403, "FORBIDDEN");
    if (options.requireMfa) {
      const { data: assurance, error: mfaError } = await context.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (mfaError) throw new AuthApiError("Security verification is temporarily unavailable. Please retry.", 503, "AUTH_UNAVAILABLE");
      if (assurance?.currentLevel !== "aal2") throw new AuthApiError("Verify your authenticator before continuing.", 403, "MFA_REQUIRED");
    }
    return context;
  } catch (error) {
    if (error instanceof AuthApiError) throw error;
    throw new AuthApiError("Role verification is temporarily unavailable. Please retry.", 503, "AUTH_UNAVAILABLE");
  }
}

export async function authorizeAdminApi(options: { requireMfa?: boolean } = {}) {
  try {
    return { ok: true as const, ...await requireAdminApi(options) };
  } catch (error) {
    return { ok: false as const, response: authApiErrorResponse(error) };
  }
}
