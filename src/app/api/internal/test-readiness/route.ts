export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** E2E preflight: refuse a live-provider app before a browser sends a prompt. */
export async function GET() {
  if (process.env.NODE_ENV === "production" || process.env.LERNA_TEST_MODE !== "local") {
    return new Response(null, { status: 404 });
  }
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "ELASTICSEARCH_URL"]) {
    const value = process.env[key];
    if (!value) continue;
    try {
      const url = new URL(value);
      if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.username || url.password) return new Response(null, { status: 404 });
    } catch { return new Response(null, { status: 404 }); }
  }
  return Response.json({ local: true, provider: "mock" }, { headers: { "Cache-Control": "no-store" } });
}
