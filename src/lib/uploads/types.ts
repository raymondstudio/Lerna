export type UploadedMaterialStatus = "uploaded" | "processing" | "ready" | "failed" | "deleted";

export type UploadedMaterialRecord = {
  id: string;
  userId: string;
  sessionId: string | null;
  courseId?: string | null;
  fileName: string;
  fileType: string;
  storagePath: string;
  createdAt: string;
  status: UploadedMaterialStatus;
  errorMessage: string | null;
  processedAt: string | null;
  chunkCount: number;
  summary: string | null;
  sourceMetadata: Record<string, unknown>;
  deletedAt: string | null;
};
