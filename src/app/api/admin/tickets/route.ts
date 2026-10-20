import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { OperationError } from "@/lib/repositories/operations";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

  try {
    const { data: tickets, error } = await supabase
      .from("support_tickets")
      .select(`
        id,
        subject,
        message,
        status,
        category,
        priority,
        assigned_to,
        resolution_notes,
        created_at,
        profiles!user_id (
          email,
          first_name,
          last_name
        ),
        assignee:profiles!assigned_to (
          email,
          first_name,
          last_name
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Format profiles join safely
    const formatted = tickets.map((t) => {
      const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
      const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee;
      return {
      id: t.id,
      subject: t.subject,
      message: t.message,
      status: t.status,
      category: t.category || "General",
      priority: t.priority || "Medium",
      assigned_to: t.assigned_to,
      resolution_notes: t.resolution_notes || "",
      created_at: t.created_at,
      user_email: profile?.email || "unknown",
      user_name: profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Unknown User",
      assignee_email: assignee?.email || "Unassigned",
      assignee_name: assignee ? `${assignee.first_name || ""} ${assignee.last_name || ""}`.trim() : "Unassigned"
      };
    });

    return NextResponse.json({ success: true, data: formatted });
  } catch {
    console.error("[api:admin:tickets:GET] failed");
    return NextResponse.json({ success: false, error: "Tickets could not be loaded." }, { status: 503 });
  }
}

export async function PUT(req: Request) {
  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;
  const { supabase } = authorization;

  try {
    const input = await readBoundedJson(req, 16_384);
    if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ success: false, error: "Invalid ticket update." }, { status: 400 });
    const { ticketId, status, priority, category, assigned_to, resolution_notes } = input as Record<string, unknown>;

    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (typeof ticketId !== "string" || !uuid.test(ticketId)
      || (status !== undefined && (typeof status !== "string" || !["open", "pending", "resolved", "closed"].includes(status)))
      || (priority !== undefined && (typeof priority !== "string" || !["low", "medium", "high", "urgent"].includes(priority)))
      || (category !== undefined && (typeof category !== "string" || !["Technical", "Billing", "Account", "Other"].includes(category)))
      || (assigned_to !== undefined && assigned_to !== null && (typeof assigned_to !== "string" || !uuid.test(assigned_to)))
      || (resolution_notes !== undefined && (typeof resolution_notes !== "string" || resolution_notes.length > 10_000))) {
      return NextResponse.json({ success: false, error: "Invalid ticket update." }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {};
    if (status !== undefined) updatePayload.status = status;
    if (priority !== undefined) updatePayload.priority = priority;
    if (category !== undefined) updatePayload.category = category;
    if (assigned_to !== undefined) updatePayload.assigned_to = assigned_to;
    if (resolution_notes !== undefined) {
      updatePayload.resolution_notes = resolution_notes;
    }
    if (status === "resolved" || status === "closed") updatePayload.closed_at = new Date().toISOString();
    if (Object.keys(updatePayload).length === 0) return NextResponse.json({ success: false, error: "Choose a ticket field to update." }, { status: 400 });
    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("support_tickets")
      .update(updatePayload)
      .eq("id", ticketId)
      .select()
      .single();

    if (error) throw error;

    // The database trigger writes the content-free v1 staff event in the same
    // transaction. Legacy audit rows must not copy resolution note content.

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof OperationError && error.status >= 400 && error.status < 500) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("[api:admin:tickets:PUT] failed");
    return NextResponse.json({ success: false, error: "Ticket could not be updated." }, { status: 503 });
  }
}
