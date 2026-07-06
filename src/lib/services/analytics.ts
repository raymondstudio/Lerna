import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function logEvent(
  userId: string | null | undefined,
  eventType: string,
  properties: Record<string, any> = {}
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("events").insert({
      user_id: userId || null,
      event_type: eventType,
      properties: properties,
    });
    if (error) {
      console.error(`[AnalyticsService] Failed to log event "${eventType}":`, error);
    }
  } catch (err) {
    console.error("[AnalyticsService] Exception in logEvent:", err);
  }
}

export async function triggerDailyStatsUpdate(dateString?: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const targetDate = dateString || new Date().toISOString().split("T")[0];
    const { error } = await supabase.rpc("recalculate_daily_stats", {
      target_date: targetDate,
    });
    if (error) {
      console.error("[AnalyticsService] recalculate_daily_stats failed:", error);
    }
  } catch (err) {
    console.error("[AnalyticsService] Exception in triggerDailyStatsUpdate:", err);
  }
}

export async function getRecentEvents(limit: number = 20) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, event_type, properties, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[AnalyticsService] getRecentEvents failed:", error);
    return [];
  }
  return data || [];
}

export async function getAverageAiLatency(limit: number = 10) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_requests")
    .select("latency_ms")
    .not("latency_ms", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[AnalyticsService] getAverageAiLatency failed:", error);
    return 0;
  }
  if (!data || data.length === 0) return 0;
  return Math.round(data.reduce((acc, curr) => acc + (curr.latency_ms || 0), 0) / data.length);
}
