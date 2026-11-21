import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireActiveUserApi, AuthApiError, authApiErrorResponse } from "@/lib/auth/require-active-user-api";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { updateArenaProgress } from "@/lib/repositories/arena";
import { OperationError } from "@/lib/repositories/operations";

export const dynamic = "force-dynamic";

const progressSchema = z
  .object({
    totalAnswered: z.number().int().min(0),
    answers: z.record(z.string()).default({}),
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

    const body = await readBoundedJson(request, 4096);
    const parsed = progressSchema.safeParse(body);

    if (!parsed.success) {
      throw new OperationError("Invalid progress payload.", 400);
    }

    await updateArenaProgress(code, user.id, parsed.data.totalAnswered, parsed.data.answers);

    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthApiError) return authApiErrorResponse(error);
    if (error instanceof OperationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: "Progress update failed." }, { status: 500 });
  }
}
