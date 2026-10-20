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
    });
  } catch (err) {
    console.error("[api:admin:transactions] Error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
