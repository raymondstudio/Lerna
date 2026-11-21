import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireActiveUserApi, AuthApiError, authApiErrorResponse } from "@/lib/auth/require-active-user-api";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { generateText } from "@/lib/gemini/client";
import { quizContext } from "@/lib/repositories/quiz-context";
import { createArenaRoom, getUserRecentRooms } from "@/lib/repositories/arena";
import { OperationError } from "@/lib/repositories/operations";

export const dynamic = "force-dynamic";

const createRoomSchema = z
  .object({
    title: z.string().min(1).max(100).optional(),
    materialId: z.string().uuid().optional(),
    courseId: z.string().uuid().optional(),
    count: z.number().int().min(3).max(20).default(5),
    durationMinutes: z.number().int().min(1).max(30).default(5),
  })
  .strict();

const questionsOutputSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1).max(5000),
        options: z.array(z.string().min(1).max(2000)).length(4),
        correct_answer: z.string().min(1).max(2000),
        explanation: z.string().max(5000),
      })
    )
    .min(1)
    .max(20),
});

export async function GET() {
  try {
    const { user } = await requireActiveUserApi();
    const rooms = await getUserRecentRooms(user.id);
    return NextResponse.json({ success: true, data: rooms }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthApiError) return authApiErrorResponse(error);
    return NextResponse.json({ success: false, error: "Failed to load battles." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireActiveUserApi();
    const body = await readBoundedJson(request, 8192);
    const parsed = createRoomSchema.safeParse(body);

    if (!parsed.success) {
      throw new OperationError("Check the room settings and selected course.", 400);
    }

    const { title: rawTitle, materialId, courseId, count: clampedCount, durationMinutes } = parsed.data;

    let roomTitle = rawTitle?.trim();
    if (!roomTitle && courseId) {
      const { data: c } = await supabase.from("courses").select("code").eq("id", courseId).maybeSingle();
      if (c?.code) roomTitle = `${c.code} Quiz Battle`;
    }
    if (!roomTitle) {
      roomTitle = "Quiz Battle";
    }

    // 1. Fetch material / course context if provided
    const materialContext = await quizContext(supabase, user.id, materialId, courseId);

    // 2. Fetch User Profile for display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    const hostName =
      profile?.first_name || profile?.last_name
        ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
        : user.email?.split("@")[0] || "Host";

    // 3. Generate Questions using Gemini
    const prompt = `You are an expert academic quiz generator for a multiplayer student study battle.
Generate exactly ${clampedCount} multiple-choice questions.
${materialContext ? materialContext : "Generate high-yield educational questions based on general undergraduate academic curriculum."}

Return ONLY a valid JSON object in this exact format (no markdown, no backticks, no code blocks, just pure JSON):
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
- Always include exactly 4 options per question
- Make questions educational, rigorous and conceptual
- Explanations must be concise (1-2 sentences)
- Options array must contain the correct_answer string exactly
- Do NOT include question numbers in the question text`;

    const result = await generateText(prompt, {
      userId: user.id,
      signal: request.signal,
      requestType: "quiz",
    });

    let raw: unknown;
    try {
      raw = JSON.parse(
        result.text
          .trim()
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/```\s*$/i, "")
      );
    } catch {
      throw new OperationError("Question generation failed. Please retry.", 500);
    }

    const validated = questionsOutputSchema.safeParse(raw);
    if (!validated.success || validated.data.questions.length !== clampedCount) {
      throw new OperationError("The generated questions were incomplete. Please retry.", 500);
    }

    // 4. Create Room in Postgres
    const room = await createArenaRoom(
      user.id,
      hostName,
      profile?.avatar_url,
      {
        title: roomTitle,
        courseId,
        materialId,
        durationSeconds: durationMinutes * 60,
      },
      validated.data.questions
    );

    return NextResponse.json(
      {
        success: true,
        data: room,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof AuthApiError) return authApiErrorResponse(error);
    if (error instanceof OperationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("[api:arena] POST error:", error);
    return NextResponse.json({ success: false, error: "Failed to create battle room." }, { status: 500 });
  }
}
