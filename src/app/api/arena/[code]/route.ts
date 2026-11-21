import { NextResponse, type NextRequest } from "next/server";
import { requireActiveUserApi, AuthApiError, authApiErrorResponse } from "@/lib/auth/require-active-user-api";
import { getArenaRoomByCode } from "@/lib/repositories/arena";
import { OperationError } from "@/lib/repositories/operations";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { user } = await requireActiveUserApi();
    const { code } = await context.params;

    if (!code) throw new OperationError("Missing room code.", 400);

    const room = await getArenaRoomByCode(code, user.id);

    return NextResponse.json(
      { success: true, data: room },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof AuthApiError) return authApiErrorResponse(error);
    if (error instanceof OperationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("[api:arena:code] GET error:", error);
    return NextResponse.json({ success: false, error: "Failed to load room." }, { status: 500 });
  }
}
