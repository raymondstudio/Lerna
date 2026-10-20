import type { UploadedMaterialRecord } from "@/lib/uploads/types";
import type { MaterialRow } from "./types";

export function serializeMaterial(row: MaterialRow): UploadedMaterialRecord {
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    courseId: row.course_id ?? null,
    fileName: row.file_name,
    fileType: row.file_type,
    storagePath: row.storage_path,
    createdAt: row.created_at,
    status: row.status,
    errorMessage: row.error_message,
    processedAt: row.processed_at,
    chunkCount: row.chunk_count ?? 0,
    summary: row.summary,
    sourceMetadata: row.source_metadata ?? {},
    deletedAt: row.deleted_at,
  };
}
