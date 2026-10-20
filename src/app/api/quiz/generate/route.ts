import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireActiveUserApi, AuthApiError, authApiErrorResponse } from "@/lib/auth/require-active-user-api";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { generateText } from "@/lib/gemini/client";
import { quizContext } from "@/lib/repositories/quiz-context";
import { OperationError } from "@/lib/repositories/operations";
export const dynamic = "force-dynamic";
const input = z.object({ materialId: z.string().uuid().optional(), courseId: z.string().uuid().optional(), type: z.enum(["mcq","flashcard","short_answer"]).default("mcq"), count: z.number().int().min(3).max(15).default(5) }).strict();
const output = z.object({ questions: z.array(z.object({ question: z.string().min(1).max(5000), options: z.array(z.string().min(1).max(2000)).length(4), correct_answer: z.string().min(1).max(2000), explanation: z.string().max(5000) })).min(1).max(15) });
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase, user } = await requireActiveUserApi();
    const parsed = input.safeParse(await readBoundedJson(request, 8192));
    if (!parsed.success) throw new OperationError("Check the quiz type, count and selected materials.", 400);
    const { materialId, courseId, type, count: clampedCount } = parsed.data;
    const materialContext = await quizContext(supabase, user.id, materialId, courseId);
    const typeLabel = type === "mcq" ? "multiple-choice" : type === "flashcard" ? "flashcard" : "short-answer";
    const prompt = `You are an expert academic quiz generator. Generate exactly ${clampedCount} ${typeLabel} questions suitable for a student study quiz.
${materialContext ? materialContext : "Generate questions based on general academic knowledge."}

Return ONLY a valid JSON object in this exact format (no markdown, no code blocks, just pure JSON):
{
  "questions": [
    {
      "question": "Clear, specific question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}

Rules:
- For ${typeLabel} questions, always include exactly 4 options
- Make questions educational and test genuine understanding
- Vary difficulty (some easy, some medium, some hard)
- Explanations should be concise but informative (1-2 sentences)
- Do NOT include question numbers in the question text`;
    const result = await generateText(prompt, { userId: user.id, signal: request.signal, requestType: type === "flashcard" ? "flashcard" : "quiz" });
    let raw: unknown;
    try { raw = JSON.parse(result.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "")); }
    catch { throw new OperationError("The generated questions were incomplete. Please try again later."); }
    const validated = output.safeParse(raw);
    if (!validated.success || validated.data.questions.length !== clampedCount || validated.data.questions.some(q => !q.options.includes(q.correct_answer))) throw new OperationError("The generated questions were incomplete. Please try again later.");
    const questions = validated.data.questions.map((q, index) => ({ ...q, id: 'q-' + requestId + '-' + index }));
    return NextResponse.json({ success: true, requestId, data: { questions, type, count: questions.length, operation: result.operation, resultSource: "client_reported_practice" } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthApiError) return authApiErrorResponse(error);
    const status = error instanceof OperationError ? error.status : 503;
    return NextResponse.json({ success: false, requestId, error: { code: "GENERATION_FAILED", message: error instanceof OperationError ? error.message : "Quiz generation is unavailable. Please retry later." } }, { status });
  }
}
