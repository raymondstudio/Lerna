import type { SupabaseClient } from "@supabase/supabase-js";
import { OperationError } from "./operations";
import { searchIndex } from "@/lib/elastic/client";
import { CHUNKS_INDEX } from "@/lib/materials/elastic";

export async function quizContext(db: SupabaseClient, userId: string, materialId?: string, courseId?: string) {
  if (materialId) {
    const lookup = () => db.from("uploaded_materials").select("id,file_name,course_id").eq("id", materialId).eq("user_id", userId).eq("status", "ready").is("deleted_at", null).maybeSingle();
    const before = await lookup();
    if (before.error) throw new OperationError("Material verification is unavailable.");
    if (!before.data || (courseId && before.data.course_id !== courseId)) throw new OperationError("Material not found for this course.", 404);
    const result = await searchIndex(CHUNKS_INDEX, { query: { bool: { filter: [{ term: { document_id: materialId } }, { term: { user_id: userId } }] } }, sort: [{ chunk_index: "asc" }], size: 20, _source: ["chunk_text", "document_id", "user_id"] });
    const hits = (result as { hits?: { hits?: Array<{ _source?: { chunk_text?: unknown; document_id?: string; user_id?: string } }> } }).hits?.hits ?? [];
    const text = hits.filter(hit => hit._source?.document_id === materialId && hit._source?.user_id === userId && typeof hit._source?.chunk_text === "string")
      .map(hit => String(hit._source!.chunk_text).slice(0, 12000)).join("\n\n").slice(0, 15000);
    const after = await lookup();
    if (after.error) throw new OperationError("Material verification is unavailable.");
    if (!after.data) throw new OperationError("This material is no longer available.", 409);
    if (!text.trim()) throw new OperationError("This material has no searchable text. Reprocess it before creating questions.", 422);
    return `The study material is titled: "${after.data.file_name}". Generate quiz questions STRICTLY based on the following document context:\n\n${text}`;
  }
  if (courseId) {
    const { data, error } = await db.from("courses").select("code,title,description").eq("id", courseId).eq("user_id", userId).maybeSingle();
    if (error) throw new OperationError("Course verification is unavailable.");
    if (!data) throw new OperationError("Course not found.", 404);
    return `The study context is for the course: "${data.code} — ${data.title}" (${data.description ?? "General study"}). Generate educational quiz questions covering the curriculum, main concepts and topics of this course.`;
  }
  return "";
}
