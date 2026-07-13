import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
  }

  const { data: isAdmin } = await supabase.rpc("is_admin", { user_id: userData.user.id });
  
  const adminEmails = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim())
    : ["msuraymond@gmail.com"];
  const isFallbackAdmin = userData.user.email && adminEmails.includes(userData.user.email);
  const isRoleAdmin = userData.user.app_metadata?.role === "admin";

  if (!isAdmin && !isFallbackAdmin && !isRoleAdmin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

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

    const formatted = feedbacks.map((f: any) => ({
      id: f.id,
      type: f.type,
      message: f.message,
      rating: f.rating,
      status: f.status || "under-review",
      admin_notes: f.admin_notes || "",
      created_at: f.created_at,
      user_email: f.profiles?.email || "unknown",
      user_name: f.profiles ? `${f.profiles.first_name || ""} ${f.profiles.last_name || ""}`.trim() : "Unknown User"
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (err) {
    console.error("[api:admin:feedback:GET] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
  }

  const { data: isAdmin } = await supabase.rpc("is_admin", { user_id: userData.user.id });
  
  const adminEmails = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim())
    : ["msuraymond@gmail.com"];
  const isFallbackAdmin = userData.user.email && adminEmails.includes(userData.user.email);
  const isRoleAdmin = userData.user.app_metadata?.role === "admin";

  if (!isAdmin && !isFallbackAdmin && !isRoleAdmin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { feedbackId, status, adminNotes } = await req.json();

    if (!feedbackId) {
      return NextResponse.json({ success: false, error: "Feedback ID is required." }, { status: 400 });
    }

    const updatePayload: any = {};
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
