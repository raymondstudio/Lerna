import { NextResponse } from "next/server";
import { requireActiveUserApi } from "@/lib/auth/require-active-user-api";
import { materialErrorResponse } from "@/lib/uploads/api-error";
import { MaterialBoundaryError, isResourceId, readBoundedBody } from "@/lib/uploads/validation";
import { validatePracticeSubmission } from "@/lib/quiz/practice-validation";
import { listPracticeQuizzes, requireOwnedPracticeParents, savePracticeQuiz } from "@/lib/repositories/practice";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const { supabase, user } = await requireActiveUserApi();
    const quizzes = await listPracticeQuizzes(supabase, user.id);
    return NextResponse.json({ success: true, requestId, data: { quizzes } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return materialErrorResponse(error, requestId); }
}
export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase, user } = await requireActiveUserApi();
    const raw = JSON.parse((await readBoundedBody(request, 1024 * 1024)).toString("utf8"));
    const data = validatePracticeSubmission(raw);
    const operationId = request.headers.get("Idempotency-Key") ?? requestId;
    if (!isResourceId(operationId)) throw new MaterialBoundaryError("The practice attempt identifier is invalid.");
    await requireOwnedPracticeParents(supabase, user.id, data);
    const quizId = await savePracticeQuiz(supabase, data, operationId);
    return NextResponse.json({ success: true, requestId, data: { quizId, resultSource: "self_reported_practice" } });
  } catch (error) {
    if (error instanceof SyntaxError) return materialErrorResponse(new MaterialBoundaryError("Invalid quiz results."), requestId);
    return materialErrorResponse(error, requestId);
  }
}
