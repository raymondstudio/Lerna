import { timingSafeEqual } from "node:crypto";
import { runActivityRetention } from "@/lib/repositories/activity";
import { runMaterialCleanup, runReceiptCleanup, reconcileStaleOperations } from "@/lib/repositories/maintenance";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const expected = process.env.MAINTENANCE_JOB_TOKEN;
  const actual = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const expectedBytes = Buffer.from(expected ?? "", "utf8");
  const actualBytes = Buffer.from(actual, "utf8");
  if (expectedBytes.length < 32 || actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  // Each operation is independently bounded; one unavailable dependency must not
  // prevent independent retention or recovery cleanup from making progress.
  const names = ["materials", "activity", "recovery", "operations"] as const;
  const results = await Promise.allSettled([runMaterialCleanup(), runActivityRetention(), runReceiptCleanup(), reconcileStaleOperations()]);
  const data = Object.fromEntries(results.map((result, index) => [names[index], result.status === "fulfilled" ? { success: true, result: result.value } : { success: false, error: "Maintenance dependency unavailable." }]));
  const success = results.every(result => result.status === "fulfilled") && (results[0].status !== "fulfilled" || results[0].value.failed === 0);
  return Response.json({ success, data }, { status: success ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
