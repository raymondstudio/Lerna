import { NextResponse } from "next/server";
import { authorizeActiveUserApi } from "@/lib/auth/require-active-user-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorizeActiveUserApi();
  if (!auth.ok) return auth.response;

  try {
    const { data: feedbacks, error } = await auth.supabase
      .from("feedback")
      .select("id, type, message, rating, created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: feedbacks });
  } catch {
    console.error("[api:feedback:GET] fetch failed");
    return NextResponse.json({ success: false, error: "Feedback could not be loaded." }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const auth = await authorizeActiveUserApi();
  if (!auth.ok) return auth.response;

  try {
    const { type, message, rating } = await req.json();

    if (typeof type !== "string" || typeof message !== "string" || !message.trim() || message.length > 4000) {
      return NextResponse.json({ success: false, error: "Type and message are required." }, { status: 400 });
    }

    if (!["general", "bug", "feature"].includes(type)) {
      return NextResponse.json({ success: false, error: "Invalid feedback type." }, { status: 400 });
    }
    const parsedRating = rating === undefined || rating === null || rating === "" ? null : Number(rating);
    if (parsedRating !== null && (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5)) {
      return NextResponse.json({ success: false, error: "Rating must be from 1 to 5." }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("feedback")
      .insert({
        user_id: auth.user.id,
        type,
        message: message.trim(),
        rating: parsedRating,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch {
    console.error("[api:feedback:POST] save failed");
    return NextResponse.json({ success: false, error: "Feedback could not be saved." }, { status: 503 });
  }
}
