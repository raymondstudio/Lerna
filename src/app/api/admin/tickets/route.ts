import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
  }

  const { data: isAdmin } = await supabase.rpc("is_admin", { user_id: userData.user.id });
  
  const adminEmails = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim())
    : ["msuraymond@gmail.com"];
  const isFallbackAdmin = userData.user.email && adminEmails.includes(userData.user.email);
  const isRoleAdmin = userData.user.app_metadata?.role === "admin";

  if (!isAdmin && !isFallbackAdmin && !isRoleAdmin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

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
    const formatted = tickets.map((t: any) => ({
      id: t.id,
      subject: t.subject,
      message: t.message,
      status: t.status,
      category: t.category || "General",
      priority: t.priority || "Medium",
      assigned_to: t.assigned_to,
      resolution_notes: t.resolution_notes || "",
      created_at: t.created_at,
      user_email: t.profiles?.email || "unknown",
      user_name: t.profiles ? `${t.profiles.first_name || ""} ${t.profiles.last_name || ""}`.trim() : "Unknown User",
      assignee_email: t.assignee?.email || "Unassigned",
      assignee_name: t.assignee ? `${t.assignee.first_name || ""} ${t.assignee.last_name || ""}`.trim() : "Unassigned"
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (err) {
    console.error("[api:admin:tickets:GET] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
  }

  const { data: isAdmin } = await supabase.rpc("is_admin", { user_id: userData.user.id });
  
  const adminEmails = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim())
    : ["msuraymond@gmail.com"];
  const isFallbackAdmin = userData.user.email && adminEmails.includes(userData.user.email);
  const isRoleAdmin = userData.user.app_metadata?.role === "admin";

  if (!isAdmin && !isFallbackAdmin && !isRoleAdmin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { ticketId, status, priority, category, assigned_to, resolution_notes } = await req.json();

    if (!ticketId) {
      return NextResponse.json({ success: false, error: "Ticket ID is required." }, { status: 400 });
    }

    const updatePayload: any = {};
    if (status !== undefined) updatePayload.status = status;
    if (priority !== undefined) updatePayload.priority = priority;
    if (category !== undefined) updatePayload.category = category;
    if (assigned_to !== undefined) updatePayload.assigned_to = assigned_to;
    if (resolution_notes !== undefined) {
      updatePayload.resolution_notes = resolution_notes;
      if (status === "resolved" || status === "closed") {
        updatePayload.closed_at = new Date().toISOString();
      }
    }
    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("support_tickets")
      .update(updatePayload)
      .eq("id", ticketId)
      .select()
      .single();

    if (error) throw error;

    // Log update action to audit logs
    await supabase.from("audit_logs").insert({
      user_id: userData.user.id,
      action: "ticket_updated",
      details: { ticket_id: ticketId, updates: updatePayload }
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[api:admin:tickets:PUT] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
