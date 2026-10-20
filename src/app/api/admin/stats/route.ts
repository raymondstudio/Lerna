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
      console.error("[api:admin:stats] RPC failed:", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[api:admin:stats] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

