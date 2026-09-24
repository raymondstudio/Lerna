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

export async function updateProfilePreferences(userId: string, prefData: Record<string, unknown>) {
  const supabase = await createSupabaseServerClient();
  const profileData = {
    teaching_style: prefData.teaching_style,
    difficulty: prefData.difficulty,
    preferred_language: prefData.preferred_language,
    preferred_quiz_format: prefData.preferred_quiz_format,
    flashcard_preference: prefData.flashcard_preference,
    response_length: prefData.response_length,
    voice_preference: prefData.voice_preference,
    study_goals: prefData.learning_goals,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("profiles")
    .update(Object.fromEntries(Object.entries(profileData).filter(([, value]) => value !== undefined)))
    .eq("id", userId);
  if (error) throw error;
  return true;
}

export async function updateProfileNotifications(userId: string, notifData: Record<string, unknown>) {
  const supabase = await createSupabaseServerClient();
  const profileData = {
    marketing_updates_enabled: notifData.marketing,
    security_alerts_enabled: notifData.security_alerts,
    study_reminder_enabled: notifData.study_reminders,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("profiles")
    .update(Object.fromEntries(Object.entries(profileData).filter(([, value]) => value !== undefined)))
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
