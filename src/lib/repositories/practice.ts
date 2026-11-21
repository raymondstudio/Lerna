import type { SupabaseClient } from "@supabase/supabase-js";
import type { PracticeSubmission } from "@/lib/quiz/practice-validation";
import { MaterialBoundaryError } from "@/lib/uploads/validation";

export async function requireOwnedPracticeParents(supabase: SupabaseClient, userId: string, data: PracticeSubmission) {
  if (data.courseId) {
    const result = await supabase.from("courses").select("id").eq("id", data.courseId).eq("user_id", userId).maybeSingle();
    if (result.error) throw new MaterialBoundaryError("Course verification is unavailable.", 503);
    if (!result.data) throw new MaterialBoundaryError("Course not found.", 404, "NOT_FOUND");
  }
  if (data.materialId) {
    const result = await supabase.from("uploaded_materials").select("id,course_id").eq("id", data.materialId).eq("user_id", userId)
      .eq("status", "ready").is("deleted_at", null).maybeSingle();
    if (result.error) throw new MaterialBoundaryError("Material verification is unavailable.", 503);
    if (!result.data || (data.courseId && result.data.course_id !== data.courseId)) throw new MaterialBoundaryError("Material not found for this course.", 404, "NOT_FOUND");
  }
}
export async function savePracticeQuiz(supabase: SupabaseClient, data: PracticeSubmission, operationId: string) {
  const { data: quizId, error } = await supabase.rpc("save_practice_quiz", { p_payload: {
    operation_id: operationId, course_id: data.courseId ?? null, material_id: data.materialId ?? null,
    title: data.title, score: data.score, total_questions: data.totalQuestions, type: data.type,
    time_spent: data.timeSpent ?? null, difficulty: data.difficulty, topic: data.topic, result_source: "self_reported_practice",
    questions: data.questions.map((question) => ({ question_text: question.questionText, options: question.options,
      correct_answer: question.correctAnswer, explanation: question.explanation ?? null, user_answer: question.userAnswer ?? null, is_correct: question.isCorrect })),
  } });
  if (error?.code === "PT410") throw new MaterialBoundaryError("This saved practice result was deleted. Start a new attempt.", 410, "RESULT_DELETED");
  if (error?.code === "PT429") throw new MaterialBoundaryError("The practice result limit was reached. Retry later with the same attempt.", 429, "PRACTICE_LIMIT");
  if (error?.code === "PT409") throw new MaterialBoundaryError("This practice identifier was already used for another result.", 409, "OPERATION_ID_REUSED");
  if (error || typeof quizId !== "string") throw new MaterialBoundaryError("Quiz results could not be saved. Retry with the same attempt.", 503, "SAVE_FAILED");
  return quizId;
}
export async function listPracticeQuizzes(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.from("quizzes").select("id,title,score,total_questions,created_at,course_id,courses(code,title)")
    .eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw new MaterialBoundaryError("Quiz results could not be loaded.", 503);
  return data ?? [];
}
