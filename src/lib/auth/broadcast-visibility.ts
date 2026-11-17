import type { NormalizedProfile } from "@/lib/profile";

type AudienceProfile = Pick<NormalizedProfile, "accountType" | "plan" | "institution" | "department">;
export type BroadcastVisibility = {
  status?: string | null; target_audience?: string | null;
  target_institution?: string | null; target_department?: string | null;
  scheduled_for?: string | null; expires_at?: string | null;
};
const normalized = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

export function isBroadcastVisibleToLearner(broadcast: BroadcastVisibility, profile: AudienceProfile, now = Date.now()) {
  if (broadcast.status !== "published") return false;
  if (broadcast.scheduled_for && !(Date.parse(broadcast.scheduled_for) <= now)) return false;
  if (broadcast.expires_at && !(Date.parse(broadcast.expires_at) > now)) return false;
  const audience = normalized(broadcast.target_audience) || "all";
  const matchesAudience = audience === "all"
    || (audience === "students" && normalized(profile.accountType) === "student")
    || (audience === "teachers" && normalized(profile.accountType) === "teacher")
    || (["free", "student", "premium", "pro", "team", "enterprise"].includes(audience) && normalized(profile.plan) === audience);
  if (!matchesAudience) return false;
  return (!normalized(broadcast.target_institution) || normalized(profile.institution) === normalized(broadcast.target_institution))
    && (!normalized(broadcast.target_department) || normalized(profile.department) === normalized(broadcast.target_department));
}
