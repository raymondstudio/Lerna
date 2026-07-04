import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
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
            message: "You must be signed in to view quizzes.",
          },
        },
        { status: 401 }
      );
    }

    const { data: quizzes, error } = await supabase
      .from("quizzes")
      .select("id, title, score, total_questions, created_at, course_id, courses(code, title)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      requestId,
      data: {
        quizzes,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        requestId,
        error: {
          code: "SERVER_ERROR",
          message: error instanceof Error ? error.message : "Unable to retrieve your quizzes.",
        },
      },
      { status: 500 }
    );
  }
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
            message: "You must be signed in to save quiz results.",
          },
        },
        { status: 401 }
      );
    }

    const body: unknown = await req.json();
    const {
      courseId,
      materialId,
      title,
      score,
      totalQuestions,
      type,
      timeSpent,
      difficulty,
      topic,
      questions,
    } = body as {
      courseId?: string;
      materialId?: string;
      title: string;
      score: number;
      totalQuestions: number;
      type?: string;
      timeSpent?: number;
      difficulty?: string;
      topic?: string;
      questions: Array<{
        questionText: string;
        options: string[];
        correctAnswer: string;
        explanation?: string;
        userAnswer?: string;
        isCorrect: boolean;
      }>;
    };

    if (!title || typeof score !== "number" || typeof totalQuestions !== "number" || !Array.isArray(questions)) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: "BAD_REQUEST",
            message: "Missing or invalid fields in request body.",
          },
        },
        { status: 400 }
      );
    }

    // 1. Insert Quiz
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .insert({
        user_id: user.id,
        course_id: courseId || null,
        material_id: materialId || null,
        title,
        score,
        total_questions: totalQuestions,
        type: type || "mcq",
        time_spent: timeSpent || null,
        difficulty: difficulty || "Medium",
        topic: topic || "General",
      })
      .select()
      .single();

    if (quizError || !quiz) {
      throw quizError ?? new Error("Failed to insert quiz header.");
    }

    // 2. Insert Quiz Questions
    const questionsToInsert = questions.map((q) => ({
      quiz_id: quiz.id,
      question_text: q.questionText,
      options: q.options,
      correct_answer: q.correctAnswer,
      explanation: q.explanation || null,
      user_answer: q.userAnswer || null,
      is_correct: q.isCorrect,
    }));

    const { error: questionsError } = await supabase
      .from("quiz_questions")
      .insert(questionsToInsert);

    if (questionsError) {
      throw questionsError;
    }

    return NextResponse.json({
      success: true,
      requestId,
      data: {
        quizId: quiz.id,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        requestId,
        error: {
          code: "SERVER_ERROR",
          message: error instanceof Error ? error.message : "Unable to save quiz results.",
        },
      },
      { status: 500 }
    );
  }
}
