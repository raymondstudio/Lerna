import { NextResponse, type NextRequest } from "next/server";
import { authorizeActiveUserApi } from "@/lib/auth/require-active-user-api";
import {
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  getAssignmentMessages,
  getAssignmentAttachments,
  AssignmentApiError,
} from "@/lib/repositories/assignments";

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

    const [messages, attachments] = await Promise.all([
      getAssignmentMessages(supabase, id),
      getAssignmentAttachments(supabase, id),
    ]);

    return NextResponse.json({
      success: true,
      requestId,
      assignment,
      messages,
      attachments,
    });
  } catch (error) {
    console.error("[api:assignments:id:GET] failed", { requestId, error });
    const status = error instanceof AssignmentApiError ? error.status : 500;
    return NextResponse.json(
      { success: false, requestId, error: { message: error instanceof Error ? error.message : "Failed to load assignment." } },
      { status }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeActiveUserApi();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await updateAssignment(supabase, id, user.id, {
      title: body.title,
      description: body.description,
      mode: body.mode,
      courseId: body.courseId,
      isPublic: body.isPublic,
      status: body.status,
    });

    return NextResponse.json({ success: true, requestId, assignment: updated });
  } catch (error) {
    console.error("[api:assignments:id:PATCH] failed", { requestId, error });
    const status = error instanceof AssignmentApiError ? error.status : 500;
    return NextResponse.json(
      { success: false, requestId, error: { message: error instanceof Error ? error.message : "Failed to update assignment." } },
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

    await deleteAssignment(supabase, id, user.id);
    return NextResponse.json({ success: true, requestId, message: "Assignment deleted." });
  } catch (error) {
    console.error("[api:assignments:id:DELETE] failed", { requestId, error });
    const status = error instanceof AssignmentApiError ? error.status : 500;
    return NextResponse.json(
      { success: false, requestId, error: { message: error instanceof Error ? error.message : "Failed to delete assignment." } },
      { status }
    );
  }
}
