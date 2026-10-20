import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/require-admin-api";
import { activityEnvironment, configuredSources } from "@/lib/activity/environment";
import { activityFailure } from "@/lib/activity/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireAdminApi();
    return NextResponse.json({ success: true, data: { current: activityEnvironment(), sources: configuredSources() } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return activityFailure(error); }
}
