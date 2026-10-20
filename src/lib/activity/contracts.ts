import { z } from "zod";

export const ENVIRONMENTS = ["local", "preview", "staging", "production"] as const;
export type ActivityEnvironment = (typeof ENVIRONMENTS)[number];
export const CATEGORIES = ["auth", "navigation", "study", "material", "ai", "security", "admin"] as const;
export const OUTCOMES = ["attempted", "pending", "unknown", "simulated", "succeeded", "failed", "denied", "reported"] as const;
export const SEVERITIES = ["info", "warning", "error"] as const;
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const code = z.string().regex(/^[a-zA-Z0-9_.:-]{1,80}$/);
const metadata = {
  "page.viewed": z.object({}).strict(),
  "study_session.opened": z.object({}).strict(),
  "study_session.created": z.object({}).strict(),
  "note.saved": z.object({ revision: count.optional() }).strict(),
  "note.save_failed": z.object({ error_code: code }).strict(),
  "material.upload.started": z.object({ bytes: count.optional() }).strict(),
  "material.upload.completed": z.object({ bytes: count.optional() }).strict(),
  "material.upload.failed": z.object({ error_code: code }).strict(),
  "material.extraction.failed": z.object({ error_code: code }).strict(),
  "material.index.failed": z.object({ error_code: code }).strict(),
  "ai.request.started": z.object({ model: code, request_type: code, provider_mode: z.enum(["live", "mock"]) }).strict(),
  "ai.request.completed": z.object({ model: code, request_type: code, provider_mode: z.enum(["live", "mock"]), prompt_tokens: count.optional(), completion_tokens: count.optional(), duration_ms: count.optional(), token_source: z.enum(["provider", "estimated", "unavailable"]).optional() }).strict(),
  "ai.request.failed": z.object({ model: code.optional(), request_type: code, provider_mode: z.enum(["live", "mock"]), error_code: code }).strict(),
  "auth.login.succeeded": z.object({ provider: code }).strict(),
  "auth.login.failed": z.object({ provider: code, error_code: code }).strict(),
  "auth.logout": z.object({}).strict(),
  "auth.recovery.requested": z.object({}).strict(),
  "auth.recovery.completed": z.object({}).strict(),
  "access.denied": z.object({ error_code: code }).strict(),
  "admin.activity.read": z.object({ filter_hash: code }).strict(),
  "admin.activity.export": z.object({ filter_hash: code, format: z.enum(["csv", "json"]), rows: count, truncated: z.boolean() }).strict(),
  "admin.role.changed": z.object({ new_role: code }).strict(),
  "admin.settings.changed": z.object({ setting: code }).strict(),
} as const;
export type ActivityEventType = keyof typeof metadata;
export const EVENT_TYPES = Object.keys(metadata) as ActivityEventType[];
export class ActivityError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}
export function validateMetadata(type: ActivityEventType, value: unknown): Record<string, unknown> {
  if (!Object.hasOwn(metadata, type)) throw new ActivityError("Unsupported activity type.");
  const result = metadata[type].safeParse(value ?? {});
  if (!result.success || new TextEncoder().encode(JSON.stringify(result.data)).length > 2048) {
    throw new ActivityError("Invalid activity metadata.");
  }
  return result.data;
}
export function normalizeRoute(value: string): string {
  const path = value.split(/[?#]/, 1)[0];
  if (path.length > 180 || !/^\/[a-zA-Z0-9_/[\]-]*$/.test(path) || path.includes("//")) throw new ActivityError("Invalid route.");
  // Only approved product route templates are retained. Dynamic identifiers never enter route metadata.
  const routes = ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/callback", "/onboarding", "/dashboard", "/chat", "/study", "/study-sessions", "/notes", "/materials", "/courses", "/schedule", "/settings", "/profile", "/admin", "/privacy", "/terms"];
  const root = routes.find((route) => route !== "/" && (path === route || path.startsWith(`${route}/`)));
  return root ? (path === root ? root : `${root}/[id]`) : path === "/" ? "/" : "/other";
}
export const browserActivitySchema = z.object({
  event_id: z.string().uuid(),
  event_type: z.enum(["page.viewed", "study_session.opened"]),
  route: z.string().max(512),
  activity_id: z.string().uuid(),
}).strict();
export const browserBatchSchema = z.object({ events: z.array(browserActivitySchema).min(1).max(20) }).strict();
export type BrowserActivity = z.infer<typeof browserActivitySchema>;
export type ActivityRow = {
  id: string; user_id: string | null; event_type: ActivityEventType; properties: Record<string, unknown>;
  created_at: string; received_at: string; occurred_at: string; schema_version: number;
  environment: ActivityEnvironment; release_id: string | null; category: typeof CATEGORIES[number];
  outcome: typeof OUTCOMES[number]; severity: typeof SEVERITIES[number]; source: string;
  actor_type: string; actor_role: string | null; request_id: string | null; activity_id: string | null;
  route: string | null; resource_type: string | null; resource_id: string | null;
};
export type ActivityPage = { events: ActivityRow[]; nextCursor: string | null; asOf: string; lastUpdated: string; environment: ActivityEnvironment; startAt: string; endAt: string };
export type ActivitySummary = { total: number; successfulNoteWrites: number; successfulAiRequests: number; failed: number; reportedViews: number };
