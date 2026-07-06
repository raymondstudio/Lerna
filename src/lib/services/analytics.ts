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
