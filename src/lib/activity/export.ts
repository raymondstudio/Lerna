import { requireAdminApi } from "@/lib/auth/require-admin-api";
import { parseActivityFilters } from "./query";
import { activityEnvironment } from "./environment";
import { readActivity } from "./sources";
import { ActivityError, type ActivityRow } from "./contracts";
import { appendActivityEvent } from "@/lib/repositories/activity";
import { filterHash } from "./cursor";
import { activityFailure } from "./http";
import { randomUUID } from "node:crypto";
import { activityCsvCell } from "./csv";
export async function createActivityExport(request: Request): Promise<Response> {
  try {
    const { user } = await requireAdminApi({ requireMfa: true });
    const params = new URL(request.url).searchParams;
    const format = params.get("format") ?? "csv";
    if (!["csv", "json"].includes(format)) throw new ActivityError("format must be csv or json.");
    const filters = parseActivityFilters(params, activityEnvironment());
    const initial = { ...filters, cursor: undefined, limit: 100 };
    const rows: ActivityRow[] = []; let cursor: string | undefined; let truncated = false;
    do {
      const page = await readActivity({ ...initial, cursor });
      rows.push(...page.events); cursor = page.nextCursor ?? undefined;
      if (rows.length >= 10000) { truncated = Boolean(cursor); break; }
    } while (cursor);
    // Collection can take several requests. Recheck demotion/suspension and AAL
    // immediately before auditing and releasing the collected rows.
    const current = await requireAdminApi({ requireMfa: true });
    if (current.user.id !== user.id) throw new ActivityError("The export identity changed. Start a new export.", 403);
    await appendActivityEvent({ event_type: "admin.activity.export", user_id: current.user.id, category: "admin", outcome: "succeeded", properties: { filter_hash: filterHash(initial), format: format as "csv" | "json", rows: rows.length, truncated }, dedup_key: `export:${randomUUID()}` });
    const headers = { "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename="lerna-activity.${format}"`, "X-Lerna-Export-Truncated": String(truncated), "X-Lerna-Range-Start": filters.startAt, "X-Lerna-Range-End": filters.endAt, "X-Lerna-Timezone": filters.timezone };
    if (format === "json") return Response.json({ dataset: "user_activity", generated_at: new Date().toISOString(), filters: initial, truncated, rows }, { headers });
    const columns = ["environment", "id", "received_at", "occurred_at", "user_id", "event_type", "category", "outcome", "severity", "source", "route", "request_id", "activity_id", "resource_type", "resource_id", "properties"] as const;
    const csv = [columns.map(activityCsvCell).join(","), ...rows.map((row) => columns.map((key) => activityCsvCell(row[key])).join(","))].join("\r\n");
    return new Response(`\uFEFF${csv}`, { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  } catch (error) { return activityFailure(error); }
}
