function appOrigin(value: string) {
  const url = new URL(value);
  if (url.username || url.password || !["http:", "https:"].includes(url.protocol)) throw new Error("Invalid application origin.");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) throw new Error("Application origin must use HTTPS.");
  return url.origin;
}

export function getSupabaseUrl() { return process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""; }
export function getSupabaseDataApiUrl() { return process.env.NEXT_PUBLIC_SUPABASE_DATA_API_URL ?? ""; }
export function getSupabaseKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

export function getAppUrl() {
  // PKCE must start on the origin holding its verifier, including local/preview.
  if (typeof window !== "undefined") return appOrigin(window.location.origin);
  return process.env.NEXT_PUBLIC_APP_URL ? appOrigin(process.env.NEXT_PUBLIC_APP_URL) : "";
}

export function getAuthRequestOrigin(requestUrl: string) {
  const requestOrigin = appOrigin(requestUrl);
  if (["localhost", "127.0.0.1", "[::1]"].includes(new URL(requestOrigin).hostname)) return requestOrigin;
  const configured = getAppUrl();
  const preview = process.env.VERCEL_URL ? appOrigin(`https://${process.env.VERCEL_URL}`) : "";
  if (requestOrigin === configured || requestOrigin === preview) return requestOrigin;
  throw new Error("This authentication origin is not configured.");
}
