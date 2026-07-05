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
    : ["admin@eduagent.ai"];
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
        created_at,
        profiles (
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
      created_at: t.created_at,
      user_email: t.profiles?.email || "unknown",
      user_name: t.profiles ? `${t.profiles.first_name || ""} ${t.profiles.last_name || ""}`.trim() : "Unknown User"
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
    : ["admin@eduagent.ai"];
  const isFallbackAdmin = userData.user.email && adminEmails.includes(userData.user.email);
  const isRoleAdmin = userData.user.app_metadata?.role === "admin";

  if (!isAdmin && !isFallbackAdmin && !isRoleAdmin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { ticketId, status } = await req.json();

    if (!ticketId || !status) {
      return NextResponse.json({ success: false, error: "Ticket ID and status are required." }, { status: 400 });
    }

    if (!["open", "closed", "pending", "resolved"].includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid ticket status value." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("support_tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", ticketId)
      .select()
      .single();

    if (error) throw error;

    // Log update action to audit logs
    await supabase.from("audit_logs").insert({
      user_id: userData.user.id,
      action: "ticket_updated",
      details: { ticket_id: ticketId, new_status: status }
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[api:admin:tickets:PUT] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
