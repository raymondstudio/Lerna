import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildProfileUpdatePayload, stripUndefined } from "@/lib/profile";

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

export async function updateUserProfile(userId: string, data: Record<string, any>) {
  const supabase = await createSupabaseServerClient();
  const payload = stripUndefined(buildProfileUpdatePayload(data));
  const { data: updated, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    console.error("[repo:users] updateUserProfile error:", error.message);
    throw error;
  }

  // Record telemetry event in background
  try {
    await supabase.from("events").insert({
      user_id: userId,
      event_type: "profile_updated",
      properties: {
        first_name: payload.first_name,
        last_name: payload.last_name,
      },
    });
  } catch (eventErr) {
    console.warn("[repo:users] profile_updated event log warning:", eventErr);
  }

  return updated;
}

export async function getUserAccountStats(userId: string) {
  const supabase = await createSupabaseServerClient();
  const [profileRes, docsRes, sessionsRes, aiRequestsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("learning_streak, hours_studied, last_active")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("uploaded_materials")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null),
    supabase
      .from("study_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("ai_requests")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  return {
    streak: profileRes.data?.learning_streak || 0,
    hours: Number(profileRes.data?.hours_studied) || 0,
    lastActive: profileRes.data?.last_active || null,
    documents: docsRes.count || 0,
    sessions: sessionsRes.count || 0,
    questions: aiRequestsRes.count || 0,
  };
}
