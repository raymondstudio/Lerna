import { NextResponse } from "next/server";
import { requireActiveUserApi } from "@/lib/auth/require-active-user-api";
import { processMaterial } from "@/lib/materials/ingestion";
import { serializeMaterial } from "@/lib/materials/serialize";
import { materialErrorResponse } from "@/lib/uploads/api-error";
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase, user } = await requireActiveUserApi();
    const { id } = await context.params;
    const material = await processMaterial({ supabase, materialId: id, userId: user.id, signal: request.signal });
    return NextResponse.json({ success: true, requestId, data: { material: serializeMaterial(material) } });
  } catch (error) { return materialErrorResponse(error, requestId); }
}
