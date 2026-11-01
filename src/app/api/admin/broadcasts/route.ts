import { AuthApiError, authApiErrorResponse, requireActiveUserApi } from "@/lib/auth/require-active-user-api";
import { selectBroadcasts, selectAuthProfile } from "@/lib/repositories/auth";
import { isBroadcastVisibleToLearner } from "@/lib/auth/broadcast-visibility";
import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { OperationError } from "@/lib/repositories/operations";
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
    return NextResponse.json({ success: false, error: "Announcements could not be loaded." }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}

export async function POST(req: Request) {
  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;
  const { supabase, user } = authorization;

  try {
    const raw = await readBoundedJson(req, 16_384);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json({ success: false, error: "Invalid announcement payload." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }
    const {
      title,
      content,
      status,
      targetAudience,
      targetInstitution,
      targetDepartment,
      scheduledFor,
      expiresAt,
    } = raw as Record<string, unknown>;

    if (typeof title !== "string" || !title.trim() || title.length > 200 || typeof content !== "string" || !content.trim() || content.length > 10_000) {
      return NextResponse.json({ success: false, error: "Title and content are required parameters." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }
    const resolvedStatus = typeof status === "string" && status.trim() ? status.trim() : "published";
    if (!["draft", "published", "scheduled"].includes(resolvedStatus)) {
      return NextResponse.json({ success: false, error: "Invalid announcement status." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }
    const resolvedAudience = typeof targetAudience === "string" && targetAudience.trim() ? targetAudience.trim().toLowerCase() : "all";
    if (!["all", "students", "teachers", "free", "student", "premium", "pro", "team", "enterprise"].includes(resolvedAudience)) {
      return NextResponse.json({ success: false, error: "Invalid target audience." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }

    const payload = {
      title: title.trim(),
      content: content.trim(),
      created_by: user.id,
      status: resolvedStatus,
      target_audience: resolvedAudience,
      target_institution: typeof targetInstitution === "string" && targetInstitution.trim() ? targetInstitution.trim().slice(0, 240) : null,
      target_department: typeof targetDepartment === "string" && targetDepartment.trim() ? targetDepartment.trim().slice(0, 240) : null,
      scheduled_for: typeof scheduledFor === "string" && scheduledFor.trim() ? scheduledFor.trim() : null,
      expires_at: typeof expiresAt === "string" && expiresAt.trim() ? expiresAt.trim() : null,
      ...(resolvedStatus === "published" ? { sent_at: new Date().toISOString() } : {}),
    };

    const { data, error } = await supabase
      .from("broadcasts")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    // The database trigger (stabilization_staff_audit) records the content-free
    // v1 event in the same transaction; never copy broadcast titles into legacy audit rows.
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof OperationError && error.status >= 400 && error.status < 500) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("[api:admin:broadcasts:POST] failed");
    return NextResponse.json({ success: false, error: "Announcement could not be saved." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
