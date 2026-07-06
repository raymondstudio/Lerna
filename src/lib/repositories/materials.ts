import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function insertMaterial(userId: string, sessionId: string, fileName: string, fileType: string, storagePath: string, fileSize?: number) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("uploaded_materials")
    .insert({
      user_id: userId,
      session_id: sessionId,
      file_name: fileName,
      file_type: fileType,
      storage_path: storagePath,
      file_size: fileSize || null,
      ocr_status: "processing",
      embedding_status: "processing",
      last_accessed_at: new Date().toISOString(),
    })
    .select("id,user_id,session_id,file_name,file_type,storage_path,created_at,status,error_message,processed_at,chunk_count,summary,source_metadata,deleted_at")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMaterial(materialId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("uploaded_materials")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", materialId);
  if (error) throw error;
  return true;
}
