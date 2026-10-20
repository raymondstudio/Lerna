import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
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

    return NextResponse.json({ success: true, data: flags });
  } catch (err) {
    console.error("[api:admin:flags] GET error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authorization = await authorizeAdminApi({ requireMfa: true });
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

  try {
    const { key, enabled } = await req.json();

    if (typeof key !== "string" || typeof enabled !== "boolean") {
      return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
    }

    const { error } = await supabase
      .from("feature_flags")
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq("key", key);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api:admin:flags] POST error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
