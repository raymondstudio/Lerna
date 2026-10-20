import { createHash } from "node:crypto";
import { ActivityError } from "./contracts";
import { activityFilterIdentity, UUID, type ActivityFilters } from "./query";
export function filterHash(filters: ActivityFilters): string { return createHash("sha256").update(activityFilterIdentity(filters)).digest("hex"); }
type Cursor = { at: string; id: string; asOf: string; filter: string };
export function encodeActivityCursor(value: Cursor): string { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
export function decodeActivityCursor(value: string, filters: ActivityFilters): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Cursor;
    const timestamp = (input: unknown) => typeof input === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(input) && Number.isFinite(Date.parse(input));
    if (!timestamp(parsed.at) || !timestamp(parsed.asOf) || !UUID.test(parsed.id) || parsed.filter !== filterHash(filters) || Date.parse(parsed.at) > Date.parse(parsed.asOf)) throw new Error();
    return parsed;
  } catch { throw new ActivityError("Cursor is invalid or belongs to different filters."); }
}
