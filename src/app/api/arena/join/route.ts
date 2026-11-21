import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireActiveUserApi, AuthApiError, authApiErrorResponse } from "@/lib/auth/require-active-user-api";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { joinArenaRoom } from "@/lib/repositories/arena";
import { OperationError } from "@/lib/repositories/operations";

export const dynamic = "force-dynamic";

const joinSchema = z
  .object({
    code: z.string().min(4).max(10),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireActiveUserApi();
    const body = await readBoundedJson(request, 1024);
    const parsed = joinSchema.safeParse(body);

    if (!parsed.success) {
      throw new OperationError("Please provide a valid room code.", 400);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    const displayName =
      profile?.first_name || profile?.last_name
        ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
        : user.email?.split("@")[0] || "Student";

    const room = await joinArenaRoom(parsed.data.code, user.id, displayName, profile?.avatar_url);

    return NextResponse.json(
      { success: true, data: room },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof AuthApiError) return authApiErrorResponse(error);
    if (error instanceof OperationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("[api:arena:join] POST error:", error);
    return NextResponse.json({ success: false, error: "Failed to join room." }, { status: 500 });
  }
}
