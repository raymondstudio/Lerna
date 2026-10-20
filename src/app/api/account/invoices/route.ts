import { NextResponse } from "next/server";
import { authorizeActiveUserApi } from "@/lib/auth/require-active-user-api";
import { getInvoices } from "@/lib/repositories/billing";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorizeActiveUserApi();
  if (!auth.ok) return auth.response;
  try {
    const invoices = await getInvoices(auth.user.id);

    return NextResponse.json({
      success: true,
      invoices,
    });
  } catch {
    console.error("[api:account:invoices] fetch failed");
    return NextResponse.json({ success: false, error: "Invoices could not be loaded." }, { status: 503 });
  }
}
