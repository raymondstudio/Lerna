import { sanitizeAuthReturnPath } from "@/lib/auth/return-path";
import { getAppUrl } from "@/lib/supabase/config";

export function buildOAuthRedirectUrl(nextPath = "/chat") {
  const origin = getAppUrl();
  if (!origin) throw new Error("The application origin is unavailable. Please retry.");
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", sanitizeAuthReturnPath(nextPath));
  return callback.toString();
}
