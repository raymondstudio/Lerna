import { ActivityError, type ActivityPage, type ActivitySummary, type ActivityEnvironment } from "./contracts";
import { activityEnvironment, configuredSources } from "./environment";
import { activitySearchParams, type ActivityFilters } from "./query";
import { selectActivity, summarizeActivity } from "@/lib/repositories/activity";
async function remoteQuery<T>(environment: ActivityEnvironment, filters: ActivityFilters, summary: boolean): Promise<T> {
  if (!configuredSources().find((source) => source.environment === environment)?.available) throw new ActivityError("The selected activity source is unavailable.", 503);
  const prefix = `ACTIVITY_SOURCE_${environment.toUpperCase()}`;
  let url: URL;
  try { url = new URL(process.env[`${prefix}_URL`] ?? ""); } catch { throw new ActivityError("Activity source is not configured.", 503); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new ActivityError("Invalid activity source configuration.", 503);
  url.pathname = "/api/internal/activity"; url.search = activitySearchParams(filters).toString();
  if (summary) url.searchParams.set("summary", "true");
  const response = await fetch(url, { cache: "no-store", redirect: "error", headers: { Authorization: `Bearer ${process.env[`${prefix}_TOKEN`]}` }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new ActivityError("The selected activity source could not be queried.", 503);
  const payload = await response.json();
  if (!payload.success || payload.environment !== environment) throw new ActivityError("Activity source identity mismatch.", 503);
  return payload.data as T;
}
export async function readActivity(filters: ActivityFilters): Promise<ActivityPage> { return filters.environment === activityEnvironment() ? selectActivity(filters) : remoteQuery<ActivityPage>(filters.environment, filters, false); }
export async function readActivitySummary(filters: ActivityFilters): Promise<ActivitySummary> { return filters.environment === activityEnvironment() ? summarizeActivity(filters) : remoteQuery<ActivitySummary>(filters.environment, filters, true); }
