import { NextResponse, type NextRequest } from "next/server";
import { requireActiveUserApi, AuthApiError, authApiErrorResponse } from "@/lib/auth/require-active-user-api";
import { startArenaBattle } from "@/lib/repositories/arena";
import { OperationError } from "@/lib/repositories/operations";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { user } = await requireActiveUserApi();
    const { code } = await context.params;

    if (!code) throw new OperationError("Missing room code.", 400);

    const room = await startArenaBattle(code, user.id);

    return NextResponse.json(
      { success: true, data: room },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof AuthApiError) return authApiErrorResponse(error);
    if (error instanceof OperationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("[api:arena:start] POST error:", error);
    return NextResponse.json({ success: false, error: "Failed to start battle." }, { status: 500 });
  }
}
