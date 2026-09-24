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
    const query = (searchParams.get("query") || "").trim().slice(0, 120);
    const type = searchParams.get("type") || undefined;
    const requestedLimit = Number(searchParams.get("limit") || "20");
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 50) : 20;

    if (!query) {
      return NextResponse.json({ success: true, data: [] });
    }

    const data = await searchInstitutions(query, type, limit);
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    console.error("[api:institutions:search] Error:", err);
    return NextResponse.json({ success: false, error: "Institution search is temporarily unavailable." }, { status: 500 });
  }
}
