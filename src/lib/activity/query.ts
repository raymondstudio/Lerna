import { CATEGORIES, ENVIRONMENTS, OUTCOMES, SEVERITIES, EVENT_TYPES, ActivityError, type ActivityEnvironment } from "./contracts";

export type ActivityFilters = {
  environment: ActivityEnvironment; startAt: string; endAt: string; timezone: string;
  userId?: string; category?: string; outcome?: string; severity?: string; eventType?: string;
  route?: string; requestId?: string; activityId?: string; limit: number; cursor?: string;
};
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseActivityFilters(params: URLSearchParams, current: ActivityEnvironment, now = new Date()): ActivityFilters {
  const environment = params.get("environment") ?? current;
  if (!(ENVIRONMENTS as readonly string[]).includes(environment)) throw new ActivityError("Invalid environment.");
  const timezone = params.get("timezone") ?? "Africa/Lagos";
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(); } catch { throw new ActivityError("Invalid timezone."); }
  const ranges: Record<string, number> = { "3h": 3 * 3600000, "24h": 86400000, "1d": 86400000, "3d": 3 * 86400000, "7d": 7 * 86400000, "30d": 30 * 86400000 };
  const range = params.get("range") ?? "30d";
  if (!Object.hasOwn(ranges, range) && range !== "custom") throw new ActivityError("Invalid activity range.");
  const parseTime = (value: string | null, fallback?: Date) => {
    // API timestamps are explicit UTC/offset values; UI performs local-to-UTC conversion.
    if (!value) { if (fallback) return fallback; throw new ActivityError("Custom range requires start_at and end_at."); }
    if (!/(Z|[+-]\d{2}:\d{2})$/i.test(value)) throw new ActivityError("Activity timestamps require a timezone offset.");
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new ActivityError("Invalid activity timestamp.");
    return date;
  };
  const end = parseTime(params.get("end_at"), range === "custom" ? undefined : now);
  const start = parseTime(params.get("start_at"), range === "custom" ? undefined : new Date(end.getTime() - ranges[range]));
  if (start >= end) throw new ActivityError("end_at must be later than start_at.");
  const rawLimit = params.get("limit");
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ActivityError("limit must be between 1 and 100.");
  const result: ActivityFilters = { environment: environment as ActivityEnvironment, startAt: start.toISOString(), endAt: end.toISOString(), timezone, limit };
  for (const [input, output] of [["user_id", "userId"], ["request_id", "requestId"], ["activity_id", "activityId"]] as const) {
    const value = params.get(input); if (value) { if (!UUID.test(value)) throw new ActivityError(`Invalid ${input}.`); result[output] = value; }
  }
  for (const [input, output, allowed] of [["category", "category", CATEGORIES], ["outcome", "outcome", OUTCOMES], ["severity", "severity", SEVERITIES], ["event_type", "eventType", EVENT_TYPES]] as const) {
    const value = params.get(input); if (value) { if (!(allowed as readonly string[]).includes(value)) throw new ActivityError(`Invalid ${input}.`); result[output] = value; }
  }
  const route = params.get("route");
  if (route) { if (!/^\/[a-zA-Z0-9_/[\]-]{0,179}$/.test(route)) throw new ActivityError("Invalid route."); result.route = route; }
  const cursor = params.get("cursor");
  if (cursor) { if (cursor.length > 2048) throw new ActivityError("Invalid cursor."); result.cursor = cursor; }
  return result;
}
export function activityFilterIdentity(filters: ActivityFilters): string {
  const { cursor: _cursor, limit: _limit, timezone: _timezone, ...stable } = filters;
  return JSON.stringify(stable);
}
export function activitySearchParams(filters: ActivityFilters): URLSearchParams {
  const params = new URLSearchParams({ environment: filters.environment, range: "custom", start_at: filters.startAt, end_at: filters.endAt, timezone: filters.timezone, limit: String(filters.limit) });
  for (const [key, value] of Object.entries({ user_id: filters.userId, category: filters.category, outcome: filters.outcome, severity: filters.severity, event_type: filters.eventType, route: filters.route, request_id: filters.requestId, activity_id: filters.activityId, cursor: filters.cursor })) if (value) params.set(key, value);
  return params;
}
