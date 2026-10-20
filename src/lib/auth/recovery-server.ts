import { createHash, createHmac, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthRequestOrigin } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeRecoveryIntent, createRecoveryIntent, consumeRecoveryProof, validateRecoveryProof } from "@/lib/repositories/recovery";
import { MaterialBoundaryError, readBoundedBody } from "@/lib/uploads/validation";
import { validRecoveryPassword } from "@/lib/auth/password-recovery";

export const RECOVERY_BROWSER_COOKIE = "lerna-recovery-browser";
export const RECOVERY_PROOF_COOKIE = "lerna-recovery-proof";
const SECRET_PATTERN = /^[a-zA-Z0-9_-]{43}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GENERIC_RECOVERY_MESSAGE = "If an account can receive recovery email, a link will arrive shortly. Check your inbox.";
export class RecoveryError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export function recoveryHash(secret: string) { return createHash("sha256").update(secret).digest("hex"); }
export function recoveryEmailHash(email: string, nonce: string) { return createHmac("sha256", nonce).update(email.trim().toLowerCase()).digest("hex"); }
function cookieOptions(requestUrl: string, maxAge: number) {
  return { httpOnly: true, secure: new URL(requestUrl).protocol === "https:", sameSite: "lax" as const, path: "/", maxAge };
}
function deny(message = "This recovery link is invalid or expired. Request a new link."): never { throw new RecoveryError(message, 401); }
function requireSameOrigin(request: Request) {
  const trustedOrigin = getAuthRequestOrigin(request.url);
  if (new URL(request.url).origin !== trustedOrigin || request.headers.get("origin") !== trustedOrigin) throw new RecoveryError("Recovery requests must originate from this application.", 403);
  return trustedOrigin;
}
export async function readRecoveryBody(request: Request, timeoutMs = 30_000): Promise<Record<string, unknown>> {
  let bytes: Buffer;
  try { bytes = await readBoundedBody(request, 4096, timeoutMs); }
  catch (error) {
    if (error instanceof MaterialBoundaryError) throw new RecoveryError(error.message, error.status);
    throw new RecoveryError("Recovery request could not be read.");
  }
  try {
    const body: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new RecoveryError("Invalid request body."); }
}

