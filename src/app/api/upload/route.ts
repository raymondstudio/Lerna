import { NextResponse } from "next/server";
import { requireActiveUserApi } from "@/lib/auth/require-active-user-api";
import { processMaterial } from "@/lib/materials/ingestion";
import { buildUploadPath } from "@/lib/uploads/constants";
import { MaterialBoundaryError, isResourceId, readBoundedBody, validateUploadBuffer, validateUploadMetadata } from "@/lib/uploads/validation";
import { materialErrorResponse } from "@/lib/uploads/api-error";
import { uploadOperationId } from "@/lib/uploads/operation-id";
import { reserveOperation } from "@/lib/repositories/operations";
import { insertMaterial, requireOwnedMaterialSession, storeUpload, tombstoneMaterialAndQueueCleanup } from "@/lib/repositories/materials";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase, user } = await requireActiveUserApi();
    const retryId = request.headers.get("Idempotency-Key");
    if (retryId && !isResourceId(retryId)) throw new MaterialBoundaryError("The upload attempt identifier is invalid.");
    const body = await readBoundedBody(request);
    const form = await new Request(request.url, { method: "POST", headers: request.headers, body: new Uint8Array(body) }).formData();
    const file = form.get("file"), sessionId = form.get("sessionId");
    if (!(file instanceof File) || typeof sessionId !== "string") throw new MaterialBoundaryError("A file and study session are required.");
    await requireOwnedMaterialSession(supabase, sessionId, user.id);
    const metadata = validateUploadMetadata(file.name, file.type, file.size);
    const buffer = Buffer.from(await file.arrayBuffer());
    validateUploadBuffer(buffer, metadata.mimeType);
    const path = buildUploadPath(user.id, sessionId, metadata.fileName);
    const reservation = await reserveOperation({ userId: user.id, resource: "uploads", bytes: buffer.length, operationId: retryId ?? uploadOperationId(user.id, path), requestType: "material_upload" });
    let material;
    try {
      // A durable row exists before storage writes, so failure cleanup always has an owned identity.
      material = await insertMaterial(user.id, sessionId, metadata.fileName, metadata.mimeType, path, buffer.length);
      await storeUpload(supabase, material, user.id, buffer, metadata.mimeType);
    } catch (error) {
      if (material) await tombstoneMaterialAndQueueCleanup(supabase, material.id);
      await reservation.release();
      throw error;
    }
    await reservation.finalize("succeeded");
    const processed = await processMaterial({ supabase, materialId: material.id, userId: user.id, signal: request.signal });
    return NextResponse.json({ success: true, message: "Successfully processed document.", requestId, data: { materialId: processed.id, material: processed } });
  } catch (error) { return materialErrorResponse(error, requestId); }
}
