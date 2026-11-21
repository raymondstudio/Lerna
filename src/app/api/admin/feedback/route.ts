import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { OperationError } from "@/lib/repositories/operations";
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

    return NextResponse.json({ success: true, data: formatted }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("[api:admin:feedback:GET] failed");
    return NextResponse.json({ success: false, error: "Feedback could not be loaded." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}

export async function PUT(req: Request) {
  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

  try {
    const body = await readBoundedJson(req, 16_384);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: "Invalid feedback update." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }
    const { feedbackId, status, adminNotes } = body as Record<string, unknown>;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (typeof feedbackId !== "string" || !uuid.test(feedbackId)) {
      return NextResponse.json({ success: false, error: "A valid feedback ID is required." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }
    if (status !== undefined && (typeof status !== "string" || !["new", "under-review", "under_review", "planned", "in-progress", "in_progress", "completed", "declined", "rejected"].includes(status))) {
      return NextResponse.json({ success: false, error: "Invalid feedback status." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }
    if (adminNotes !== undefined && (typeof adminNotes !== "string" || adminNotes.length > 10_000)) {
      return NextResponse.json({ success: false, error: "Admin notes must be up to 10,000 characters." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }

    const updatePayload: Record<string, unknown> = {};
    if (status !== undefined) updatePayload.status = status;
    if (adminNotes !== undefined) updatePayload.admin_notes = adminNotes;
    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ success: false, error: "Choose a feedback field to update." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }
    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("feedback")
      .update(updatePayload)
      .eq("id", feedbackId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof OperationError && error.status >= 400 && error.status < 500) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("[api:admin:feedback:PUT] failed");
    return NextResponse.json({ success: false, error: "Feedback could not be updated." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
