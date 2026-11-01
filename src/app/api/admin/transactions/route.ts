import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

  try {
    const { data, error } = await supabase
      .from("billing_transactions")
      .select(`
        *,
        profiles(email, first_name, last_name)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      transactions: data || [],
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("[api:admin:transactions] failed");
    return NextResponse.json({ success: false, error: "Transactions could not be loaded." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
