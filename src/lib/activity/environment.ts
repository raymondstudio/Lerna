import { ENVIRONMENTS, ActivityError, type ActivityEnvironment } from "./contracts";

export function activityEnvironment(): ActivityEnvironment {
  const value = process.env.ACTIVITY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? (process.env.NODE_ENV !== "production" ? "local" : "");
  if (!(ENVIRONMENTS as readonly string[]).includes(value)) throw new ActivityError("Activity environment is not configured.", 503);
  return value as ActivityEnvironment;
}
export function activityRelease(): string | null {
  const release = process.env.ACTIVITY_RELEASE_ID ?? process.env.VERCEL_GIT_COMMIT_SHA;
  return release && /^[a-zA-Z0-9_.-]{1,80}$/.test(release) ? release : null;
}
export type ActivitySource = { environment: ActivityEnvironment; available: boolean; reason?: string };
export function configuredSources(): ActivitySource[] {
  const current = activityEnvironment();
  return ENVIRONMENTS.map((environment) => {
    if (environment === current) return { environment, available: true };
    if (current === "local" && environment === "production") return { environment, available: false, reason: "Production activity is unavailable from a local deployment." };
    const prefix = `ACTIVITY_SOURCE_${environment.toUpperCase()}`;
    let valid = false;
    try {
      const url = new URL(process.env[`${prefix}_URL`] ?? "");
      valid = url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && (process.env[`${prefix}_TOKEN`]?.length ?? 0) >= 32;
    } catch { /* Configuration errors are reported without exposing target URLs or credentials. */ }
    return valid ? { environment, available: true } : { environment, available: false, reason: "Source requires authorized server configuration." };
  });
}
