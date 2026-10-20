import { NextResponse } from "next/server";
import { requireActiveUserApi } from "@/lib/auth/require-active-user-api";
import { ActivityError, browserBatchSchema, normalizeRoute } from "./contracts";
import { appendActivityEvent, enforceActivityRateLimit } from "@/lib/repositories/activity";
import { activityFailure } from "./http";
export async function ingestActivity(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) throw new ActivityError("Cross-origin activity is not allowed.", 403);
    const { user } = await requireActiveUserApi();
    const declared = Number(request.headers.get("content-length"));
    if (declared > 32768) throw new ActivityError("Activity batch is too large.", 413);
    // Read incrementally: Request.text() alone does not bound chunked request memory.
    const reader = request.body?.getReader();
    if (!reader) throw new ActivityError("Activity batch is required.");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 32768) { await reader.cancel(); throw new ActivityError("Activity batch is too large.", 413); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let raw: unknown; try { raw = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ActivityError("Invalid activity JSON."); }
    const parsed = browserBatchSchema.safeParse(raw);
    if (!parsed.success) throw new ActivityError("Invalid reported activity batch.");
    if (!await enforceActivityRateLimit(user.id)) throw new ActivityError("Activity rate limit exceeded.", 429);
    // Validate the complete batch before making any writes.
    const events = parsed.data.events.map((event) => ({ ...event, route: normalizeRoute(event.route) }));
    for (const event of events) await appendActivityEvent({ event_type: event.event_type, user_id: user.id, category: event.event_type === "page.viewed" ? "navigation" : "study", outcome: "reported", source: "browser_reported", activity_id: event.activity_id, route: event.route, properties: {}, dedup_key: `browser:${user.id}:${event.activity_id}:${event.event_id}` });
    return NextResponse.json({ success: true, accepted: events.length }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return activityFailure(error); }
}
