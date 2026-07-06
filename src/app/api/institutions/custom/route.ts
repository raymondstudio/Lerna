import { NextResponse } from "next/server";
import { createCustomInstitution } from "@/lib/repositories/institutions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Auth validation
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { name, institution_type, state, country } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }
    if (!institution_type) {
      return NextResponse.json({ success: false, error: "Institution type is required" }, { status: 400 });
    }

    const data = await createCustomInstitution({
      name,
      institution_type,
      state: state || "",
      country: country || "Nigeria"
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[api:institutions:custom] Error:", err);
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
