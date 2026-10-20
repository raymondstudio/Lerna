import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { activityEnvironment } from "@/lib/activity/environment";
import { parseActivityFilters } from "@/lib/activity/query";
import { ActivityError } from "@/lib/activity/contracts";
import { activityFailure } from "@/lib/activity/http";
import { appendActivityEvent, selectActivity, summarizeActivity } from "@/lib/repositories/activity";
import { filterHash } from "@/lib/activity/cursor";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const configured = process.env.ACTIVITY_READ_TOKEN;
    const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!configured || configured.length < 32 || !supplied || supplied.length > 512 || !timingSafeEqual(createHash("sha256").update(configured).digest(), createHash("sha256").update(supplied).digest())) throw new ActivityError("Unauthorized", 401);
    const params = new URL(request.url).searchParams; const environment = activityEnvironment();
    const filters = parseActivityFilters(params, environment);
    if (filters.environment !== environment) throw new ActivityError("Source environment mismatch.", 403);
    const hash = filterHash({ ...filters, startAt: new Date(Math.floor(Date.parse(filters.startAt) / 900000) * 900000).toISOString(), endAt: new Date(Math.floor(Date.parse(filters.endAt) / 900000) * 900000).toISOString() });
    await appendActivityEvent({ event_type: "admin.activity.read", user_id: null, category: "admin", outcome: "attempted", properties: { filter_hash: hash }, dedup_key: `source-read:${hash}:${Math.floor(Date.now() / 900000)}` });
    const data = params.get("summary") === "true" ? await summarizeActivity(filters) : await selectActivity(filters);
    return NextResponse.json({ success: true, environment, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return activityFailure(error); }
}
