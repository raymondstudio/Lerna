import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { selectUserProfile, updateUserProfile } from "@/lib/repositories/users";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", requestId },
        { status: 401 }
      );
    }

    const profile = await selectUserProfile(user.id);
    return NextResponse.json({ success: true, data: profile, requestId });
  } catch (error) {
    console.error("[api:account:profile:GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch user profile", requestId },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", requestId },
        { status: 401 }
      );
    }

    const body = await req.json();
    const updated = await updateUserProfile(user.id, body);

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      data: updated,
      requestId,
    });
  } catch (error) {
    console.error("[api:account:profile:PATCH] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update profile",
        requestId,
      },
      { status: 500 }
    );
  }
}
