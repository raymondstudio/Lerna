import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: Record<string, unknown> };

const PROTECTED_PATHS = ["/chat", "/materials", "/schedule", "/progress", "/courses", "/study", "/quiz"];
const AUTH_PATHS = ["/login", "/signup"];

// NOTE: /auth/* must NEVER be session-checked. If middleware intercepts
// /auth/callback before exchangeCodeForSession runs, OAuth will always fail.
const EXCLUDED_PREFIXES = ["/auth/"];

function isExcludedPath(pathname: string) {
  return EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isAuthPath(pathname: string) {
  return AUTH_PATHS.includes(pathname);
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const pathname = request.nextUrl.pathname;

  // ── DIAGNOSTIC: confirm whether this middleware fires at all ─────────────────
  // IMPORTANT: Because this file is named proxy.ts and NOT middleware.ts, Next.js
  // does NOT execute it as edge middleware. If you never see "[auth:proxy]" in
  // your server logs, that confirms the middleware is entirely bypassed — and is
  // NOT the cause of the OAuth failure.
  console.info("[auth:proxy] middleware fired", {
    pathname,
    isExcluded: isExcludedPath(pathname),
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(supabaseAnonKey),
  });
  // ─────────────────────────────────────────────────────────────────────────────

  // Always pass /auth/* through without a session check.
  if (isExcludedPath(pathname)) {
    const passThrough = NextResponse.next({ request: { headers: request.headers } });
    passThrough.headers.set("Cache-Control", "private, no-store");
    return passThrough;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    const response = NextResponse.next({
      request: { headers: request.headers },
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  response.headers.set("Cache-Control", "private, no-store");

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set({ name, value, ...options });
        });
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (isProtectedPath(pathname) && !user) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("auth", "login");
    loginUrl.searchParams.set("redirectTo", pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.headers.set("Cache-Control", "private, no-store");
    return redirectResponse;
  }

  if (isAuthPath(pathname) && user) {
    const redirectResponse = NextResponse.redirect(new URL("/chat", request.url));
    redirectResponse.headers.set("Cache-Control", "private, no-store");
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/chat/:path*", "/materials/:path*", "/schedule/:path*", "/progress/:path*", "/courses/:path*", "/study/:path*", "/quiz/:path*", "/login", "/signup"],
};
