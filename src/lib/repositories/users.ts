import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function selectUserProfile(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      *,
      user_preferences(*),
      notification_preferences(*),
      subscriptions(plan, status),
      user_roles(role)
    `)
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfileIdentity(userId: string, profileData: any) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update(profileData)
    .eq("id", userId);
  if (error) throw error;
  return true;
}

export async function updateProfilePreferences(userId: string, prefData: any) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("user_preferences")
    .update(prefData)
    .eq("id", userId);
  if (error) throw error;
  return true;
}

export async function updateProfileNotifications(userId: string, notifData: any) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notification_preferences")
    .update(notifData)
    .eq("id", userId);
  if (error) throw error;
  return true;
}
