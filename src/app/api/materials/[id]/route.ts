import { NextResponse } from "next/server";
import { requireActiveUserApi } from "@/lib/auth/require-active-user-api";
import { deleteMaterialFromElastic } from "@/lib/materials/elastic";
import { completeMaterialCleanup, removeStoredUpload, tombstoneMaterialAndQueueCleanup } from "@/lib/repositories/materials";
import { MaterialBoundaryError, isResourceId } from "@/lib/uploads/validation";
import { materialErrorResponse } from "@/lib/uploads/api-error";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase, user } = await requireActiveUserApi();
    const { id } = await context.params;
    if (!isResourceId(id)) throw new MaterialBoundaryError("Material not found.", 404, "NOT_FOUND");
    // Tombstone and durable cleanup job commit atomically before dependency work.
    const material = await tombstoneMaterialAndQueueCleanup(supabase, id);
    try {
      await Promise.all([deleteMaterialFromElastic(id, user.id), removeStoredUpload(material, user.id)]);
      await completeMaterialCleanup(material.id, material.cleanup_revision);
    } catch {
      return NextResponse.json({ success: true, requestId, data: { cleanupPending: true },
        message: "Material removed from your library. File cleanup will be retried." }, { status: 202 });
    }
    return NextResponse.json({ success: true, requestId, data: { cleanupPending: false } });
  } catch (error) { return materialErrorResponse(error, requestId); }
}
