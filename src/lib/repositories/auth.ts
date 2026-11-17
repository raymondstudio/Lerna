import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeProfile } from "@/lib/profile";

export async function selectAuthProfile(supabase: SupabaseClient, userId: string) {
  const [profile, subscription, role] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("subscriptions").select("plan,status,billing_cycle,subscription_status").eq("user_id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
  ]);
  if (profile.error || subscription.error || role.error) throw new Error("Profile could not be loaded.");
  return normalizeProfile(profile.data, subscription.data, role.data);
}

export async function selectAccessibleTicket(supabase: SupabaseClient, ticketId: string) {
  const { data, error } = await supabase.from("support_tickets").select("id,user_id").eq("id", ticketId).maybeSingle();
  if (error) throw new Error("Ticket could not be loaded.");
  return data;
}

export async function selectTicketReplies(supabase: SupabaseClient, ticketId: string) {
  const { data, error } = await supabase.from("support_ticket_replies")
    .select("id,message,created_at,profiles!user_id(email,first_name,last_name)")
    .eq("ticket_id", ticketId).order("created_at", { ascending: true });
  if (error) throw new Error("Replies could not be loaded.");
  return data ?? [];
}

export async function insertTicketReply(supabase: SupabaseClient, ticketId: string, userId: string, message: string) {
  // Parent was authorized through the user-scoped client; RLS binds sender again.
  const { data, error } = await supabase.from("support_ticket_replies")
    .insert({ ticket_id: ticketId, user_id: userId, message }).select().single();
  if (error) throw new Error("Reply could not be saved.");
  const { error: updateError } = await supabase.from("support_tickets")
    .update({ last_reply: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", ticketId);
  if (updateError) throw new Error("Reply saved, but the ticket could not be refreshed. Reload before retrying.");
  return data;
}

export async function selectBroadcasts(supabase: SupabaseClient, admin: boolean) {
  let query = supabase.from("broadcasts")
    .select("id,title,content,sent_at,created_at,status,target_audience,target_institution,target_department,scheduled_for,expires_at")
    .order("created_at", { ascending: false }).limit(200);
  if (!admin) {
    const now = new Date().toISOString();
    query = query.eq("status", "published").or(`scheduled_for.is.null,scheduled_for.lte.${now}`).or(`expires_at.is.null,expires_at.gt.${now}`);
  }
  const { data, error } = await query;
  if (error) throw new Error("Announcements could not be loaded.");
  return data ?? [];
}
