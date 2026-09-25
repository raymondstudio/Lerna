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

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
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

  const url = new URL(req.url);
  const summaryOnly = url.searchParams.get("summary") === "true";
  const rawQuery = url.searchParams.get("query")?.trim().slice(0, 100) ?? "";
  const searchQuery = rawQuery.replace(/[^\p{L}\p{N}\s._-]/gu, " ").replace(/\s+/g, " ").trim();
  const limitParam = url.searchParams.get("limit");
  const requestedLimit = Number(limitParam ?? (summaryOnly ? 50 : Number.NaN));
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 200) : null;
  const select = summaryOnly
    ? "id,title,topic_category,last_message,created_at,updated_at,course_id,status,duration_seconds,topics_covered,summary,notes"
    : "id,title,topic_category,last_message,created_at,updated_at,course_id,status,duration_seconds,topics_covered,summary,notes,study_messages(id,role,content,created_at,sources)";

  let sessionsQuery = supabase
    .from("study_sessions")
    .select(select)
    .eq("user_id", user.id);

  if (searchQuery) {
    sessionsQuery = sessionsQuery.or(
      `title.ilike.%${searchQuery}%,topic_category.ilike.%${searchQuery}%,last_message.ilike.%${searchQuery}%`,
    );
  }

  let orderedQuery = sessionsQuery
    .order("updated_at", { ascending: false });

  if (limit !== null) {
    orderedQuery = orderedQuery.limit(limit);
  }

  if (!summaryOnly) {
    orderedQuery = orderedQuery.order("created_at", { ascending: true, foreignTable: "study_messages" });
  }

  const { data: sessions, error } = await orderedQuery;

  if (error) {
    console.error("[api:study-sessions] fetch failed", { requestId, error });
    return NextResponse.json(
      {
        success: false,
        requestId,
        error: {
          code: "FETCH_FAILED",
          message: "Study sessions could not be loaded.",
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    requestId,
    data: {
      sessions: (sessions ?? []).map(mapStudySessionRow),
    },
  });
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
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
            message: "You must be signed in to create a study session.",
          },
        },
        { status: 401 }
      );
    }

    const body: unknown = await req.json();
    const titleInput = typeof (body as { title?: unknown })?.title === "string" ? (body as { title?: string }).title : "";
    const firstPrompt = typeof (body as { firstPrompt?: unknown })?.firstPrompt === "string" ? (body as { firstPrompt?: string }).firstPrompt : "";
    const normalizedFirstPrompt = firstPrompt ?? "";
    const topicCategory = typeof (body as { topicCategory?: unknown })?.topicCategory === "string" ? (body as { topicCategory?: string }).topicCategory : "General";
    const normalizedTopicCategory = topicCategory ?? "General";
    const courseId = typeof (body as { courseId?: unknown })?.courseId === "string" ? (body as { courseId?: string }).courseId : null;

    const title = titleInput ? titleInput.trim() : generateStudySessionTitle(normalizedFirstPrompt);

    const { data: session, error } = await supabase
      .from("study_sessions")
      .insert({
        user_id: user.id,
        title,
        topic_category: normalizedTopicCategory.trim() || "General",
        last_message: "",
        course_id: courseId,
      })
      .select("id,title,topic_category,last_message,created_at,updated_at,course_id,status,duration_seconds,topics_covered,summary,notes,study_messages(id,role,content,created_at,sources)")
      .single();

    if (error || !session) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: "CREATE_FAILED",
            message: error?.message ?? "Unable to create a new study session.",
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
          message: error instanceof Error ? error.message : "Unable to create a study session.",
        },
      },
      { status: 500 }
    );
  }
}
