import { NextResponse } from "next/server";
import { AuthApiError, authApiErrorResponse, requireActiveUserApi } from "@/lib/auth/require-active-user-api";
import { requireAdminApi } from "@/lib/auth/require-admin-api";
import { selectAccessibleTicket, selectTicketReplies, insertTicketReply } from "@/lib/repositories/auth";

export const dynamic = "force-dynamic";
const validId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

async function ticketContext(ticketId: string) {
  const context = await requireActiveUserApi();
  const ticket = await selectAccessibleTicket(context.supabase, ticketId);
  if (!ticket) return null;
  if (ticket.user_id !== context.user.id) await requireAdminApi();
  return context;
}

export async function GET(req: Request) {
  const ticketId = new URL(req.url).searchParams.get("ticketId");
  if (!validId(ticketId)) return NextResponse.json({ success: false, error: "A valid ticket ID is required." }, { status: 400 });
  try {
    const context = await ticketContext(ticketId);
    if (!context) return NextResponse.json({ success: false, error: "Ticket not found." }, { status: 404 });
    const replies = await selectTicketReplies(context.supabase, ticketId);
    const formatted = replies.map((reply) => {
      const profile = Array.isArray(reply.profiles) ? reply.profiles[0] : reply.profiles;
      return { id: reply.id, message: reply.message, created_at: reply.created_at,
        sender_name: profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() : "Unknown User",
        sender_email: profile?.email ?? "unknown" };
    });
    return NextResponse.json({ success: true, data: formatted }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthApiError) return authApiErrorResponse(error);
    return NextResponse.json({ success: false, error: "Replies could not be loaded." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!validId(body.ticketId) || typeof body.message !== "string" || !body.message.trim() || body.message.length > 20_000) {
      return NextResponse.json({ success: false, error: "A valid ticket and a message of up to 20,000 characters are required." }, { status: 400 });
    }
    const context = await ticketContext(body.ticketId);
    if (!context) return NextResponse.json({ success: false, error: "Ticket not found." }, { status: 404 });
    const reply = await insertTicketReply(context.supabase, body.ticketId, context.user.id, body.message.trim());
    return NextResponse.json({ success: true, data: reply });
  } catch (error) {
    if (error instanceof AuthApiError) return authApiErrorResponse(error);
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
    return NextResponse.json({ success: false, error: "Reply could not be saved. Reload before retrying." }, { status: 500 });
  }
}
