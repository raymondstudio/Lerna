import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticketId = searchParams.get("ticketId");

  if (!ticketId) {
    return NextResponse.json({ success: false, error: "Ticket ID is required." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const { data: replies, error } = await supabase
      .from("support_ticket_replies")
      .select(`
        id,
        message,
        created_at,
        profiles!user_id (
          email,
          first_name,
          last_name
        )
      `)
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const formatted = replies.map((r: any) => ({
      id: r.id,
      message: r.message,
      created_at: r.created_at,
      sender_name: r.profiles ? `${r.profiles.first_name || ""} ${r.profiles.last_name || ""}`.trim() : "Unknown User",
      sender_email: r.profiles?.email || "unknown"
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (err) {
    console.error("[api:admin:tickets:replies:GET] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const { ticketId, message } = await req.json();

    if (!ticketId || !message?.trim()) {
      return NextResponse.json({ success: false, error: "Ticket ID and message are required." }, { status: 400 });
    }

    // 1. Insert reply
    const { data, error } = await supabase
      .from("support_ticket_replies")
      .insert({
        ticket_id: ticketId,
        user_id: userData.user.id,
        message: message.trim()
      })
      .select()
      .single();

    if (error) throw error;

    // 2. Update ticket last_reply timestamp
    await supabase
      .from("support_tickets")
      .update({ 
        last_reply: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", ticketId);

    // 3. Log to audit log
    await supabase.from("audit_logs").insert({
      user_id: userData.user.id,
      action: "ticket_reply_added",
      details: { ticket_id: ticketId, reply_id: data.id }
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[api:admin:tickets:replies:POST] Exception:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
