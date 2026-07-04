import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateStudySessionTitle } from "@/lib/study-sessions/title";
import type { StudySessionRecord } from "@/lib/study-sessions/types";

function mapStudySessionRow(session: any): StudySessionRecord {
  return {
    id: session.id,
    title: session.title,
    topicCategory: session.topic_category ?? "General",
    lastMessage: session.last_message ?? "",
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    courseId: session.course_id ?? undefined,
    status: session.status ?? "active",
    durationSeconds: session.duration_seconds ?? 0,
    topicsCovered: Array.isArray(session.topics_covered) ? session.topics_covered : [],
    summary: session.summary ?? undefined,
    notes: session.notes ?? undefined,
    messages: Array.isArray(session.study_messages)
      ? session.study_messages.map((message: any) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.created_at,
          sources: Array.isArray(message.sources) ? message.sources : [],
        }))
      : [],
  };
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const { sessionId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: "UNAUTHORIZED",
            message: "You must be signed in to view study sessions.",
          },
        },
        { status: 401 }
      );
    }

    const { data: session, error } = await supabase
      .from("study_sessions")
      .select("id,title,topic_category,last_message,created_at,updated_at,course_id,status,duration_seconds,topics_covered,summary,notes,study_messages(id,role,content,created_at,sources)")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !session) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: "NOT_FOUND",
            message: "Study session not found.",
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      requestId,
      data: {
        session: mapStudySessionRow(session),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        requestId,
        error: {
          code: "SERVER_ERROR",
          message: error instanceof Error ? error.message : "Unable to retrieve the study session.",
        },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ sessionId: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const { sessionId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: "UNAUTHORIZED",
            message: "You must be signed in to update a study session.",
          },
        },
        { status: 401 }
      );
    }

    const body: unknown = await req.json();
    const title = typeof (body as { title?: unknown })?.title === "string" ? (body as { title?: string }).title : "";
    const firstPrompt = typeof (body as any)?.firstPrompt === "string" ? ((body as any).firstPrompt as string) : "";
    
    // Notes & study stats updates
    const notes = typeof (body as { notes?: unknown })?.notes === "string" ? (body as { notes?: string }).notes : null;
    const durationSeconds = typeof (body as { durationSeconds?: unknown })?.durationSeconds === "number" ? (body as { durationSeconds?: number }).durationSeconds : null;
    const topicsCovered = Array.isArray((body as { topicsCovered?: unknown })?.topicsCovered) ? (body as { topicsCovered?: string[] }).topicsCovered : null;
    const status = typeof (body as { status?: unknown })?.status === "string" ? (body as { status?: string }).status : null;

    const updateFields: Record<string, any> = {};
    if (title || firstPrompt) {
      updateFields.title = title ? title.trim() : generateStudySessionTitle(firstPrompt);
    }
    if (typeof notes === "string") {
      updateFields.notes = notes;
      const wordCount = notes.trim() === "" ? 0 : notes.trim().split(/\s+/).length;
      await supabase
        .from("notes")
        .upsert({
          user_id: user.id,
          session_id: sessionId,
          content: notes,
          word_count: wordCount,
          updated_at: new Date().toISOString()
        });
    }
    if (durationSeconds !== null) updateFields.duration_seconds = durationSeconds;
    if (topicsCovered !== null) updateFields.topics_covered = topicsCovered;
    if (status !== null) updateFields.status = status;

    const { data: session, error } = await supabase
      .from("study_sessions")
      .update(updateFields)
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .select("id,title,topic_category,last_message,created_at,updated_at,course_id,status,duration_seconds,topics_covered,summary,notes,study_messages(id,role,content,created_at,sources)")
      .single();

    if (error || !session) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: "UPDATE_FAILED",
            message: error?.message ?? "Unable to update the study session.",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      requestId,
      data: {
        session: mapStudySessionRow(session),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        requestId,
        error: {
          code: "SERVER_ERROR",
          message: error instanceof Error ? error.message : "Unable to update the study session.",
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ sessionId: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const { sessionId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: "UNAUTHORIZED",
            message: "You must be signed in to delete a study session.",
          },
        },
        { status: 401 }
      );
    }

    const { error } = await supabase.from("study_sessions").delete().eq("id", sessionId).eq("user_id", user.id);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: "DELETE_FAILED",
            message: error.message,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      requestId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        requestId,
        error: {
          code: "SERVER_ERROR",
          message: error instanceof Error ? error.message : "Unable to delete the study session.",
        },
      },
      { status: 500 }
    );
  }
}
