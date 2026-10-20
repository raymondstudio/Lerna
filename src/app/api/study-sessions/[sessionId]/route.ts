import { NextResponse } from "next/server";
import { requireActiveUserApi } from "@/lib/auth/require-active-user-api";
import { generateStudySessionTitle } from "@/lib/study-sessions/title";
import { assertSessionId, deleteOwnedSession, getOwnedMessages, getOwnedNoteVariants, getOwnedSession, mapStudySessionRow, saveOwnedNotes, SessionApiError, updateOwnedSession } from "@/lib/repositories/study-sessions";
import { boundedLimit, boundedText, noteOperation, readSessionBody, sessionFailure } from "@/lib/study-sessions/api";

type Context = { params: Promise<{ sessionId: string }> };
async function identity() {
  const { supabase, user } = await requireActiveUserApi();
  return { client: supabase, userId: user.id };
}

export async function GET(request: Request, context: Context) {
  const requestId = crypto.randomUUID();
  try {
    const { client, userId } = await identity();
    const { sessionId } = await context.params;
    assertSessionId(sessionId);
    const url = new URL(request.url);
    const row = await getOwnedSession(client, userId, sessionId);
    const notesOnly = url.searchParams.get("notesOnly") === "true";
    const messageLimit = url.searchParams.has("messageLimit") ? boundedLimit(url.searchParams.get("messageLimit"), 100) : undefined;
    const messages = notesOnly ? { rows: [], nextCursor: null } : await getOwnedMessages(client, userId, sessionId, messageLimit, url.searchParams.get("messagesBefore"));
    return NextResponse.json({ success: true, requestId, data: {
      session: mapStudySessionRow({ ...row, study_messages: messages.rows }),
      ...(url.searchParams.get("noteVariants") === "true" ? { noteVariants: await getOwnedNoteVariants(client, sessionId) } : {}),
      ...(!notesOnly && messageLimit ? { messagesPage: { nextCursor: messages.nextCursor } } : {}),
    } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return sessionFailure(error, requestId); }
}

export async function PATCH(request: Request, context: Context) {
  const requestId = crypto.randomUUID();
  try {
    const { client, userId } = await identity();
    const { sessionId } = await context.params;
    assertSessionId(sessionId);
    const body = await readSessionBody(request);
    const allowed = new Set(["notes", "expectedNotesRevision", "operationId", "title", "firstPrompt", "durationSeconds", "topicsCovered", "status"]);
    if (Object.keys(body).some(key => !allowed.has(key))) throw new SessionApiError(400, "INVALID_REQUEST", "This study session update contains an unsupported field.");
    // Never acknowledge partially applied mixed updates.
    if (Object.hasOwn(body, "notes")) {
      if (Object.keys(body).some(key => !["notes", "expectedNotesRevision", "operationId"].includes(key))) throw new SessionApiError(400, "MIXED_UPDATE", "Save notes separately from session settings.");
      const operation = noteOperation(body);
      await getOwnedSession(client, userId, sessionId);
      const result = await saveOwnedNotes(client, sessionId, operation);
      return NextResponse.json({ success: true, requestId, data: result }, { headers: { "Cache-Control": "no-store" } });
    }
    const fields: Record<string, unknown> = {};
    if (Object.hasOwn(body, "title")) fields.title = boundedText(body.title, "Title", 200).trim();
    if (Object.hasOwn(body, "firstPrompt") && !Object.hasOwn(body, "title")) fields.title = generateStudySessionTitle(boundedText(body.firstPrompt, "First prompt", 10_000));
    if (Object.hasOwn(body, "durationSeconds")) {
      if (!Number.isSafeInteger(body.durationSeconds) || (body.durationSeconds as number) < 0 || (body.durationSeconds as number) > 31_536_000) throw new SessionApiError(400, "INVALID_DURATION", "Study duration must be a nonnegative number of seconds.");
      fields.duration_seconds = body.durationSeconds;
    }
    if (Object.hasOwn(body, "topicsCovered")) {
      if (!Array.isArray(body.topicsCovered) || body.topicsCovered.length > 100) throw new SessionApiError(400, "INVALID_TOPICS", "A session can have at most 100 topics.");
      fields.topics_covered = [...new Set(body.topicsCovered.map(topic => boundedText(topic, "Topic", 200).trim()))];
    }
    if (Object.hasOwn(body, "status")) {
      if (typeof body.status !== "string" || !["active", "paused", "completed"].includes(body.status)) throw new SessionApiError(400, "INVALID_STATUS", "Choose a supported study session status.");
      fields.status = body.status;
    }
    if (!Object.keys(fields).length) throw new SessionApiError(400, "EMPTY_UPDATE", "Provide a study session change.");
    const session = await updateOwnedSession(client, userId, sessionId, fields);
    if (new URL(request.url).searchParams.get("metadataOnly") === "true") return NextResponse.json({ success: true, requestId, data: { session } }, { headers: { "Cache-Control": "no-store" } });
    const messages = await getOwnedMessages(client, userId, sessionId);
    return NextResponse.json({ success: true, requestId, data: { session: { ...session, messages: messages.rows.map(message => ({
      id: message.id, role: message.role, content: message.content, createdAt: message.created_at, sources: message.sources ?? [],
    })) } } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return sessionFailure(error, requestId); }
}

export async function DELETE(_request: Request, context: Context) {
  const requestId = crypto.randomUUID();
  try {
    const { client, userId } = await identity();
    const { sessionId } = await context.params;
    assertSessionId(sessionId);
    await deleteOwnedSession(client, userId, sessionId);
    return NextResponse.json({ success: true, requestId });
  } catch (error) { return sessionFailure(error, requestId); }
}
