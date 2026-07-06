import { NextResponse } from "next/server";
import { searchInstitutions } from "@/lib/repositories/institutions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // API key/auth check
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";
    const type = searchParams.get("type") || undefined;
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!query.trim()) {
      return NextResponse.json({ success: true, data: [] });
    }

    const data = await searchInstitutions(query, type, limit);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[api:institutions:search] Error:", err);
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
