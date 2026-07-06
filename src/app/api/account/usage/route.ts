import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserQuotaUsage } from "@/lib/services/business";

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const usage = await getUserQuotaUsage(user.id);
    return NextResponse.json(usage);
  } catch (err) {
    console.error("[api:account:usage] Error fetching usage:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
