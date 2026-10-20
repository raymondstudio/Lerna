import { NextResponse } from "next/server";
import { requireActiveUserApi, AuthApiError, authApiErrorResponse } from "@/lib/auth/require-active-user-api";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { OperationError } from "@/lib/repositories/operations";
import { saveReportedAttribution } from "@/lib/repositories/attribution";
import { enforceActivityRateLimit } from "@/lib/repositories/activity";

function tag(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 100 || !/^[a-zA-Z0-9 _.-]+$/.test(value)) throw new OperationError("Invalid attribution tag.", 400);
  return value;
}

export async function POST(req: Request) {
  try {
    const { user } = await requireActiveUserApi();
    const raw = await readBoundedJson(req, 4096);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new OperationError("Invalid attribution.", 400);
    const input = raw as Record<string, unknown>;
    let referrer: string | null = null;
    if (input.referrer) {
      if (typeof input.referrer !== "string" || input.referrer.length > 2048) throw new OperationError("Invalid attribution referrer.", 400);
      try { const url = new URL(input.referrer); if (!["https:","http:"].includes(url.protocol)) throw new Error(); referrer = url.hostname.slice(0, 253); }
      catch { throw new OperationError("Invalid attribution referrer.", 400); }
    }
    if (!await enforceActivityRateLimit(user.id)) throw new OperationError("Please retry later.", 429);
    await saveReportedAttribution(user.id, { utm_source: tag(input.utm_source), utm_medium: tag(input.utm_medium), utm_campaign: tag(input.utm_campaign), referrer });
    return NextResponse.json({ success: true, source: "browser_reported" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthApiError) return authApiErrorResponse(error);
    return NextResponse.json({ success: false, error: error instanceof OperationError ? error.message : "Attribution could not be saved." }, { status: error instanceof OperationError ? error.status : 503 });
  }
}
