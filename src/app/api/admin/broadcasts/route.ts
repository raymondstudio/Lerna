import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const { data: broadcasts, error } = await supabase
      .from("broadcasts")
      .select(`
        id, 
        title, 
        content, 
        sent_at, 
        created_at,
        status,
        target_audience,
        target_institution,
        target_department,
        scheduled_for,
        expires_at
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: broadcasts });
  } catch (err) {
    console.error("[api:admin:broadcasts:GET] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
  }

  const { data: isAdmin } = await supabase.rpc("is_admin", { user_id: userData.user.id });
  
  const adminEmails = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim())
    : ["admin@eduagent.ai"];
  const isFallbackAdmin = userData.user.email && adminEmails.includes(userData.user.email);
  const isRoleAdmin = userData.user.app_metadata?.role === "admin";

  if (!isAdmin && !isFallbackAdmin && !isRoleAdmin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { 
      title, 
      content, 
      status, 
      targetAudience, 
      targetInstitution, 
      targetDepartment, 
      scheduledFor, 
      expiresAt 
    } = await req.json();

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ success: false, error: "Title and content are required parameters." }, { status: 400 });
    }

    const payload: any = {
      title: title.trim(),
      content: content.trim(),
      created_by: userData.user.id,
      status: status || "published",
      target_audience: targetAudience || "all",
      target_institution: targetInstitution?.trim() || null,
      target_department: targetDepartment?.trim() || null,
      scheduled_for: scheduledFor || null,
      expires_at: expiresAt || null
    };

    // If publishing now, set sent_at to current time
    if (payload.status === "published") {
      payload.sent_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("broadcasts")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    // Log action to audit logs
    await supabase.from("audit_logs").insert({
      user_id: userData.user.id,
      action: "broadcast_created",
      details: { broadcast_id: data.id, title: data.title, status: data.status }
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[api:admin:broadcasts:POST] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
