import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const { data: feedbacks, error } = await supabase
      .from("feedback")
      .select("id, type, message, rating, created_at")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: feedbacks });
  } catch (err) {
    console.error("[api:feedback:GET] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const { type, message, rating } = await req.json();

    if (!type || !message?.trim()) {
      return NextResponse.json({ success: false, error: "Type and message are required." }, { status: 400 });
    }

    if (!["general", "bug", "feature"].includes(type)) {
      return NextResponse.json({ success: false, error: "Invalid feedback type." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("feedback")
      .insert({
        user_id: userData.user.id,
        type,
        message: message.trim(),
        rating: rating ? parseInt(rating) : null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[api:feedback:POST] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
