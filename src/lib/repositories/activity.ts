import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ActivityError, validateMetadata, type ActivityRow, type ActivityPage, type ActivitySummary, type ActivityEventType } from "@/lib/activity/contracts";
import { activityEnvironment, activityRelease } from "@/lib/activity/environment";
import { decodeActivityCursor, encodeActivityCursor, filterHash } from "@/lib/activity/cursor";
import type { ActivityFilters } from "@/lib/activity/query";

const COLUMNS = "id,user_id,event_type,properties,created_at,received_at,occurred_at,schema_version,environment,release_id,category,outcome,severity,source,actor_type,actor_role,request_id,activity_id,route,resource_type,resource_id";
export type ActivityWrite = {
  event_type: ActivityEventType; user_id: string | null; category: ActivityRow["category"];
  outcome: ActivityRow["outcome"]; severity?: ActivityRow["severity"]; source?: "server" | "browser_reported" | "provider";
  actor_role?: string | null; request_id?: string; activity_id?: string; route?: string;
  resource_type?: string; resource_id?: string; properties?: Record<string, unknown>; dedup_key: string;
};
export async function appendActivityEvent(input: ActivityWrite): Promise<string> {
  const properties = validateMetadata(input.event_type, input.properties);
  if (!input.dedup_key || input.dedup_key.length > 200 || /[\r\n\x00-\x1f]/.test(input.dedup_key)) throw new ActivityError("Invalid event deduplication key.");
  const { data, error } = await createSupabaseAdminClient().rpc("append_activity_event", { p_event: {
    ...input, properties, schema_version: 1, environment: activityEnvironment(), release_id: activityRelease(),
    severity: input.severity ?? "info", source: input.source ?? "server", actor_type: input.user_id ? "user" : "system",
  } });
  if (error || !data) throw new ActivityError("Activity persistence is unavailable.", 503);
  return String(data);
}
function baseQuery(filters: ActivityFilters, count = false) {
  const admin = createSupabaseAdminClient();
  let query = count ? admin.from("events").select("id", { count: "exact", head: true }) : admin.from("events").select(COLUMNS);
  query = query.eq("schema_version", 1).eq("environment", filters.environment).gte("received_at", filters.startAt).lt("received_at", filters.endAt);
  for (const [column, value] of Object.entries({ user_id: filters.userId, category: filters.category, outcome: filters.outcome, severity: filters.severity, event_type: filters.eventType, route: filters.route, request_id: filters.requestId, activity_id: filters.activityId })) if (value) query = query.eq(column, value);
  return query;
}
export async function selectActivity(filters: ActivityFilters): Promise<ActivityPage> {
  const cursor = filters.cursor ? decodeActivityCursor(filters.cursor, filters) : null;
  const asOf = cursor?.asOf ?? new Date().toISOString();
  let query = baseQuery(filters).lte("received_at", asOf);
  if (cursor) query = query.or(`received_at.lt.${cursor.at},and(received_at.eq.${cursor.at},id.lt.${cursor.id})`);
  const { data, error } = await query.order("received_at", { ascending: false }).order("id", { ascending: false }).limit(filters.limit + 1);
  if (error) throw new ActivityError("Unable to query activity.", 503);
  const rows = (data ?? []) as unknown as ActivityRow[];
  const events = rows.slice(0, filters.limit).map((row) => ({ ...row, properties: validateMetadata(row.event_type, row.properties) }));
  const last = events.at(-1);
  return { events, nextCursor: rows.length > filters.limit && last ? encodeActivityCursor({ at: last.received_at, id: last.id, asOf, filter: filterHash(filters) }) : null, asOf, lastUpdated: new Date().toISOString(), environment: filters.environment, startAt: filters.startAt, endAt: filters.endAt };
}
export async function summarizeActivity(filters: ActivityFilters): Promise<ActivitySummary> {
  const results = await Promise.all([
    baseQuery(filters, true),
    baseQuery(filters, true).eq("event_type", "note.saved").eq("outcome", "succeeded"),
    baseQuery(filters, true).eq("event_type", "ai.request.completed").eq("outcome", "succeeded").eq("properties->>provider_mode", "live"),
    baseQuery(filters, true).eq("outcome", "failed"),
    baseQuery(filters, true).eq("event_type", "page.viewed").eq("source", "browser_reported"),
  ]);
  if (results.some((result) => result.error || result.count === null)) throw new ActivityError("Activity summary is unavailable.", 503);
  const counts = results.map((result) => result.count ?? 0);
  return { total: counts[0], successfulNoteWrites: counts[1], successfulAiRequests: counts[2], failed: counts[3], reportedViews: counts[4] };
}
export async function enforceActivityRateLimit(userId: string): Promise<boolean> {
  const { data, error } = await createSupabaseAdminClient().rpc("consume_activity_ingest_budget", { p_user_id: userId });
  if (error) throw new ActivityError("Activity ingestion is temporarily unavailable.", 503);
  return data === true;
}
export async function runActivityRetention(): Promise<unknown> {
  const { data, error } = await createSupabaseAdminClient().rpc("cleanup_activity_events", { p_page_days: 30, p_operational_days: 90, p_batch_size: 5000 });
  if (error) throw new ActivityError("Activity cleanup failed.", 503);
  return data;
}
