import { NextResponse } from "next/server";
import { checkEmailExists } from "@/lib/repositories/users";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const exists = await checkEmailExists(email);
    return NextResponse.json({ exists });
  } catch (err) {
    console.error("[api:check-email] unexpected error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