function response(body: object, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } }); }
export function recoveryFailure(error: unknown) { return response({ success: false, error: error instanceof RecoveryError ? error.message : "Recovery is temporarily unavailable. Request a new link and try again." }, error instanceof RecoveryError ? error.status : 503); }
async function cookieClient(request: NextRequest, output: NextResponse) {
  return createSupabaseServerClient({ getAll: () => request.cookies.getAll(), setAll(values) { values.forEach(({ name, value, options }) => output.cookies.set({ name, value, ...options })); } });
}
export async function verifiedRecoveryIdentity(supabase: SupabaseClient, accessToken?: string) {
  let token = accessToken;
  if (!token) { const { data, error } = await supabase.auth.getSession(); if (error || !data.session) deny(); token = data.session.access_token; }
  const [{ data, error }, claimsResult] = await Promise.all([supabase.auth.getUser(token), supabase.auth.getClaims(token)]);
  const claims = claimsResult.data?.claims;
  if (error || !data.user || claimsResult.error || !claims || claims.sub !== data.user.id || !UUID.test(String(claims.session_id ?? ""))) deny();
  return { userId: data.user.id, email: data.user.email ?? "", sessionId: String(claims.session_id) };
}
export async function initiateRecovery(request: NextRequest) {
  try {
    const origin = requireSameOrigin(request);
    const body = await readRecoveryBody(request);
    if (Object.keys(body).length !== 1 || typeof body.email !== "string" || body.email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) throw new RecoveryError("Enter a valid email address.");
    const email = body.email.trim().toLowerCase();
    const existing = request.cookies.get(RECOVERY_BROWSER_COOKIE)?.value;
    const browser = existing && SECRET_PATTERN.test(existing) ? existing : randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    const accepted = await createRecoveryIntent({ p_nonce_hash: recoveryHash(nonce), p_browser_hash: recoveryHash(browser), p_email_hash: recoveryEmailHash(email, nonce), p_rate_key: recoveryHash(email) });
    if (!accepted) throw new RecoveryError("Please wait before requesting another recovery email.", 429);
    const output = response({ success: true, message: GENERIC_RECOVERY_MESSAGE });
    output.cookies.set(RECOVERY_BROWSER_COOKIE, browser, cookieOptions(request.url, 1800));
    output.cookies.set(RECOVERY_PROOF_COOKIE, "", cookieOptions(request.url, 0));
    const client = await cookieClient(request, output);
    const callback = new URL("/auth/callback", origin); callback.searchParams.set("next", "/auth/reset-password"); callback.searchParams.set("recovery_nonce", nonce);
    // The nonce is delivered only through Auth's email redirect, never to the requester response.
    // Provider errors remain generic to avoid disclosing whether the address exists.
    try { await client.auth.resetPasswordForEmail(email, { redirectTo: callback.toString() }); } catch { /* Same public response for provider failures and unknown accounts. */ }
    return output;
  } catch (error) { return recoveryFailure(error); }
}
export async function grantRecoveryProof(request: NextRequest, output: NextResponse, supabase: SupabaseClient, accessToken: string) {
  const nonce = request.nextUrl.searchParams.get("recovery_nonce");
  const browser = request.cookies.get(RECOVERY_BROWSER_COOKIE)?.value;
  if (!nonce || !SECRET_PATTERN.test(nonce) || !browser || !SECRET_PATTERN.test(browser)) deny();
  const identity = await verifiedRecoveryIdentity(supabase, accessToken);
  if (!identity.email) deny();
  const proof = randomBytes(32).toString("base64url");
  const accepted = await authorizeRecoveryIntent({ p_nonce_hash: recoveryHash(nonce), p_browser_hash: recoveryHash(browser), p_email_hash: recoveryEmailHash(identity.email, nonce), p_user_id: identity.userId, p_session_id: identity.sessionId, p_proof_hash: recoveryHash(proof) });
  if (!accepted) deny();
  output.cookies.set(RECOVERY_PROOF_COOKIE, proof, cookieOptions(request.url, 900));
}
export async function assertRecoveryProof(supabase: SupabaseClient, proof: string | undefined) {
  if (!proof || !SECRET_PATTERN.test(proof)) deny();
  const identity = await verifiedRecoveryIdentity(supabase);
  if (!await validateRecoveryProof({ p_proof_hash: recoveryHash(proof), p_user_id: identity.userId, p_session_id: identity.sessionId })) deny();
  return identity;
}
export async function finishRecovery(request: NextRequest) {
  let output: NextResponse | null = null;
  try {
    requireSameOrigin(request);
    const body = await readRecoveryBody(request);
    if (Object.keys(body).length !== 1 || typeof body.password !== "string" || body.password.length > 1024 || !validRecoveryPassword(body.password)) throw new RecoveryError("Use at least 8 characters, including uppercase, lowercase, a number and a special character.");
    const proof = request.cookies.get(RECOVERY_PROOF_COOKIE)?.value;
    if (!proof || !SECRET_PATTERN.test(proof)) deny();
    output = response({ success: true });
    const client = await cookieClient(request, output);
    const identity = await verifiedRecoveryIdentity(client);
    if (!await consumeRecoveryProof({ p_proof_hash: recoveryHash(proof), p_user_id: identity.userId, p_session_id: identity.sessionId })) deny();
    // One provider attempt per consumed proof. An uncertain network outcome requires a new email.
    output.cookies.set(RECOVERY_PROOF_COOKIE, "", cookieOptions(request.url, 0));
    output.cookies.set(RECOVERY_BROWSER_COOKIE, "", cookieOptions(request.url, 0));
    const { error: updateError } = await client.auth.updateUser({ password: body.password });
    if (updateError) throw new RecoveryError("Password could not be updated. Request a new recovery link and try again.");
    let signedOut = false;
    try { signedOut = !(await client.auth.signOut({ scope: "global" })).error; } catch { /* Password is durable; sign-out failure is a separate outcome. */ }
    const result = response({ success: true, signedOut }); output.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
    return result;
  } catch (error) {
    const failure = recoveryFailure(error);
    // A rejected proof or failed password update must not forward any newly
    // refreshed Auth cookie. Keep only explicit proof/session removals.
    output?.cookies.getAll().forEach((cookie) => {
      if (cookie.value === "" || (cookie.maxAge !== undefined && cookie.maxAge <= 0)
        || (cookie.expires !== undefined && new Date(cookie.expires).getTime() <= Date.now())) {
        failure.cookies.set(cookie);
      }
    });
    return failure;
  }
}
