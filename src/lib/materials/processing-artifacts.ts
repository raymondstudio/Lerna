import { createHash } from "node:crypto";
import { readProcessingArtifact, writeProcessingArtifact, type ArtifactKind } from "@/lib/repositories/processing-artifacts";
import { MaterialBoundaryError } from "@/lib/uploads/validation";

export function processingIdentity(input: { materialId: string; userId: string; scope: string; kind: ArtifactKind; content: string | Buffer }) {
  const hash = createHash("sha256").update("lerna-processing-v1\0").update(input.userId).update("\0").update(input.materialId)
    .update("\0").update(input.scope).update("\0").update(input.kind).update("\0").update(input.content).digest("hex");
  // Deterministic UUID identity survives a lost artifact/reservation acknowledgement.
  const operationId = `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`;
  return { key: hash, operationId };
}

export async function processingArtifact<T>(input: { materialId: string; claimId: string; key: string; kind: ArtifactKind }, validate: (value: unknown) => value is T, produce: () => Promise<T>): Promise<T> {
  const cached = await readProcessingArtifact(input);
  if (cached !== null && cached !== undefined) {
    if (!validate(cached)) throw new MaterialBoundaryError("The saved processing result is invalid. Contact support before retrying.", 503, "ARTIFACT_INVALID");
    return cached;
  }
  const value = await produce();
  if (!validate(value)) throw new MaterialBoundaryError("The processing result is invalid.", 503, "ARTIFACT_INVALID");
  await writeProcessingArtifact(input, value);
  return value;
}
