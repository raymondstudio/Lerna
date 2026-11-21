import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireActiveUserApi, AuthApiError, authApiErrorResponse } from "@/lib/auth/require-active-user-api";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { submitArenaAnswers } from "@/lib/repositories/arena";
import { OperationError } from "@/lib/repositories/operations";

export const dynamic = "force-dynamic";

const submitSchema = z
  .object({
    answers: z.record(z.string()),
    timeTakenSeconds: z.number().min(0).max(7200).optional(),
  })
  .strict();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { user } = await requireActiveUserApi();
    const { code } = await context.params;

    if (!code) throw new OperationError("Missing room code.", 400);

    const body = await readBoundedJson(request, 8192);
    const parsed = submitSchema.safeParse(body);

    if (!parsed.success) {
      throw new OperationError("Invalid submission data.", 400);
    }

    const room = await submitArenaAnswers(
      code,
      user.id,
      parsed.data.answers,
      parsed.data.timeTakenSeconds
    );

    return NextResponse.json(
      { success: true, data: room },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof AuthApiError) return authApiErrorResponse(error);
    if (error instanceof OperationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("[api:arena:submit] POST error:", error);
    return NextResponse.json({ success: false, error: "Failed to submit battle." }, { status: 500 });
  }
}
