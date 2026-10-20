import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

  try {
    const { data: feedbacks, error } = await supabase
      .from("feedback")
      .select(`
        id,
        type,
        message,
        rating,
        status,
        admin_notes,
        created_at,
        profiles (
          email,
          first_name,
          last_name
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formatted = feedbacks.map((f) => {
      const profile = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles;
      return {
      id: f.id,
      type: f.type,
      message: f.message,
      rating: f.rating,
      status: f.status || "under-review",
      admin_notes: f.admin_notes || "",
      created_at: f.created_at,
      user_email: profile?.email || "unknown",
      user_name: profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Unknown User"
      };
    });

    return NextResponse.json({ success: true, data: formatted });
  } catch (err) {
    console.error("[api:admin:feedback:GET] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

  try {
    const { feedbackId, status, adminNotes } = await req.json();

    if (!feedbackId) {
      return NextResponse.json({ success: false, error: "Feedback ID is required." }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {};
    if (status !== undefined) updatePayload.status = status;
    if (adminNotes !== undefined) updatePayload.admin_notes = adminNotes;
    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("feedback")
      .update(updatePayload)
      .eq("id", feedbackId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[api:admin:feedback:PUT] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
