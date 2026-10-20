import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseKey, getSupabaseUrl } from "@/lib/supabase/config";

type CookieToSet = { name: string; value: string; options: Record<string, unknown> };
const PROTECTED_PATHS = ["/chat", "/materials", "/schedule", "/progress", "/courses", "/study", "/quiz", "/account", "/admin", "/onboarding", "/welcome"];
const isProtectedPath = (pathname: string) => PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
const noStore = (response: NextResponse) => {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
};

export async function proxy(request: NextRequest) {
  let response = noStore(NextResponse.next({ request }));
  const finish = (target: NextResponse) => {
    response.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
    return noStore(target);
  };
  const supabaseUrl = getSupabaseUrl();
  const key = getSupabaseKey();
  if (!supabaseUrl || !key) {
    return finish(NextResponse.json({ error: "Authentication is temporarily unavailable." }, { status: 503 }));
  }

  const supabase = createServerClient(supabaseUrl, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies: CookieToSet[]) {
        const priorCookies = response.cookies.getAll();
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = noStore(NextResponse.next({ request }));
        priorCookies.forEach((cookie) => response.cookies.set(cookie));
        cookies.forEach(({ name, value, options }) => response.cookies.set({ name, value, ...options }));
      },
    },
  });

  try {
    // getUser validates identity with Auth; cookie contents alone never authorize.
    const { data, error } = await supabase.auth.getUser();
    const user = error ? null : data.user;
    const pathname = request.nextUrl.pathname;
    if (isProtectedPath(pathname) && !user) {
      const login = new URL("/", request.url);
      login.searchParams.set("auth", "login");
      login.searchParams.set("redirectTo", `${pathname}${request.nextUrl.search}`);
      return finish(NextResponse.redirect(login));
    }
    if (isProtectedPath(pathname) && user) {
      const { data: active, error: activeError } = await supabase.rpc("is_active_user", { user_id: user.id });
      if (activeError) return finish(NextResponse.json({ error: "Account verification is temporarily unavailable." }, { status: 503 }));
      if (active !== true) {
        const login = new URL("/", request.url);
        login.searchParams.set("auth", "login");
        login.searchParams.set("error", "Account unavailable. Contact support.");
        return finish(NextResponse.redirect(login));
      }
    }
    if (["/login", "/signup"].includes(pathname) && user) return finish(NextResponse.redirect(new URL("/chat", request.url)));
    return response;
  } catch {
    return finish(NextResponse.json({ error: "Authentication is temporarily unavailable." }, { status: 503 }));
  }
}

// Auth callback, recovery and MFA perform their own validation; never intercept PKCE.
export const config = {
  matcher: ["/chat/:path*", "/materials/:path*", "/schedule/:path*", "/progress/:path*", "/courses/:path*", "/study/:path*", "/quiz/:path*", "/account/:path*", "/admin/:path*", "/onboarding/:path*", "/welcome/:path*", "/login", "/signup"],
};
