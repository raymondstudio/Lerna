import { NextResponse } from "next/server";
import { authorizeActiveUserApi } from "@/lib/auth/require-active-user-api";
import { getUserQuotaUsage } from "@/lib/services/business";

export async function GET() {
  const auth = await authorizeActiveUserApi();
  if (!auth.ok) return auth.response;
  try {
    const usage = await getUserQuotaUsage(auth.user.id);
    return NextResponse.json(usage);
  } catch {
    console.error("[api:account:usage] fetch failed");
    return NextResponse.json({ error: "Usage could not be loaded." }, { status: 503 });
  }
}
