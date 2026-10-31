import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserAccountStats } from "@/lib/repositories/users";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", requestId },
        { status: 401 }
      );
    }

    const stats = await getUserAccountStats(user.id);
    return NextResponse.json({ success: true, data: stats, requestId });
  } catch (error) {
    console.error("[api:account:stats:GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch account stats", requestId },
      { status: 500 }
    );
  }
}
