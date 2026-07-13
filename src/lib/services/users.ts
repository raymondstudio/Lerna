import { buildProfileUpdatePayload, normalizeProfile, stripUndefined } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getUserProfile(userId: string) {
  const supabase = await createSupabaseServerClient();
  const [profileResult, subscriptionResult, roleResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("subscriptions").select("plan, status, billing_cycle, subscription_status").eq("user_id", userId).single(),
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
  ]);

  if (profileResult.error || !profileResult.data) {
    return null;
  }

  return normalizeProfile(profileResult.data, subscriptionResult.data, roleResult.data);
}

export async function updateProfile(userId: string, data: any) {
  const supabase = await createSupabaseServerClient();
  const payload = stripUndefined(buildProfileUpdatePayload({
    ...data,
    accountType: data.accountType || (data.isStudent ? "Student" : "Non-Student"),
  }));

  const { error: profileErr } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", userId);

  if (profileErr) throw profileErr;
  return true;
}
