import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAssignmentByShareToken, AssignmentApiError } from "@/lib/repositories/assignments";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const requestId = crypto.randomUUID();
  try {
    const { token } = await params;
    if (!token || typeof token !== "string" || token.length < 16) {
      return NextResponse.json(
        { success: false, requestId, error: { message: "Invalid share token." } },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const result = await getAssignmentByShareToken(supabase, token);

    if (!result || !result.assignment.isPublic) {
      return NextResponse.json(
        { success: false, requestId, error: { message: "This shared assignment is either private or does not exist." } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      requestId,
      assignment: result.assignment,
      messages: result.messages,
      attachments: result.attachments,
    });
  } catch (error) {
    const status = error instanceof AssignmentApiError ? error.status : 500;
    return NextResponse.json(
      { success: false, requestId, error: { message: error instanceof Error ? error.message : "Failed to load shared assignment." } },
      { status }
    );
  }
}
