import { NextResponse } from "next/server";
import { getAIResponse } from "@/lib/chat/service";
import type { ChatMessage } from "@/lib/chat/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDY_SESSION_TITLE, generateStudySessionTitle } from "@/lib/study-sessions/title";
import { mapStudySessionRow } from "@/lib/repositories/study-sessions";
import { OperationError } from "@/lib/repositories/operations";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { authorizeActiveUserApi } from "@/lib/auth/require-active-user-api";

async function fetchSessionForUser(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, sessionId: string, userId: string) {
  const { data, error } = await supabase
    .from("study_sessions")
    .select("id,title,topic_category,last_message,created_at,updated_at,course_id,status,duration_seconds,topics_covered,summary,notes,notes_revision,notes_updated_at")
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
    .select("id,title,topic_category,last_message,created_at,updated_at,course_id,status,duration_seconds,topics_covered,summary,notes,notes_revision,notes_updated_at,study_messages(id,role,content,created_at,sources)")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true, foreignTable: "study_messages" })
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const body: unknown = await readBoundedJson(req);
    const input = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
    if (!input) throw new OperationError("The conversation request is invalid.", 400);
    const messages = input.messages as ChatMessage[] | undefined;
    if (!Array.isArray(messages) || messages.length > 100 || messages.some(message => !message || !["user", "assistant"].includes(message.role) || typeof message.content !== "string" || message.content.length > 50_000)) throw new OperationError("The conversation request is invalid or too large.", 400);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const key of ["sessionId", "courseId", "materialId"] as const) {
      const value = input[key];
      if (value !== undefined && value !== null && (typeof value !== "string" || !uuid.test(value))) {
        throw new OperationError(`The selected ${key} is invalid.`, 400);
      }
    }
    const sessionId = (input.sessionId as string | null | undefined) ?? null;
    const requestedCourseId = (input.courseId as string | null | undefined) ?? null;
    const requestedMaterialId = (input.materialId as string | null | undefined) ?? null;
    const auth = await authorizeActiveUserApi();
    if (!auth.ok) return auth.response;
    const { supabase, user } = auth;

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
    if (sessionId && !session) {
      return NextResponse.json({ success: false, requestId, error: { code: "SESSION_NOT_FOUND", message: "This study session is no longer available." } }, { status: 404 });
    }

    // Resolve every explicit parent before creating or changing a session.
    // Invalid foreign/deleted references must have no persistence side effect.
    let ownedCourseId: string | null = null;
    if (requestedCourseId) {
      const { data, error } = await supabase.from("courses").select("id")
        .eq("user_id", user.id).eq("id", requestedCourseId).maybeSingle();
      if (error) {
        console.error("[chat] course reference lookup failed", { requestId, code: error.code });
        return NextResponse.json({ success: false, requestId, error: { code: "REFERENCE_LOOKUP_FAILED", message: "The selected course could not be loaded." } }, { status: 503 });
      }
      if (!data) return NextResponse.json({ success: false, requestId, error: { code: "REFERENCE_NOT_FOUND", message: "The selected course is no longer available." } }, { status: 404 });
      ownedCourseId = data.id;
    }

    let selectedMaterialId: string | null = null;
    if (requestedMaterialId) {
      const { data, error } = await supabase.from("uploaded_materials").select("id")
        .eq("id", requestedMaterialId).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
      if (error) {
        console.error("[chat] material reference lookup failed", { requestId, code: error.code });
        return NextResponse.json({ success: false, requestId, error: { code: "REFERENCE_LOOKUP_FAILED", message: "The selected material could not be loaded." } }, { status: 503 });
      }
      if (!data) return NextResponse.json({ success: false, requestId, error: { code: "REFERENCE_NOT_FOUND", message: "The selected material is no longer available." } }, { status: 404 });
      selectedMaterialId = data.id;
    }

    if (!session) {
      const { data: createdSession, error: createSessionError } = await supabase
        .from("study_sessions")
        .insert({
          user_id: user.id,
          title: generateStudySessionTitle(lastUserMessage.content),
          topic_category: "General",
          last_message: lastUserMessage.content,
          ...(ownedCourseId ? { course_id: ownedCourseId } : {}),
        })
        .select("id,title,topic_category,last_message,course_id,created_at,updated_at")
        .single();

      if (createSessionError || !createdSession) {
        return NextResponse.json(
          {
            success: false,
            requestId,
            error: {
              code: "SESSION_CREATE_FAILED",
              message: "Unable to create a study session.",
            },
          },
          { status: 500 }
        );
      }

      session = createdSession;
    }

    if (ownedCourseId && sessionId) {
      const { error: courseUpdateError } = await supabase
        .from("study_sessions")
        .update({ course_id: ownedCourseId })
        .eq("id", session.id)
        .eq("user_id", user.id);

      if (courseUpdateError) {
        console.error("[chat] course scope update failed", { requestId, code: courseUpdateError.code });
        return NextResponse.json(
          {
            success: false,
            requestId,
            error: { code: "REFERENCE_SAVE_FAILED", message: "The selected course could not be applied." },
          },
          { status: 500 },
        );
      }

      session = { ...session, course_id: ownedCourseId };
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
              message: "The session title could not be updated.",
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
            message: "Your message could not be saved.",
          },
        },
        { status: 500 }
      );
    }

    let documentIds: string[] = selectedMaterialId ? [selectedMaterialId] : [];
    if (!selectedMaterialId) {
      const { data: materials, error: materialsError } = await supabase
        .from("uploaded_materials")
        .select("id")
        .or(`session_id.eq.${session.id}${session.course_id ? `,course_id.eq.${session.course_id}` : ""}`)
        .is("deleted_at", null);

      if (materialsError) {
        throw new Error("Authorized material lookup is unavailable. Please retry.");
      } else if (materials) {
        documentIds = materials.map((material) => material.id);
      }
    }

    const aiMessage = await getAIResponse(messages, session.id, user.id, documentIds);

    const { error: assistantMessageError } = await supabase.from("study_messages").insert({
      session_id: session.id,
      user_id: user.id,
      role: "assistant",
      content: aiMessage.content,
      sources: aiMessage.sources ?? [],
    });

    if (assistantMessageError) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: "MESSAGE_SAVE_FAILED",
            message: "The tutor response could not be saved.",
          },
        },
        { status: 500 }
      );
    }

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
            message: "The session could not be updated.",
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
    const status = error instanceof OperationError ? error.status : 500;
    console.error("[chat] request failed", { requestId, status });

    return NextResponse.json(
      {
        success: false,
        requestId,
        error: {
          code: error instanceof OperationError
            ? (status === 400 ? "INVALID_REQUEST" : status === 403 ? "FORBIDDEN" : status === 409 ? "OPERATION_CONFLICT" : status === 429 ? "PLAN_LIMIT_REACHED" : "OPERATION_UNAVAILABLE")
            : "SERVER_ERROR",
          message: error instanceof OperationError ? error.message : "Unable to generate a tutor response right now.",
        },
      },
      { status }
    );
  }
}
