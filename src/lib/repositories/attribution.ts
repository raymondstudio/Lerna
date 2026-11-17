import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ReportedAttribution = { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; referrer: string | null };
export async function saveReportedAttribution(userId: string, attribution: ReportedAttribution) {
  const { error } = await createSupabaseAdminClient().from("user_attribution").upsert({ user_id: userId, ...attribution }, { onConflict: "user_id" });
  if (error) throw new Error("Attribution could not be saved.");
}
