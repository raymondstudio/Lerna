/** Course uploads use the same bounded server workflow as Study Sessions. */
export async function uploadCourseMaterial(courseId: string, file: File) {
  const created = await fetch("/api/study-sessions", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courseId, title: "Course materials", operationId: crypto.randomUUID() }),
  });
  const session = await created.json();
  if (!created.ok || !session.success || !session.data?.session?.id) throw new Error(session.error?.message ?? "Could not prepare this course upload.");
  const form = new FormData(); form.set("sessionId", session.data.session.id); form.set("file", file);
  const response = await fetch("/api/upload", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: form });
  const payload = await response.json();
  if (!response.ok || !payload.success || !payload.data?.material) throw new Error(payload.error?.message ?? payload.error ?? "The material could not be uploaded. Your course is still saved.");
  return payload.data.material as { id: string; file_name: string; file_type: string; status: string; created_at: string };
}
