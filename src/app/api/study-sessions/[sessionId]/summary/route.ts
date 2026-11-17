import { NextResponse, type NextRequest } from "next/server";
import { requireActiveUserApi } from "@/lib/auth/require-active-user-api";
import { generateText } from "@/lib/gemini/client";
import { assertSessionId, getOwnedSession, recentSummaryMessages, SessionApiError, updateOwnedSession } from "@/lib/repositories/study-sessions";
import { sessionFailure } from "@/lib/study-sessions/api";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase: client, user } = await requireActiveUserApi();
    const { sessionId } = await params;
    assertSessionId(sessionId);
    const session = await getOwnedSession(client, user.id, sessionId);
    if (session.summary) return NextResponse.json({ success: true, requestId, data: { summary: session.summary } }, { headers: { "Cache-Control": "no-store" } });
    if (session.status !== "completed") throw new SessionApiError(409, "SESSION_NOT_COMPLETED", "Save and complete this session before requesting its summary.");
    const messages = await recentSummaryMessages(client, user.id, sessionId);
    const durationMins = Math.round((session.duration_seconds ?? 0) / 60);
    const topics = Array.isArray(session.topics_covered) ? session.topics_covered : [];
    const chatLog = messages.map((message: { role: string; content: string }) => `${message.role === "user" ? "Student" : "AI Tutor"}: ${message.content}`).join("\n");
    const prompt = `You are an academic study assistant. Generate a concise, structured study session summary.

Session Title: "${session.title}"
Duration: ${durationMins} minutes
Topics Covered: ${topics.length > 0 ? topics.join(", ") : "General study"}

${chatLog ? `Chat Summary:\n${chatLog.slice(0, 3000)}` : ""}

Write a clear study session summary with:
1. A brief overview of what was studied (2-3 sentences)
2. Key concepts covered (bullet points)
3. Recommended next steps (2-3 suggestions)

Keep the tone encouraging and academic. Format using plain text with clear headings.`;
    let summary: string;
    try {
      const result = await generateText(prompt);
      summary = result.text;
      if (!summary?.trim()) throw new Error("Empty provider result");
    } catch {
      throw new SessionApiError(502, "SUMMARY_UNAVAILABLE", "Your session is saved. Its AI summary is unavailable; retry later.");
    }
    await updateOwnedSession(client, user.id, sessionId, { summary });
    return NextResponse.json({ success: true, requestId, data: { summary } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return sessionFailure(error, requestId); }
}
