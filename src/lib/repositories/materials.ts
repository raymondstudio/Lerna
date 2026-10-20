import type { SupabaseClient } from "@supabase/supabase-js";
import { requireActiveUserApi } from "@/lib/auth/require-active-user-api";
import { getSupabaseUrl } from "@/lib/supabase/config";
import { readBoundedBody } from "@/lib/uploads/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MATERIAL_SELECT, type MaterialRow } from "@/lib/materials/types";
import { MaterialBoundaryError, assertOwnedStoragePath, isResourceId } from "@/lib/uploads/validation";
import { UPLOAD_LIMITS } from "@/lib/uploads/limits";
import { UPLOADED_MATERIALS_BUCKET } from "@/lib/uploads/constants";

export async function requireOwnedMaterialSession(supabase: SupabaseClient, sessionId: string, userId: string) {
  if (!isResourceId(sessionId)) throw new MaterialBoundaryError("Session not found.", 404, "NOT_FOUND");
  const { data, error } = await supabase.from("study_sessions").select("id,course_id").eq("id", sessionId).eq("user_id", userId).maybeSingle();
  if (error) throw new MaterialBoundaryError("Session verification is unavailable.", 503, "DEPENDENCY_UNAVAILABLE");
  if (!data) throw new MaterialBoundaryError("Session not found.", 404, "NOT_FOUND");
  if (data.course_id) {
    const result = await supabase.from("courses").select("id").eq("id", data.course_id).eq("user_id", userId).maybeSingle();
    if (result.error) throw new MaterialBoundaryError("Course verification is unavailable.", 503, "DEPENDENCY_UNAVAILABLE");
    if (!result.data) throw new MaterialBoundaryError("Course not found.", 404, "NOT_FOUND");
  }
  return data as { id: string; course_id: string | null };
}
export async function fetchOwnedMaterial(supabase: SupabaseClient, materialId: string, userId: string): Promise<MaterialRow | null> {
  if (!isResourceId(materialId)) return null;
  const { data, error } = await supabase.from("uploaded_materials").select(MATERIAL_SELECT)
    .eq("id", materialId).eq("user_id", userId).is("deleted_at", null).maybeSingle();
  if (error) throw new MaterialBoundaryError("Material verification is unavailable.", 503, "DEPENDENCY_UNAVAILABLE");
  return data as MaterialRow | null;
}
export async function listOwnedMaterials(supabase: SupabaseClient, userId: string, sessionId?: string | null) {
  let query = supabase.from("uploaded_materials").select(MATERIAL_SELECT).eq("user_id", userId).is("deleted_at", null).order("created_at", { ascending: false });
  if (sessionId) query = query.eq("session_id", sessionId);
  const { data, error } = await query;
  if (error) throw new MaterialBoundaryError("Materials could not be loaded.", 503);
  return (data ?? []) as MaterialRow[];
}
export async function findByStoragePath(supabase: SupabaseClient, userId: string, storagePath: string) {
  const { data, error } = await supabase.from("uploaded_materials").select(MATERIAL_SELECT).eq("user_id", userId).eq("storage_path", storagePath).maybeSingle();
  if (error) throw new MaterialBoundaryError("Upload verification is unavailable.", 503);
  if (data?.deleted_at) throw new MaterialBoundaryError("This upload was deleted. Upload the original again.", 409);
  return data as MaterialRow | null;
}
export async function insertMaterial(userId: string, sessionId: string, fileName: string, fileType: string, storagePath: string, fileSize?: number) {
  // Service-role writes must revalidate the authenticated owner at the privilege boundary.
  const identity = await requireActiveUserApi();
  if (identity.user.id !== userId) throw new MaterialBoundaryError("Upload owner could not be verified.", 403);
  const supabase = identity.supabase;
  const session = await requireOwnedMaterialSession(supabase, sessionId, userId);
  assertOwnedStoragePath(storagePath, userId, sessionId);
  const existing = await findByStoragePath(supabase, userId, storagePath);
  if (existing) throw new MaterialBoundaryError("This upload already exists. Reload before retrying.", 409, "DUPLICATE_UPLOAD");
  const { data, error } = await createSupabaseAdminClient().from("uploaded_materials").insert({
    user_id: userId, session_id: sessionId, course_id: session.course_id, file_name: fileName, file_type: fileType,
    storage_path: storagePath, file_size: fileSize ?? null, status: "uploaded", ocr_status: "pending", embedding_status: "pending",
    last_accessed_at: new Date().toISOString(),
  }).select(MATERIAL_SELECT).single();
  if (error?.code === "23505") {
    const duplicate = await findByStoragePath(supabase, userId, storagePath);
    if (duplicate) throw new MaterialBoundaryError("This upload already exists. Reload before retrying.", 409, "DUPLICATE_UPLOAD");
  }
  if (error || !data) throw new MaterialBoundaryError("Upload metadata could not be saved.", 503, "SAVE_FAILED");
  return data as MaterialRow;
}
export async function downloadOwnedUpload(supabase: SupabaseClient, storagePath: string) {
  const { data, error } = await supabase.storage.from(UPLOADED_MATERIALS_BUCKET).createSignedUrl(storagePath, 30);
  if (error || !data?.signedUrl) throw new MaterialBoundaryError("The uploaded file could not be downloaded.", 503, "DOWNLOAD_FAILED");
  if (new URL(data.signedUrl).origin !== new URL(getSupabaseUrl()).origin) throw new MaterialBoundaryError("Storage origin could not be verified.", 503);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(data.signedUrl, { signal: controller.signal, cache: "no-store", redirect: "error" });
    if (!response.ok) throw new MaterialBoundaryError("The uploaded file could not be downloaded.", 503, "DOWNLOAD_FAILED");
    return await readBoundedBody({ headers: response.headers, body: response.body, signal: controller.signal }, UPLOAD_LIMITS.fileBytes);
  } finally { clearTimeout(timeout); }

}
export async function storeUpload(supabase: SupabaseClient, material: MaterialRow, userId: string, buffer: Buffer, mimeType: string) {
  if (material.user_id !== userId || !material.session_id) throw new MaterialBoundaryError("Upload owner could not be verified.", 403);
  await requireOwnedMaterialSession(supabase, material.session_id, userId);
  const path = assertOwnedStoragePath(material.storage_path, userId, material.session_id);
  const { error } = await createSupabaseAdminClient().storage.from(UPLOADED_MATERIALS_BUCKET).upload(path, buffer, { contentType: mimeType, upsert: false });
  if (error) throw new MaterialBoundaryError("The file could not be uploaded.", 503, "UPLOAD_FAILED");
}
export async function removeStoredUpload(material: { id: string; storage_path: string }, userId: string) {
  // The caller must obtain this row from the owner-authorizing tombstone RPC.
  const sessionId = material.storage_path.split("/")[1];
  const path = assertOwnedStoragePath(material.storage_path, userId, sessionId);
  const { error } = await createSupabaseAdminClient().storage.from(UPLOADED_MATERIALS_BUCKET).remove([path]);
  if (error) throw new MaterialBoundaryError("File cleanup is pending.", 503, "CLEANUP_PENDING");
}
export async function signOwnedUpload(supabase: SupabaseClient, path: string) {
  const { data, error } = await supabase.storage.from(UPLOADED_MATERIALS_BUCKET).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) throw new MaterialBoundaryError("The material could not be opened.", 503);
  return data.signedUrl;
}
export async function claimMaterialProcessing(supabase: SupabaseClient, materialId: string, claimId: string) {
  const { data, error } = await supabase.rpc("claim_material_processing", { p_material_id: materialId, p_claim_id: claimId });
  if (error) throw new MaterialBoundaryError("Processing could not be reserved. Retry shortly.", 503, "CLAIM_FAILED");
  if (!["claimed", "ready", "busy"].includes(data)) throw new MaterialBoundaryError("Material not found.", 404, "NOT_FOUND");
  return data as "claimed" | "ready" | "busy";
}
export async function finishMaterialProcessing(_supabase: SupabaseClient, materialId: string, claimId: string, status: "ready" | "failed", values: Record<string, unknown>) {
  const { data, error } = await createSupabaseAdminClient().rpc("finish_material_processing", { p_material_id: materialId, p_claim_id: claimId, p_status: status, p_values: values });
  if (error || data !== true) throw new MaterialBoundaryError("Processing could not be saved. Reload before retrying.", 409, "PROCESSING_CONFLICT");
}
export async function tombstoneMaterialAndQueueCleanup(supabase: SupabaseClient, materialId: string) {
  const { data, error } = await supabase.rpc("delete_material_and_enqueue_cleanup", { p_material_id: materialId });
  if (error) throw new MaterialBoundaryError("Deletion could not be saved.", 503, "DELETE_FAILED");
  if (!data) throw new MaterialBoundaryError("Material not found.", 404, "NOT_FOUND");
  if (!Number.isSafeInteger(data.cleanup_revision) || data.cleanup_revision < 1) throw new MaterialBoundaryError("Cleanup could not be reserved.", 503, "CLEANUP_PENDING");
  return data as { id: string; storage_path: string; cleanup_revision: number };
}
export async function completeMaterialCleanup(materialId: string, expectedRevision: number) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new MaterialBoundaryError("Cleanup confirmation is pending.", 503, "CLEANUP_PENDING");
  const { data, error } = await createSupabaseAdminClient().rpc("complete_material_cleanup", { p_material_id: materialId, p_expected_revision: expectedRevision });
  if (error || data !== true) throw new MaterialBoundaryError("Cleanup confirmation is pending.", 503, "CLEANUP_PENDING");
}
export async function queueMaterialIndexCleanup(supabase: SupabaseClient, materialId: string) {
  const { error } = await supabase.rpc("queue_material_index_cleanup", { p_material_id: materialId });
  if (error) throw new MaterialBoundaryError("Processing cleanup could not be queued.", 503, "CLEANUP_QUEUE_FAILED");
}
export async function selectReadyOwnedMaterialIds(userId: string, documentIds?: string[]) {
  if (documentIds !== undefined && documentIds.length === 0) return [];
  if (documentIds && (documentIds.length > 1000 || documentIds.some((id) => !isResourceId(id)))) return [];
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("uploaded_materials").select("id").eq("user_id", userId).eq("status", "ready").is("deleted_at", null);
  if (documentIds) query = query.in("id", [...new Set(documentIds)]);
  const { data, error } = await query.limit(1000);
  if (error) throw new MaterialBoundaryError("Material authorization is unavailable.", 503);
  return (data ?? []).map((row) => String(row.id));
}
export async function deleteMaterial(materialId: string) {
  const supabase = await createSupabaseServerClient();
  return tombstoneMaterialAndQueueCleanup(supabase, materialId);
}
