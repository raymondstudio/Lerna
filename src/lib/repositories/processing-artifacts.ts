import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MaterialBoundaryError } from "@/lib/uploads/validation";

export type ArtifactKind = "extraction" | "embedding";
type Identity = { materialId: string; claimId: string; key: string; kind: ArtifactKind };
export async function readProcessingArtifact(input: Identity): Promise<unknown> {
  const { data, error } = await createSupabaseAdminClient().rpc("get_material_processing_artifact", {
    p_material_id: input.materialId, p_claim_id: input.claimId, p_key: input.key, p_kind: input.kind,
  });
  if (error) throw new MaterialBoundaryError("The saved processing result could not be verified. Retry later.", 503, "ARTIFACT_UNAVAILABLE");
  return data;
}
export async function writeProcessingArtifact(input: Identity, payload: unknown): Promise<void> {
  const { data, error } = await createSupabaseAdminClient().rpc("put_material_processing_artifact", {
    p_material_id: input.materialId, p_claim_id: input.claimId, p_key: input.key, p_kind: input.kind, p_payload: payload,
  });
  if (error || data !== true) throw new MaterialBoundaryError("The processing result was not acknowledged. Retry with this same document.", 503, "ARTIFACT_SAVE_FAILED");
}
