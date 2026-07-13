import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function selectUserProfile(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      *,
      institutions(*),
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

export async function checkEmailExists(email: string): Promise<boolean> {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .limit(1);

  if (error) {
    console.error("[repo:users] checkEmailExists error:", error.message);
    throw error;
  }
  return data && data.length > 0 ? true : false;
}

