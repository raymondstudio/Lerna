import { getAppUrl } from "@/lib/supabase/config";

export function buildOAuthRedirectUrl(nextPath = "/chat") {
  const appUrl = getAppUrl();

  console.info("[oauth:buildOAuthRedirectUrl] resolving redirect URL", {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "(not set — using window.location.origin)",
    resolvedAppUrl: appUrl || "(empty — CRITICAL: no origin available)",
    nextPath,
    windowOrigin: typeof window !== "undefined" ? window.location.origin : "(server context)",
  });

  if (!appUrl) {
    throw new Error("Missing app URL. Set NEXT_PUBLIC_APP_URL or use the browser origin.");
  }

  const callbackUrl = new URL("/auth/callback", appUrl);
  callbackUrl.searchParams.set("next", nextPath);

  console.info("[oauth:buildOAuthRedirectUrl] final redirectTo", {
    redirectTo: callbackUrl.toString(),
  });

  return callbackUrl.toString();
}
