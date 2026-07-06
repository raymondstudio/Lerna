import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updateSupportTicket(
  ticketId: string,
  data: {
    status?: string;
    priority?: string;
    category?: string;
    assignedTo?: string | null;
    resolutionNotes?: string;
  }
) {
  const supabase = await createSupabaseServerClient();
  const updateData: any = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.assignedTo !== undefined) updateData.assigned_to = data.assignedTo;
  if (data.resolutionNotes !== undefined) {
    updateData.resolution_notes = data.resolutionNotes;
    if (data.status === "resolved" || data.status === "closed") {
      updateData.closed_at = new Date().toISOString();
    }
  }
  updateData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("support_tickets")
    .update(updateData)
    .eq("id", ticketId);

  if (error) throw error;
  return true;
}

export async function updateFeedbackRoadmap(
  feedbackId: string,
  data: {
    status?: string;
    adminNotes?: string;
  }
) {
  const supabase = await createSupabaseServerClient();
  const updateData: any = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.adminNotes !== undefined) updateData.admin_notes = data.adminNotes;

  const { error } = await supabase
    .from("feedback")
    .update(updateData)
    .eq("id", feedbackId);

  if (error) throw error;
  return true;
}
