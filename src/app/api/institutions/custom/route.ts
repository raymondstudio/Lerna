import { NextResponse } from "next/server";
import { createCustomInstitution } from "@/lib/repositories/institutions";
import { requireActiveUserApi, AuthApiError, authApiErrorResponse } from "@/lib/auth/require-active-user-api";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { z } from "zod";
const input = z.object({ name: z.string().trim().min(1).max(240), institution_type: z.string().min(1).max(80), state: z.string().max(120).optional(), country: z.string().max(120).optional() }).strict();

export async function POST(req: Request) {
  try {
    await requireActiveUserApi();
    const parsed = input.safeParse(await readBoundedJson(req,8192));
    if (!parsed.success) return NextResponse.json({ success: false, error: "Check the institution details." }, { status: 400 });
    const { name, institution_type, state, country } = parsed.data;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }
    if (!institution_type) {
      return NextResponse.json({ success: false, error: "Institution type is required" }, { status: 400 });
    }

    const data = await createCustomInstitution({
      name,
      institution_type,
      state: state || "",
      country: country || "Nigeria"
    });

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    if (err instanceof AuthApiError) return authApiErrorResponse(err);
    console.error("[api:institutions:custom] Error:", err);
    return NextResponse.json({ success: false, error: "The institution could not be saved. Retry shortly." }, { status: 503 });
  }
}
