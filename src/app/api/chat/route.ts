import { NextResponse } from "next/server";
import { getAIResponse } from "@/lib/chat/service";
import type { ChatMessage } from "@/lib/chat/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDY_SESSION_TITLE, generateStudySessionTitle } from "@/lib/study-sessions/title";
import type { StudySessionRecord } from "@/lib/study-sessions/types";
import { emitAnalyticsEvent } from "@/lib/analytics/events";

function getLastUserMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => message?.role === "user" && message?.content?.trim());
}

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

async function fetchSessionForUser(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, sessionId: string, userId: string) {
  const { data, error } = await supabase
    .from("study_sessions")
    .select("id,title,topic_category,last_message,created_at,updated_at,course_id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function fetchSessionWithMessages(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, sessionId: string, userId: string) {
  const { data, error } = await supabase
    .from("study_sessions")
    .select("id,title,topic_category,last_message,created_at,updated_at,course_id,study_messages(id,role,content,created_at,sources)")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const body: unknown = await req.json();
    const messages = (body as { messages?: ChatMessage[] })?.messages;
    const sessionId = typeof (body as { sessionId?: unknown })?.sessionId === "string" ? (body as { sessionId?: string }).sessionId : null;
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    console.info("[chat] request received", {
      requestId,
      hasMessages: Array.isArray(messages),
      messageCount: Array.isArray(messages) ? messages.length : 0,
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: "UNAUTHORIZED",
            message: "You must be signed in to send chat messages.",
          },
        },
        { status: 401 }
      );
    }

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: "INVALID_REQUEST",
            message: "messages must be an array",
          },
        },
        { status: 400 }
      );
    }

    const lastUserMessage = [...messages].reverse().find((message) => message?.role === "user" && message?.content?.trim());

    if (!lastUserMessage) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: "EMPTY_MESSAGE",
            message: "A user message is required before generating a response.",
          },
        },
        { status: 400 }
      );
    }

    let session = sessionId ? await fetchSessionForUser(supabase, sessionId, user.id) : null;

    if (!session) {
      const { data: createdSession, error: createSessionError } = await supabase
        .from("study_sessions")
        .insert({
          user_id: user.id,
          title: generateStudySessionTitle(lastUserMessage.content),
          topic_category: "General",
          last_message: lastUserMessage.content,
        })
        .select("id,title,topic_category,last_message,created_at,updated_at")
        .single();

      if (createSessionError || !createdSession) {
        return NextResponse.json(
          {
            success: false,
            requestId,
            error: {
              code: "SESSION_CREATE_FAILED",
              message: createSessionError?.message ?? "Unable to create a study session.",
            },
          },
          { status: 500 }
        );
      }

      session = createdSession;

      void emitAnalyticsEvent(user.id, "session_started", {
        sessionId: createdSession.id,
        title: createdSession.title,
        topicCategory: createdSession.topic_category,
      });
    }

    if (session.title === DEFAULT_STUDY_SESSION_TITLE) {
      const nextTitle = generateStudySessionTitle(lastUserMessage.content);
      const { error: renameError } = await supabase
        .from("study_sessions")
        .update({ title: nextTitle })
        .eq("id", session.id)
        .eq("user_id", user.id);

      if (renameError) {
        return NextResponse.json(
          {
            success: false,
            requestId,
            error: {
              code: "SESSION_UPDATE_FAILED",
              message: renameError.message,
            },
          },
          { status: 500 }
        );
      }

      session = {
        ...session,
        title: nextTitle,
      };
    }

    const { error: userMessageError } = await supabase.from("study_messages").insert({
      session_id: session.id,
      user_id: user.id,
      role: "user",
      content: lastUserMessage.content,
    });

    if (userMessageError) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: "MESSAGE_SAVE_FAILED",
            message: userMessageError.message,
          },
        },
        { status: 500 }
      );
    }

    void emitAnalyticsEvent(user.id, "chat_sent", {
      sessionId: session.id,
      contentLength: lastUserMessage.content.length,
    });

    let documentIds: string[] = [];
    const { data: materials } = await supabase
      .from("uploaded_materials")
      .select("id")
      .or(`session_id.eq.${session.id}${session.course_id ? `,course_id.eq.${session.course_id}` : ""}`)
      .is("deleted_at", null);
    if (materials) {
      documentIds = materials.map((m) => m.id);
    }

    const aiMessage = await getAIResponse(messages, session.id, user.id, documentIds);

    const { error: assistantMessageError } = await supabase.from("study_messages").insert({
      session_id: session.id,
      user_id: user.id,
      role: "assistant",
      content: aiMessage.content,
      sources: aiMessage.sources ?? [],
    });

    if (!assistantMessageError && aiMessage.usage) {
      try {
        const { logAiRequest } = await import("@/lib/analytics/tracker");
        await logAiRequest(
          user.id,
          aiMessage.usage.promptTokens,
          aiMessage.usage.completionTokens,
          aiMessage.usage.modelUsed,
          "chat",
          "success"
        );
      } catch (trackErr) {
        console.error("[api:chat] Failed to log AI request telemetry:", trackErr);
      }
    }

    if (assistantMessageError) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: "MESSAGE_SAVE_FAILED",
            message: assistantMessageError.message,
          },
        },
        { status: 500 }
      );
    }

    void emitAnalyticsEvent(user.id, "chat_received", {
      sessionId: session.id,
      contentLength: aiMessage.content.length,
      sourceCount: aiMessage.sources?.length || 0,
    });

    const { error: sessionUpdateError } = await supabase
      .from("study_sessions")
      .update({ last_message: aiMessage.content })
      .eq("id", session.id)
      .eq("user_id", user.id);

    if (sessionUpdateError) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: "SESSION_UPDATE_FAILED",
            message: sessionUpdateError.message,
          },
        },
        { status: 500 }
      );
    }

    const latestSession = await fetchSessionWithMessages(supabase, session.id, user.id);

    if (!latestSession) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: "SESSION_FETCH_FAILED",
            message: "Unable to reload the active study session.",
          },
        },
        { status: 500 }
      );
    }

    console.info("[chat] response generated", {
      requestId,
      assistantMessageLength: aiMessage.content.length,
    });

    return NextResponse.json({
      success: true,
      requestId,
      data: {
        message: aiMessage,
        session: mapStudySessionRow(latestSession),
      },
    });
  } catch (error) {
    console.error("[chat] request failed", {
      requestId,
      error,
    });

    return NextResponse.json(
      {
        success: false,
        requestId,
        error: {
          code: "SERVER_ERROR",
          message: "Unable to generate a tutor response right now.",
        },
      },
      { status: 500 }
    );
  }
}
