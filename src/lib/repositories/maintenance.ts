import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deleteMaterialFromElastic } from "@/lib/materials/elastic";
import { assertOwnedStoragePath, isResourceId } from "@/lib/uploads/validation";
import { UPLOADED_MATERIALS_BUCKET } from "@/lib/uploads/constants";

type CleanupJob = { material_id: string; user_id: string; storage_path: string; remove_storage: boolean; revision: number };
export async function runMaterialCleanup() {
  const db = createSupabaseAdminClient();
  const leased = await db.rpc("lease_material_cleanup_jobs", { p_limit: 10 });
  if (leased.error || !Array.isArray(leased.data)) throw new Error("Cleanup leasing unavailable.");
  let completed = 0; let failed = 0; let superseded = 0;
  for (const job of leased.data as CleanupJob[]) {
    try {
      const sessionId = job.storage_path.split("/")[1];
      if (!isResourceId(job.material_id) || !isResourceId(job.user_id) || !isResourceId(sessionId) || !Number.isSafeInteger(job.revision) || job.revision < 1) throw new Error("Invalid cleanup obligation.");
      assertOwnedStoragePath(job.storage_path, job.user_id, sessionId);
      await deleteMaterialFromElastic(job.material_id, job.user_id);
      if (job.remove_storage) {
        const result = await db.storage.from(UPLOADED_MATERIALS_BUCKET).remove([job.storage_path]);
        if (result.error) throw new Error("Storage cleanup unavailable.");
      }
      const result = await db.rpc("complete_material_cleanup", { p_material_id: job.material_id, p_expected_revision: job.revision });
      if (result.error) throw new Error("Cleanup acknowledgement unavailable.");
      if (result.data === true) completed++; else superseded++;
    } catch {
      failed++;
      const result = await db.rpc("fail_material_cleanup", { p_material_id: job.material_id, p_expected_revision: job.revision });
      if (result.error) throw new Error("Cleanup failure could not be recorded; lease will expire.");
    }
  }
  return { leased: leased.data.length, completed, failed, superseded };
}
export async function runReceiptCleanup() {
  const { data, error } = await createSupabaseAdminClient().rpc("cleanup_recovery_receipts", { p_batch_size: 1000 });
  if (error || typeof data !== "number") throw new Error("Recovery receipt cleanup unavailable.");
  return data;
}
export async function reconcileStaleOperations() {
  const { data, error } = await createSupabaseAdminClient().rpc("reconcile_stale_operations", { p_batch_size: 100 });
  if (error || typeof data !== "number") throw new Error("Operation reconciliation unavailable.");
  return data;
}
