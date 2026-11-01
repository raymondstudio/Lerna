import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

  try {
    const { data, error } = await supabase.rpc("get_admin_stats");
    
    if (error) {
      console.error("[api:admin:stats] RPC failed");
      return NextResponse.json({ success: false, error: "Statistics could not be loaded." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    }

    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("[api:admin:stats] failed");
    return NextResponse.json({ success: false, error: "Statistics could not be loaded." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}

