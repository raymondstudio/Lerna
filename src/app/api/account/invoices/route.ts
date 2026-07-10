import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInvoices } from "@/lib/repositories/billing";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const invoices = await getInvoices(user.id);

    return NextResponse.json({
      success: true,
      invoices,
    });
  } catch (err) {
    console.error("[api:account:invoices] Error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
