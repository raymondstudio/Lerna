import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

// Compatibility endpoint: account membership is never disclosed or queried.
export async function POST() {
  return NextResponse.json({ success: true, message: "Continue with sign-up or sign in to your account." }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
