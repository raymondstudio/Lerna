import { NextResponse } from "next/server";
import { requireActiveUserApi } from "@/lib/auth/require-active-user-api";
import { fetchOwnedMaterial, requireOwnedMaterialSession, signOwnedUpload } from "@/lib/repositories/materials";
import { MaterialBoundaryError, assertOwnedStoragePath } from "@/lib/uploads/validation";
import { materialErrorResponse } from "@/lib/uploads/api-error";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase, user } = await requireActiveUserApi();
    const { id } = await context.params;
    const material = await fetchOwnedMaterial(supabase, id, user.id);
    if (!material || !material.session_id) throw new MaterialBoundaryError("Material not found.", 404, "NOT_FOUND");
    await requireOwnedMaterialSession(supabase, material.session_id, user.id);
    assertOwnedStoragePath(material.storage_path, user.id, material.session_id);
    const signedUrl = await signOwnedUpload(supabase, material.storage_path);
    return NextResponse.json({ success: true, requestId, data: { signedUrl } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return materialErrorResponse(error, requestId); }
}
