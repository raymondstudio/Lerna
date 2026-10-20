import { NextResponse, type NextRequest } from "next/server";
import { sanitizeAuthReturnPath } from "@/lib/auth/return-path";
import { getAuthRequestOrigin } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { grantRecoveryProof, RECOVERY_PROOF_COOKIE } from "@/lib/auth/recovery-server";

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  let origin: string;
  try { origin = getAuthRequestOrigin(request.url); } catch {
    return NextResponse.json({ error: "Authentication is temporarily unavailable.", requestId }, {
      status: 503, headers: { "Cache-Control": "private, no-store" },
    });
  }
  let nextPath = sanitizeAuthReturnPath(request.nextUrl.searchParams.get("next"));
  // Preserve already-issued recovery links without sending recovery into chat.
  if (["/chat?auth=reset", "/?auth=reset"].includes(nextPath)) nextPath = "/auth/reset-password";
  const recovery = nextPath === "/auth/reset-password" || request.nextUrl.searchParams.has("recovery_nonce");
  if (recovery) nextPath = "/auth/reset-password";
  const response = NextResponse.redirect(new URL(nextPath, origin));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  const failed = () => {
    const login = new URL("/", origin);
    login.searchParams.set("auth", "login");
    login.searchParams.set("error", "This sign-in link is invalid or expired. Please try again.");
    login.searchParams.set("redirectTo", nextPath);
    const failure = NextResponse.redirect(login);
    // A failed recovery proof can happen after PKCE exchanged a valid code.
    // Never forward that newly issued Auth session to the browser on failure.
    // Retain only explicit cookie removals from a failed exchange.
    response.cookies.getAll().forEach((cookie) => {
      if (cookie.value === "" || (cookie.maxAge !== undefined && cookie.maxAge <= 0)
        || (cookie.expires !== undefined && new Date(cookie.expires).getTime() <= Date.now())) {
        failure.cookies.set(cookie);
      }
    });
    failure.headers.set("Cache-Control", "private, no-store");
    failure.headers.set("Referrer-Policy", "no-referrer");
    if (recovery) failure.cookies.set(RECOVERY_PROOF_COOKIE, "", { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 0 });
    return failure;
  };
  const code = request.nextUrl.searchParams.get("code");
  if (request.nextUrl.searchParams.has("error") || !code) return failed();
  try {
    const supabase = await createSupabaseServerClient({
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => response.cookies.set({ name, value, ...options }));
      },
    });
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user || !data.session) {
      console.warn("[auth:callback] exchange_failed", { requestId });
      return failed();
    }
    if (recovery) await grantRecoveryProof(request, response, supabase, data.session.access_token);
    return response;
  } catch {
    console.warn("[auth:callback] exchange_unavailable", { requestId });
    return failed();
  }
}
