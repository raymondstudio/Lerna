import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { OperationError } from "@/lib/repositories/operations";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

  try {
    const { data: flags, error } = await supabase
      .from("feature_flags")
      .select("key, enabled, description, updated_at")
      .order("key", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: flags }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("[api:admin:flags] GET failed");
    return NextResponse.json({ success: false, error: "Feature flags could not be loaded." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}

export async function POST(req: Request) {
  const authorization = await authorizeAdminApi({ requireMfa: true });
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

  try {
    const body = await readBoundedJson(req, 4096);
    const { key, enabled } = (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Record<string, unknown>;

    if (typeof key !== "string" || !/^[a-z0-9_]{1,80}$/.test(key) || typeof enabled !== "boolean") {
      return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }

    const { error } = await supabase
      .from("feature_flags")
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq("key", key);

    if (error) throw error;

    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof OperationError && error.status >= 400 && error.status < 500) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("[api:admin:flags] POST failed");
    return NextResponse.json({ success: false, error: "Feature flag could not be updated." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
