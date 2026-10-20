import { NextResponse } from "next/server";
import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const authorization = await authorizeAdminApi({ requireMfa: true });
  if (!authorization.ok) return authorization.response;
  try {
    const { targetUserId, action } = await req.json();
    if (typeof targetUserId !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(targetUserId) || !["add", "remove"].includes(action)) {
      return NextResponse.json({ success: false, error: "A valid user and action are required." }, { status: 400 });
    }
    const { error } = await authorization.supabase.rpc("admin_change_role", {
      target_user_id: targetUserId, new_role: action === "add" ? "admin" : "user",
    });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    // A rejected privileged RPC must never fall back to a weaker table mutation.
    return NextResponse.json({ success: false, error: "Role could not be changed. Please retry." }, { status: 500 });
  }
}
