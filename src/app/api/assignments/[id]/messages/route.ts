import { NextResponse, type NextRequest } from "next/server";
import { authorizeActiveUserApi } from "@/lib/auth/require-active-user-api";
import {
  getAssignmentById,
  getAssignmentMessages,
  insertAssignmentMessage,
  AssignmentApiError,
} from "@/lib/repositories/assignments";
import { generateFollowUpAnswer } from "@/lib/assignments/service";

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

    const messages = await getAssignmentMessages(supabase, id);
    return NextResponse.json({ success: true, requestId, messages });
  } catch (error) {
    console.error("[api:assignments:messages:GET] failed", { requestId, error });
    const status = error instanceof AssignmentApiError ? error.status : 500;
    return NextResponse.json(
      { success: false, requestId, error: { message: error instanceof Error ? error.message : "Failed to load messages." } },
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
    const body = await request.json();

    const content = body.content?.trim();
    if (!content) {
      return NextResponse.json(
        { success: false, requestId, error: { message: "Message content cannot be empty." } },
        { status: 400 }
      );
    }

    const assignment = await getAssignmentById(supabase, id, user.id);
    if (!assignment) {
      return NextResponse.json(
        { success: false, requestId, error: { message: "Assignment not found." } },
        { status: 404 }
      );
    }

    // 1. Save user's follow-up message
    const userMessage = await insertAssignmentMessage(supabase, {
      assignmentId: id,
      userId: user.id,
      role: "user",
      content,
    });

    // 2. Fetch recent conversation history
    const pastMessages = await getAssignmentMessages(supabase, id);

    // 3. Generate AI tutor follow-up
    const replyText = await generateFollowUpAnswer({
      assignment,
      messages: pastMessages,
      userPrompt: content,
      userId: user.id,
      signal: request.signal,
    });

    // 4. Save tutor reply
    const assistantMessage = await insertAssignmentMessage(supabase, {
      assignmentId: id,
      userId: user.id,
      role: "assistant",
      content: replyText,
      metadata: { mode: assignment.mode, generatedAt: new Date().toISOString() },
    });

    return NextResponse.json({
      success: true,
      requestId,
      userMessage,
      replyMessage: assistantMessage,
    });
  } catch (error) {
    console.error("[api:assignments:messages:POST] failed", { requestId, error });
    const status = error instanceof AssignmentApiError ? error.status : 500;
    return NextResponse.json(
      { success: false, requestId, error: { message: error instanceof Error ? error.message : "Failed to process follow-up." } },
      { status }
    );
  }
}
