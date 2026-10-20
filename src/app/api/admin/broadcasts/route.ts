import { AuthApiError, authApiErrorResponse, requireActiveUserApi } from "@/lib/auth/require-active-user-api";
import { selectBroadcasts, selectAuthProfile } from "@/lib/repositories/auth";
import { isBroadcastVisibleToLearner } from "@/lib/auth/broadcast-visibility";
import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { supabase, user } = await requireActiveUserApi();
    const { data: admin, error: roleError } = await supabase.rpc("is_admin", { user_id: user.id });
    if (roleError) throw new AuthApiError("Role verification is temporarily unavailable.", 503, "AUTH_UNAVAILABLE");
    const broadcasts = await selectBroadcasts(supabase, admin === true);
    const profile = admin === true ? null : await selectAuthProfile(supabase, user.id);
    const visible = admin === true ? broadcasts : broadcasts.filter((item) => profile && isBroadcastVisibleToLearner(item, profile));
    return NextResponse.json({ success: true, data: visible }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthApiError) return authApiErrorResponse(error);
    return NextResponse.json({ success: false, error: "Announcements could not be loaded." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;
  const { supabase, user } = authorization;
  const userData = { user };

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

    const payload = {
      title: title.trim(),
      content: content.trim(),
      created_by: userData.user.id,
      status: status || "published",
      target_audience: targetAudience || "all",
      target_institution: targetInstitution?.trim() || null,
      target_department: targetDepartment?.trim() || null,
      scheduled_for: scheduledFor || null,
      expires_at: expiresAt || null,
      ...((status || "published") === "published" ? { sent_at: new Date().toISOString() } : {})
    };

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
