import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getUserProfile(userId: string) {
  const supabase = await createSupabaseServerClient();
  
  // Single optimized joins query to fetch all normalized user data
  const { data: profile, error: profileErr } = await supabase
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

  if (profileErr || !profile) {
    return null;
  }

  // Format array to a clean flat structure
  const pref = Array.isArray(profile.user_preferences) 
    ? profile.user_preferences[0] 
    : profile.user_preferences;

  const notif = Array.isArray(profile.notification_preferences) 
    ? profile.notification_preferences[0] 
    : profile.notification_preferences;

  const sub = Array.isArray(profile.subscriptions) 
    ? profile.subscriptions[0] 
    : profile.subscriptions;

  const r = Array.isArray(profile.user_roles) 
    ? profile.user_roles[0] 
    : profile.user_roles;

  return {
    id: profile.id,
    email: profile.email,
    firstName: profile.first_name || "",
    lastName: profile.last_name || "",
    avatarUrl: profile.avatar_url || "",
    onboardingCompleted: profile.onboarding_completed || false,
    institution: profile.institution || "",
    department: profile.department || "",
    studyLevel: profile.study_level || "Undergraduate",
    accountType: profile.account_type || "Student",
    isStudent: profile.is_student ?? true,
    gender: profile.gender || "",
    age: profile.age || "",
    isSuspended: profile.is_suspended || false,
    isDeleted: profile.is_deleted || false,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
    lastActive: profile.last_active,
    
    // Preferences
    teachingStyle: pref?.teaching_style || "Intermediate",
    difficulty: pref?.difficulty || "Medium",
    preferredLanguage: pref?.preferred_language || "English",
    preferredQuizFormat: pref?.preferred_quiz_format || "Mixed",
    flashcardPreference: pref?.flashcard_preference || "Standard",
    responseLength: pref?.response_length || "Medium",
    voicePreference: pref?.voice_preference || "Default",
    learningGoals: pref?.learning_goals || [],

    // Notifications
    marketingUpdatesEnabled: notif?.marketing ?? true,
    securityAlertsEnabled: notif?.security_alerts ?? true,
    studyReminderEnabled: notif?.study_reminders ?? true,
    productUpdatesEnabled: notif?.product_updates ?? true,
    announcementsEnabled: notif?.announcements ?? true,

    // Subscription status
    plan: sub?.plan || "free",
    subscriptionStatus: sub?.status || "active",

    // Role
    role: r?.role || "user",
  };
}

export async function updateProfile(userId: string, data: any) {
  const supabase = await createSupabaseServerClient();
  
  // 1. Update profiles table
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      first_name: data.firstName?.trim() || "",
      last_name: data.lastName?.trim() || "",
      institution: data.institution?.trim() || "",
      department: data.department?.trim() || "",
      study_level: data.studyLevel,
      account_type: data.isStudent ? "Student" : "Non-Student",
      is_student: data.isStudent,
      gender: data.gender,
      age: data.age === "" ? null : Number(data.age),
      updated_at: new Date().toISOString()
    })
    .eq("id", userId);

  if (profileErr) throw profileErr;

  // 2. Update user_preferences
  const { error: prefErr } = await supabase
    .from("user_preferences")
    .update({
      teaching_style: data.teachingStyle,
      difficulty: data.difficulty,
      preferred_language: data.preferredLanguage,
      preferred_quiz_format: data.preferredQuizFormat,
      flashcard_preference: data.flashcardPreference,
      response_length: data.responseLength,
      voice_preference: data.voicePreference,
      learning_goals: data.learningGoals,
      updated_at: new Date().toISOString()
    })
    .eq("id", userId);

  if (prefErr) throw prefErr;

  // 3. Update notification_preferences
  const { error: notifErr } = await supabase
    .from("notification_preferences")
    .update({
      marketing: data.marketingUpdatesEnabled,
      product_updates: data.marketingUpdatesEnabled, // Keep synced
      security_alerts: data.securityAlertsEnabled,
      study_reminders: data.studyReminderEnabled,
      updated_at: new Date().toISOString()
    })
    .eq("id", userId);

  if (notifErr) throw notifErr;
  return true;
}
