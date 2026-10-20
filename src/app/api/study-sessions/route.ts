import { NextResponse } from "next/server";
import { requireActiveUserApi } from "@/lib/auth/require-active-user-api";
import { generateStudySessionTitle } from "@/lib/study-sessions/title";
import { assertSessionId, createOwnedSession, getOwnedMessages, listOwnedSessions, SessionApiError } from "@/lib/repositories/study-sessions";
import { boundedLimit, boundedText, readSessionBody, sessionFailure } from "@/lib/study-sessions/api";

async function identity() {
  const { supabase, user } = await requireActiveUserApi();
  return { client: supabase, userId: user.id };
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const { client, userId } = await identity();
    const url = new URL(request.url);
    const summary = url.searchParams.get("summary") === "true";
    const search = (url.searchParams.get("query") ?? "").slice(0, 100).replace(/[^\p{L}\p{N}\s._-]/gu, " ").replace(/\s+/g, " ").trim();
    const result = await listOwnedSessions(client, userId, { limit: boundedLimit(url.searchParams.get("limit"), summary ? 50 : 200), before: url.searchParams.get("before"), search });
    if (!summary) {
      for (const session of result.sessions) {
        const history = await getOwnedMessages(client, userId, session.id);
        session.messages = history.rows.map(message => ({ id: message.id, role: message.role, content: message.content, createdAt: message.created_at, sources: message.sources ?? [] }));
      }
    }
    return NextResponse.json({ success: true, requestId, data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return sessionFailure(error, requestId); }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const { client, userId } = await identity();
    const body = await readSessionBody(request);
    const allowed = new Set(["title", "firstPrompt", "topicCategory", "courseId", "operationId"]);
    if (Object.keys(body).some(key => !allowed.has(key))) throw new SessionApiError(400, "INVALID_REQUEST", "This study session contains an unsupported field.");
    const firstPrompt = body.firstPrompt === undefined ? "" : boundedText(body.firstPrompt, "First prompt", 10_000, true);
    const title = body.title === undefined || body.title === "" ? generateStudySessionTitle(firstPrompt) : boundedText(body.title, "Title", 200).trim();
    const topicCategory = body.topicCategory === undefined ? "General" : boundedText(body.topicCategory, "Topic category", 100).trim();
    if (body.courseId !== undefined && body.courseId !== null) assertSessionId(body.courseId);
    if (body.operationId !== undefined) assertSessionId(body.operationId);
    const session = await createOwnedSession(client, userId, { title, topicCategory,
      courseId: typeof body.courseId === "string" ? body.courseId : null,
      operationId: typeof body.operationId === "string" ? body.operationId : undefined,
    });
    const history = await getOwnedMessages(client, userId, session.id);
    session.messages = history.rows.map(message => ({ id: message.id, role: message.role, content: message.content, createdAt: message.created_at, sources: message.sources ?? [] }));
    return NextResponse.json({ success: true, requestId, data: { session } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return sessionFailure(error, requestId); }
}
