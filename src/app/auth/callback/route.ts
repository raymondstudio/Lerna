import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient, type SupabaseCookieStore } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const url = request.nextUrl;
  const nextPath = url.searchParams.get("next") ?? "/chat";
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const code = url.searchParams.get("code");

  // ── Diagnostic: log everything Supabase/Google sent us ──────────────────────
  console.info("[auth:callback] ▶ REQUEST RECEIVED", {
    requestId,
    fullUrl: url.toString(),
    pathname: url.pathname,
    code: code ? `${code.slice(0, 8)}...` : null,  // safe: first 8 chars only
    hasCode: Boolean(code),
    error,
    errorDescription,
    nextPath,
    allParams: Object.fromEntries(url.searchParams.entries()),
  });
  // ─────────────────────────────────────────────────────────────────────────────

  if (error) {
    console.warn("[auth:callback] ⚠️ OAuth error returned from provider", {
      requestId,
      error,
      errorDescription,
    });

    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("auth", "login");
    loginUrl.searchParams.set("error", errorDescription ?? error);
    loginUrl.searchParams.set("redirectTo", nextPath);

    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Cache-Control", "private, no-store");

    return response;
  }

  if (!code) {
    console.warn("[auth:callback] ⚠️ No code param present", { requestId, nextPath });

    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("auth", "login");
    loginUrl.searchParams.set("error", "Missing OAuth code.");
    loginUrl.searchParams.set("redirectTo", nextPath);

    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Cache-Control", "private, no-store");

    return response;
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  response.headers.set("Cache-Control", "private, no-store");

  try {
    console.info("[auth:callback] ⌛ exchangeCodeForSession starting", { requestId });

    const supabase = await createSupabaseServerClient({
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set({ name, value, ...options });
        });
      },
    });

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      // ── DIAGNOSTIC: expose the REAL error, not a generic message ────────────
      console.error("[auth:callback] ❌ exchangeCodeForSession FAILED", {
        requestId,
        errorMessage: exchangeError.message,
        errorName: exchangeError.name,
        errorStatus: (exchangeError as any)?.status ?? null,
        errorCode: (exchangeError as any)?.code ?? null,
        fullError: JSON.stringify(exchangeError),
      });
      // ────────────────────────────────────────────────────────────────────────

      const loginUrl = new URL("/", request.url);
      loginUrl.searchParams.set("auth", "login");
      // In development: show real error. In production: keep generic.
      const publicError =
        process.env.NODE_ENV === "development"
          ? `[DEV] Exchange failed: ${exchangeError.message}`
          : "Google sign-in failed. Please try again.";
      loginUrl.searchParams.set("error", publicError);
      loginUrl.searchParams.set("redirectTo", nextPath);

      return NextResponse.redirect(loginUrl);
    }

    console.info("[auth:callback] ✅ exchangeCodeForSession SUCCESS", {
      requestId,
      userId: data.user?.id ?? "(no user)",
      hasSession: Boolean(data.session),
      sessionExpiresAt: data.session?.expires_at ?? null,
      nextPath,
    });

    return response;
  } catch (callbackError) {
    console.error("[auth:callback] 💥 UNEXPECTED exception", {
      requestId,
      error: callbackError instanceof Error
        ? { message: callbackError.message, stack: callbackError.stack }
        : callbackError,
    });

    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("auth", "login");
    loginUrl.searchParams.set(
      "error",
      process.env.NODE_ENV === "development"
        ? `[DEV] Unexpected: ${callbackError instanceof Error ? callbackError.message : String(callbackError)}`
        : "Unable to finish Google sign-in."
    );
    loginUrl.searchParams.set("redirectTo", nextPath);

    return NextResponse.redirect(loginUrl);
  }
}
