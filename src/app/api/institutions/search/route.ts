import { NextResponse } from "next/server";
import { searchInstitutions } from "@/lib/repositories/institutions";
import { authorizeActiveUserApi } from "@/lib/auth/require-active-user-api";

export async function GET(req: Request) {
  const auth = await authorizeActiveUserApi();
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("query") || "").trim().slice(0, 120);
    const type = searchParams.get("type") || undefined;
    const requestedLimit = Number(searchParams.get("limit") || "20");
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 50) : 20;

    if (!query) {
      return NextResponse.json({ success: true, data: [] });
    }

    const data = await searchInstitutions(query, type, limit);
    return NextResponse.json({ success: true, data });
  } catch {
    console.error("[api:institutions:search] lookup failed");
    return NextResponse.json({ success: false, error: "Institution search is temporarily unavailable." }, { status: 500 });
  }
}
