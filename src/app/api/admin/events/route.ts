import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/require-admin-api";
import { activityEnvironment } from "@/lib/activity/environment";
import { parseActivityFilters } from "@/lib/activity/query";
import { readActivity, readActivitySummary } from "@/lib/activity/sources";
import { appendActivityEvent } from "@/lib/repositories/activity";
import { filterHash } from "@/lib/activity/cursor";
import { activityFailure } from "@/lib/activity/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { user } = await requireAdminApi();
    const params = new URL(request.url).searchParams;
    const filters = parseActivityFilters(params, activityEnvironment());
    const auditFilters = { ...filters, startAt: new Date(Math.floor(Date.parse(filters.startAt) / 900000) * 900000).toISOString(), endAt: new Date(Math.floor(Date.parse(filters.endAt) / 900000) * 900000).toISOString() };
    const hash = filterHash(auditFilters);
    await appendActivityEvent({ event_type: "admin.activity.read", user_id: user.id, category: "admin", outcome: "attempted", properties: { filter_hash: hash }, dedup_key: `activity-read:${user.id}:${hash}:${Math.floor(Date.now() / 900000)}` });
    const [page, summary] = await Promise.all([readActivity(filters), params.get("summary") === "true" ? readActivitySummary(filters) : Promise.resolve(undefined)]);
    return NextResponse.json({ success: true, data: { ...page, summary } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return activityFailure(error); }
}
