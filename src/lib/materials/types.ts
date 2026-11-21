import type { ChatSource } from "@/lib/chat/types";
import type { UploadedMaterialStatus } from "@/lib/uploads/types";

export type MaterialRow = {
  id: string;
  user_id: string;
  session_id: string | null;
  file_name: string;
  file_size?: number | null;
  course_id?: string | null;
  file_type: string;
  storage_path: string;
  created_at: string;
  status: UploadedMaterialStatus;
  error_message: string | null;
  processed_at: string | null;
  chunk_count: number;
  summary: string | null;
  source_metadata: Record<string, unknown> | null;
  deleted_at: string | null;
};

export type ExtractedMaterialSegment = {
  text: string;
  page?: number;
  slide?: number;
  chapter?: string;
  section?: string;
};

export type MaterialChunk = ExtractedMaterialSegment & {
  id: string;
  documentId: string;
  documentName: string;
  userId: string;
  sessionId: string | null;
  index: number;
  tokenEstimate: number;
};

export type RetrievedMaterialChunk = MaterialChunk & {
  score: number;
};

export type RagContext = {
  chunks: RetrievedMaterialChunk[];
  sources: ChatSource[];
};

export const MATERIAL_SELECT =
  "id,user_id,session_id,course_id,file_size,file_name,file_type,storage_path,created_at,status,error_message,processed_at,chunk_count,summary,source_metadata,deleted_at";
