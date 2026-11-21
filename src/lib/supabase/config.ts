const PRODUCTION_HOSTNAMES = new Set(["uselerna.app", "www.uselerna.app"]);

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
  if (process.env.NEXT_PUBLIC_APP_URL) return appOrigin(process.env.NEXT_PUBLIC_APP_URL);
  if (process.env.NEXT_PUBLIC_SITE_URL) return appOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (process.env.VERCEL_URL) return appOrigin(`https://${process.env.VERCEL_URL}`);
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") return "https://www.uselerna.app";
  return "";
}

export function getAuthRequestOrigin(requestUrl: string) {
  const requestOrigin = appOrigin(requestUrl);
  const parsedRequest = new URL(requestOrigin);
  if (["localhost", "127.0.0.1", "[::1]"].includes(parsedRequest.hostname)) return requestOrigin;

  // Lerna official production domains (both apex and www)
  if (parsedRequest.protocol === "https:" && PRODUCTION_HOSTNAMES.has(parsedRequest.hostname)) {
    return requestOrigin;
  }

  const configured = getAppUrl();
  if (configured) {
    if (requestOrigin === configured) return requestOrigin;
    const parsedConfigured = new URL(configured);
    const reqHost = parsedRequest.hostname.replace(/^www\./, "");
    const confHost = parsedConfigured.hostname.replace(/^www\./, "");
    if (reqHost === confHost && parsedRequest.protocol === parsedConfigured.protocol) {
      return requestOrigin;
    }
  }

  const preview = process.env.VERCEL_URL ? appOrigin(`https://${process.env.VERCEL_URL}`) : "";
  const branchPreview = process.env.VERCEL_BRANCH_URL ? appOrigin(`https://${process.env.VERCEL_BRANCH_URL}`) : "";
  if (preview && requestOrigin === preview) return requestOrigin;
  if (branchPreview && requestOrigin === branchPreview) return requestOrigin;

  throw new Error("This authentication origin is not configured.");
}
