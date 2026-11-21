import { NextResponse, type NextRequest } from "next/server";
import { authorizeActiveUserApi } from "@/lib/auth/require-active-user-api";
import {
  getAssignmentById,
  updateAssignment,
  regenerateAssignmentShareToken,
  AssignmentApiError,
} from "@/lib/repositories/assignments";
import { getAppUrl } from "@/lib/supabase/config";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeActiveUserApi();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;

    const assignment = await getAssignmentById(supabase, id, user.id);
    if (!assignment) {
      return NextResponse.json(
        { success: false, requestId, error: { message: "Assignment not found." } },
        { status: 404 }
      );
    }

    const appUrl = getAppUrl() || new URL(request.url).origin;
    const shareUrl = `${appUrl}/share/assignments/${assignment.shareToken}`;

    return NextResponse.json({
      success: true,
      requestId,
      isPublic: assignment.isPublic,
      shareToken: assignment.shareToken,
      shareUrl,
    });
  } catch (error) {
    console.error("[api:assignments:share:GET] failed", { requestId, error });
    const status = error instanceof AssignmentApiError ? error.status : 500;
    return NextResponse.json(
      { success: false, requestId, error: { message: error instanceof Error ? error.message : "Failed to get share details." } },
      { status }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeActiveUserApi();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    let token: string | undefined = undefined;
    if (body.regenerate) {
      token = await regenerateAssignmentShareToken(supabase, id, user.id);
    }

    const updated = await updateAssignment(supabase, id, user.id, {
      isPublic: body.isPublic !== undefined ? body.isPublic : true,
    });

    const appUrl = getAppUrl() || new URL(request.url).origin;
    const shareUrl = `${appUrl}/share/assignments/${token || updated.shareToken}`;

    return NextResponse.json({
      success: true,
      requestId,
      isPublic: updated.isPublic,
      shareToken: token || updated.shareToken,
      shareUrl,
    });
  } catch (error) {
    console.error("[api:assignments:share:POST] failed", { requestId, error });
    const status = error instanceof AssignmentApiError ? error.status : 500;
    return NextResponse.json(
      { success: false, requestId, error: { message: error instanceof Error ? error.message : "Failed to update share settings." } },
      { status }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeActiveUserApi();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;

    await updateAssignment(supabase, id, user.id, { isPublic: false });
    return NextResponse.json({
      success: true,
      requestId,
      isPublic: false,
      message: "Public link revoked successfully.",
    });
  } catch (error) {
    console.error("[api:assignments:share:DELETE] failed", { requestId, error });
    const status = error instanceof AssignmentApiError ? error.status : 500;
    return NextResponse.json(
      { success: false, requestId, error: { message: error instanceof Error ? error.message : "Failed to revoke share link." } },
      { status }
    );
  }
}
