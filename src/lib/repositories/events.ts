import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function insertEvent(userId: string | null, eventType: string, properties: Record<string, any>) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      user_id: userId,
      event_type: eventType,
      properties
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function selectRecentEvents(limit: number = 20) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, event_type, properties, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
