import { NextResponse } from "next/server";
import { authorizeActiveUserApi } from "@/lib/auth/require-active-user-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorizeActiveUserApi();
  if (!auth.ok) return auth.response;

  try {
    const { data: tickets, error } = await auth.supabase
      .from("support_tickets")
      .select("id, subject, message, status, created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: tickets });
  } catch {
    console.error("[api:tickets:GET] fetch failed");
    return NextResponse.json({ success: false, error: "Tickets could not be loaded." }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const auth = await authorizeActiveUserApi();
  if (!auth.ok) return auth.response;

  try {
    const { subject, message } = await req.json();

    if (typeof subject !== "string" || typeof message !== "string" || !subject.trim() || !message.trim() || subject.length > 200 || message.length > 10000) {
      return NextResponse.json({ success: false, error: "Subject and message are required parameters." }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("support_tickets")
      .insert({
        user_id: auth.user.id,
        subject: subject.trim(),
        message: message.trim(),
        status: "open",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("[api:tickets:POST] save failed");
    return NextResponse.json({ success: false, error: "Ticket could not be saved." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
