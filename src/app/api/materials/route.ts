import { NextResponse } from "next/server";
import { requireActiveUserApi } from "@/lib/auth/require-active-user-api";
import { serializeMaterial } from "@/lib/materials/serialize";
import { MaterialBoundaryError } from "@/lib/uploads/validation";
import { materialErrorResponse } from "@/lib/uploads/api-error";
import { listOwnedMaterials, requireOwnedMaterialSession } from "@/lib/repositories/materials";
import { POST as uploadMaterial } from "@/app/api/upload/route";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase, user } = await requireActiveUserApi();
    const sessionId = new URL(request.url).searchParams.get("sessionId");
    if (sessionId) await requireOwnedMaterialSession(supabase, sessionId, user.id);
    const materials = await listOwnedMaterials(supabase, user.id, sessionId);
    return NextResponse.json({ success: true, requestId, data: { materials: materials.map(serializeMaterial) } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return materialErrorResponse(error, requestId); }
}
export async function POST(request: Request) {
  // Legacy storage-path registration cannot bypass validation and reservation.
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("multipart/form-data;")) {
    return materialErrorResponse(new MaterialBoundaryError("Upload the original file as multipart form data through /api/upload.", 415, "FILE_UPLOAD_REQUIRED"), crypto.randomUUID());
  }
  return uploadMaterial(request);
}
