import { NextResponse } from "next/server";
import { authorizeActiveUserApi } from "@/lib/auth/require-active-user-api";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  const auth = await authorizeActiveUserApi();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  try {
    const { id } = await context.params;
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("id, title, score, total_questions, created_at, course_id, courses(code, title)")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (quizError) throw quizError;
    if (!quiz) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: "NOT_FOUND",
            message: "Quiz not found.",
          },
        },
        { status: 404 }
      );
    }

    const { data: questions, error: questionsError } = await supabase
      .from("quiz_questions")
      .select("id, question_text, options, correct_answer, explanation, user_answer, is_correct")
      .eq("quiz_id", id)
      .order("created_at", { ascending: true });

    if (questionsError) {
      throw questionsError;
    }

    return NextResponse.json({
      success: true,
      requestId,
      data: {
        quiz,
        questions: questions.map((q) => ({
          id: q.id,
          questionText: q.question_text,
          options: q.options,
          correctAnswer: q.correct_answer,
          explanation: q.explanation,
          userAnswer: q.user_answer,
          isCorrect: q.is_correct,
        })),
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        requestId,
        error: {
          code: "SERVER_ERROR",
          message: "Unable to retrieve quiz details.",
        },
      },
      { status: 500 }
    );
  }
}
