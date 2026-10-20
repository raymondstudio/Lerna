import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AccountDashboard, AccountStats, AccountTicket } from "@/lib/account/types";
import { accountProfileUpdate } from "@/lib/account/profile-input";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
export class AccountRepositoryError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function updateAccountProfile(client: Client, userId: string, input: unknown) {
  let fields: Record<string, unknown>;
  try { fields = accountProfileUpdate(input); }
  catch (error) { throw new AccountRepositoryError(400, error instanceof Error ? error.message : "Check the profile fields."); }
  const { data, error } = await client.from("profiles").update(fields).eq("id", userId).select("id,updated_at").maybeSingle();
  if (error) throw new AccountRepositoryError(503, "Your profile could not be saved. Retry shortly.");
  if (!data) throw new AccountRepositoryError(404, "Your account profile could not be found. Refresh your account and retry.");
  return { id: data.id as string, updatedAt: data.updated_at as string };
}

export async function getAccountDashboard(client: Client, userId: string): Promise<AccountDashboard> {
  const stats: AccountStats = { streak: null, questions: null, documents: null, sessions: null, hours: null };
  const warnings: string[] = [];
  const count = async (metric: "documents" | "sessions" | "questions") => {
    const table = metric === "documents" ? "uploaded_materials" : metric === "questions" ? "study_messages" : "study_sessions";
    let query = client.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId);
    if (metric === "documents") query = query.is("deleted_at", null);
    if (metric === "questions") query = query.eq("role", "user");
    const result = await query;
    if (result.error || result.count === null) throw new Error();
    return result.count;
  };
  const durations = async () => {
    let seconds = 0;
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client.from("study_sessions").select("id,duration_seconds").eq("user_id", userId)
        .order("id", { ascending: true }).range(offset, offset + 499);
      if (error || !data) throw new Error();
      for (const row of data) {
        if (typeof row.duration_seconds !== "number" || !Number.isFinite(row.duration_seconds) || row.duration_seconds < 0) throw new Error();
        seconds += row.duration_seconds;
      }
      if (data.length < 500) return seconds / 3600;
    }
  };
  const tickets = async (): Promise<AccountTicket[]> => {
    const { data, error } = await client.from("support_tickets").select("id,subject,message,status,created_at").eq("user_id", userId)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(20);
    if (error || !data) throw new Error();
    return data;
  };
  const metrics = ["documents", "sessions", "questions"] as const;
  const results = await Promise.allSettled([...metrics.map(metric => count(metric)), durations(), tickets()]);
  metrics.forEach((metric, index) => {
    const result = results[index];
    if (result.status === "fulfilled") stats[metric] = result.value as number;
    else warnings.push(`Your ${metric} count is unavailable. Retry loading account details.`);
  });
  const hours = results[3];
  if (hours.status === "fulfilled") stats.hours = hours.value as number;
  else warnings.push("Your saved study duration is unavailable. Retry loading account details.");
  const ticketResult = results[4];
  if (ticketResult.status === "rejected") warnings.push("Your support tickets could not be loaded. Retry loading account details.");
  // Session creation/update timestamps cannot reconstruct daily study activity reliably.
  return { stats, tickets: ticketResult.status === "fulfilled" ? ticketResult.value as AccountTicket[] : null, warnings };
}
