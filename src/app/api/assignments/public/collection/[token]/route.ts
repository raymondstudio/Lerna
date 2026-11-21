import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCollectionByShareToken, AssignmentApiError } from "@/lib/repositories/assignments";

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
        { success: false, requestId, error: { message: "Invalid collection share token." } },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const result = await getCollectionByShareToken(supabase, token);

    if (!result || !result.collection.isPublic) {
      return NextResponse.json(
        { success: false, requestId, error: { message: "This assignments collection is either private or does not exist." } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      requestId,
      collection: result.collection,
      courses: result.courses,
    });
  } catch (error) {
    const status = error instanceof AssignmentApiError ? error.status : 500;
    return NextResponse.json(
      { success: false, requestId, error: { message: error instanceof Error ? error.message : "Failed to load collection." } },
      { status }
    );
  }
}
