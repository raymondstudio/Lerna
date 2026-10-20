import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { activityEnvironment } from "@/lib/activity/environment";

export async function getAdminHealth(db: SupabaseClient) {
  const [latencies, failures, events, health, cleanup] = await Promise.all([
    db.from("ai_requests").select("latency_ms").eq("authoritative_outcome", "succeeded").not("latency_ms","is",null).order("created_at",{ascending:false}).limit(100),
    db.from("ai_requests").select("id,model_used,request_type,authoritative_outcome,created_at").in("authoritative_outcome",["failed","unknown"]).order("created_at",{ascending:false}).limit(20),
    db.from("events").select("id,event_type,properties,created_at").eq("schema_version",1).eq("environment",activityEnvironment()).in("outcome",["failed","unknown"]).order("received_at",{ascending:false}).limit(20),
    db.rpc("check_system_health"),
    createSupabaseAdminClient().rpc("material_cleanup_status"),
  ]);
  if ([latencies,failures,events,health,cleanup].some(result => result.error)) throw new Error("System diagnostics are unavailable.");
  const durations = (latencies.data ?? []).map(row => Number(row.latency_ms)).filter(Number.isFinite);
  return {
    latencies: { apiGateway: null, geminiResponse: durations.length ? Math.round(durations.reduce((sum,value)=>sum+value,0)/durations.length) : null, searchRetrieval: null, pdfProcessing: null },
    failedAiRequests: (failures.data ?? []).map(row => ({ ...row, error_message: row.authoritative_outcome === "unknown" ? "Provider outcome unknown; budget held for reconciliation." : "Provider request failed." })),
    failedEvents: (events.data ?? []).map(row => ({ id: row.id, event_name: row.event_type, event_properties: row.properties, created_at: row.created_at })),
    webhooks: [{ service: "Stripe", status: "Not verified", lastEvent: "Provider verification pending" },{ service: "Paystack", status: "Not verified", lastEvent: "Provider verification pending" }],
    dbHealth: health.data, materialCleanup: cleanup.data,
  };
}
