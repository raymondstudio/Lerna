import { NextResponse, type NextRequest } from "next/server";
import { authorizeActiveUserApi } from "@/lib/auth/require-active-user-api";
import {
  getAssignmentById,
  updateAssignment,
  insertAssignmentMessage,
  getAssignmentAttachments,
  AssignmentApiError,
} from "@/lib/repositories/assignments";
import { generateAssignmentSolution } from "@/lib/assignments/service";

export const runtime = "nodejs";

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

    const assignment = await getAssignmentById(supabase, id, user.id);
    if (!assignment) {
      return NextResponse.json(
        { success: false, requestId, error: { message: "Assignment not found." } },
        { status: 404 }
      );
    }

    const mode = body.mode === "answer" || body.mode === "explain" ? body.mode : assignment.mode;
    if (mode !== assignment.mode) {
      await updateAssignment(supabase, id, user.id, { mode });
    }

    await updateAssignment(supabase, id, user.id, { status: "processing" });

    const attachments = await getAssignmentAttachments(supabase, id);
    const combinedExtracted = attachments.map((a) => a.extractedText || "").filter(Boolean).join("\n\n");

    try {
      const solution = await generateAssignmentSolution({
        assignmentTitle: assignment.title,
        courseCode: assignment.courses?.code,
        courseTitle: assignment.courses?.title,
        mode,
        extractedText: combinedExtracted,
        userId: user.id,
        signal: request.signal,
      });

      const message = await insertAssignmentMessage(supabase, {
        assignmentId: id,
        userId: user.id,
        role: "assistant",
        content: solution,
        metadata: { mode, regenerated: true, generatedAt: new Date().toISOString() },
      });

      const updated = await updateAssignment(supabase, id, user.id, { status: "completed" });
      return NextResponse.json({
        success: true,
        requestId,
        assignment: updated,
        solutionMessage: message,
      });
    } catch (err) {
      console.error("[api:assignments:process:generation_failed]", { requestId, err });
      await updateAssignment(supabase, id, user.id, { status: "failed" });
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: { message: "AI solution could not be generated. Please retry." },
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("[api:assignments:process:POST] failed", { requestId, error });
    const status = error instanceof AssignmentApiError ? error.status : 500;
    return NextResponse.json(
      { success: false, requestId, error: { message: error instanceof Error ? error.message : "Failed to process assignment." } },
      { status }
    );
  }
}
