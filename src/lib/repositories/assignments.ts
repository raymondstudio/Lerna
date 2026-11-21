import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AssignmentApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function assertAssignmentId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !UUID.test(id)) {
    throw new AssignmentApiError(400, "INVALID_ID", "A valid assignment identifier is required.");
  }
}

export interface AssignmentCourse {
  id: string;
  code: string;
  title: string;
}

export interface ExtractedQuestion {
  id: number;
  question: string;
  context?: string;
}

export interface AssignmentRecord {
  id: string;
  userId: string;
  courseId: string | null;
  title: string;
  description: string | null;
  mode: "answer" | "explain";
  status: "pending" | "processing" | "completed" | "failed";
  extractedQuestions: ExtractedQuestion[];
  shareToken: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  courses?: { code: string; title: string } | null;
}

export interface AssignmentMessageRecord {
  id: string;
  assignmentId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AssignmentAttachmentRecord {
  id: string;
  assignmentId: string;
  userId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  extractedText: string | null;
  createdAt: string;
}

export interface AssignmentCollectionRecord {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  shareToken: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

type AssignmentRow = {
  id: string;
  user_id: string;
  course_id: string | null;
  title: string;
  description: string | null;
  mode: "answer" | "explain";
  status: "pending" | "processing" | "completed" | "failed";
  extracted_questions: unknown;
  share_token: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  courses?: { code: string; title: string } | null;
};

export function mapAssignmentRow(row: AssignmentRow): AssignmentRecord {
  let questions: ExtractedQuestion[] = [];
  if (Array.isArray(row.extracted_questions)) {
    questions = row.extracted_questions as ExtractedQuestion[];
  }
  return {
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    title: row.title,
    description: row.description,
    mode: row.mode,
    status: row.status,
    extractedQuestions: questions,
    shareToken: row.share_token,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    courses: row.courses ?? null,
  };
}

export async function listAssignments(
  client: Client,
  userId: string,
  options?: { courseId?: string; search?: string; limit?: number }
): Promise<{ assignments: AssignmentRecord[]; stats: { total: number; coursesCount: number } }> {
  let query = client
    .from("assignments")
    .select("id,user_id,course_id,title,description,mode,status,extracted_questions,share_token,is_public,created_at,updated_at,courses(code,title)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (options?.courseId) {
    assertAssignmentId(options.courseId);
    query = query.eq("course_id", options.courseId);
  }

  if (options?.search?.trim()) {
    const term = `%${options.search.trim()}%`;
    query = query.or(`title.ilike.${term},description.ilike.${term}`);
  }

  if (options?.limit && options.limit > 0) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[assignments:repository] listAssignments query error:", error);
    throw new AssignmentApiError(500, "FETCH_FAILED", `Failed to retrieve assignments: ${error.message}`);
  }

  const assignments = (data as AssignmentRow[]).map(mapAssignmentRow);
  const coursesSet = new Set(assignments.map((a) => a.courseId).filter(Boolean));

  return {
    assignments,
    stats: {
      total: assignments.length,
      coursesCount: coursesSet.size,
    },
  };
}

export async function getAssignmentById(
  client: Client,
  assignmentId: string,
  userId?: string
): Promise<AssignmentRecord | null> {
  assertAssignmentId(assignmentId);
  let query = client
    .from("assignments")
    .select("id,user_id,course_id,title,description,mode,status,extracted_questions,share_token,is_public,created_at,updated_at,courses(code,title)")
    .eq("id", assignmentId);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new AssignmentApiError(500, "FETCH_FAILED", "Failed to retrieve the assignment.");
  }
  if (!data) return null;
  return mapAssignmentRow(data as AssignmentRow);
}

export async function createAssignment(
  client: Client,
  input: {
    userId: string;
    courseId?: string | null;
    title: string;
    description?: string | null;
    mode: "answer" | "explain";
    status?: "pending" | "processing" | "completed" | "failed";
    extractedQuestions?: ExtractedQuestion[];
  }
): Promise<AssignmentRecord> {
  if (input.courseId) assertAssignmentId(input.courseId);
  const { data, error } = await client
    .from("assignments")
    .insert({
      user_id: input.userId,
      course_id: input.courseId ?? null,
      title: input.title.trim() || "Untitled Assignment",
      description: input.description?.trim() || null,
      mode: input.mode,
      status: input.status ?? "pending",
      extracted_questions: input.extractedQuestions ?? [],
    })
    .select("id,user_id,course_id,title,description,mode,status,extracted_questions,share_token,is_public,created_at,updated_at,courses(code,title)")
    .single();

  if (error) {
    throw new AssignmentApiError(500, "CREATE_FAILED", "Failed to create assignment.");
  }
  return mapAssignmentRow(data as AssignmentRow);
}

export async function updateAssignment(
  client: Client,
  assignmentId: string,
  userId: string,
  updates: {
    title?: string;
    description?: string | null;
    mode?: "answer" | "explain";
    status?: "pending" | "processing" | "completed" | "failed";
    extractedQuestions?: ExtractedQuestion[];
    isPublic?: boolean;
    courseId?: string | null;
  }
): Promise<AssignmentRecord> {
  assertAssignmentId(assignmentId);
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) payload.title = updates.title.trim();
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.mode !== undefined) payload.mode = updates.mode;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.extractedQuestions !== undefined) payload.extracted_questions = updates.extractedQuestions;
  if (updates.isPublic !== undefined) payload.is_public = updates.isPublic;
  if (updates.courseId !== undefined) payload.course_id = updates.courseId;

  const { data, error } = await client
    .from("assignments")
    .update(payload)
    .eq("id", assignmentId)
    .eq("user_id", userId)
    .select("id,user_id,course_id,title,description,mode,status,extracted_questions,share_token,is_public,created_at,updated_at,courses(code,title)")
    .single();

  if (error) {
    throw new AssignmentApiError(500, "UPDATE_FAILED", "Failed to update assignment.");
  }
  return mapAssignmentRow(data as AssignmentRow);
}

export async function deleteAssignment(
  client: Client,
  assignmentId: string,
  userId: string
): Promise<void> {
  assertAssignmentId(assignmentId);
  const { error } = await client
    .from("assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("user_id", userId);

  if (error) {
    throw new AssignmentApiError(500, "DELETE_FAILED", "Failed to delete assignment.");
  }
}

export async function getAssignmentMessages(
  client: Client,
  assignmentId: string
): Promise<AssignmentMessageRecord[]> {
  assertAssignmentId(assignmentId);
  const { data, error } = await client
    .from("assignment_messages")
    .select("id,assignment_id,user_id,role,content,metadata,created_at")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new AssignmentApiError(500, "FETCH_MESSAGES_FAILED", "Failed to load messages.");
  }

  return (data ?? []).map((m: {
    id: string;
    assignment_id: string;
    user_id: string;
    role: "user" | "assistant";
    content: string;
    metadata: unknown;
    created_at: string;
  }) => ({
    id: m.id,
    assignmentId: m.assignment_id,
    userId: m.user_id,
    role: m.role,
    content: m.content,
    metadata: typeof m.metadata === "object" && m.metadata !== null ? (m.metadata as Record<string, unknown>) : {},
    createdAt: m.created_at,
  }));
}

export async function insertAssignmentMessage(
  client: Client,
  input: {
    assignmentId: string;
    userId: string;
    role: "user" | "assistant";
    content: string;
    metadata?: Record<string, unknown>;
  }
): Promise<AssignmentMessageRecord> {
  assertAssignmentId(input.assignmentId);
  const { data, error } = await client
    .from("assignment_messages")
    .insert({
      assignment_id: input.assignmentId,
      user_id: input.userId,
      role: input.role,
      content: input.content,
      metadata: input.metadata ?? {},
    })
    .select("id,assignment_id,user_id,role,content,metadata,created_at")
    .single();

  if (error) {
    throw new AssignmentApiError(500, "INSERT_MESSAGE_FAILED", "Failed to save message.");
  }

  return {
    id: data.id,
    assignmentId: data.assignment_id,
    userId: data.user_id,
    role: data.role,
    content: data.content,
    metadata: (data.metadata ?? {}) as Record<string, unknown>,
    createdAt: data.created_at,
  };
}

export async function getAssignmentAttachments(
  client: Client,
  assignmentId: string
): Promise<AssignmentAttachmentRecord[]> {
  assertAssignmentId(assignmentId);
  const { data, error } = await client
    .from("assignment_attachments")
    .select("id,assignment_id,user_id,file_name,file_type,file_size,storage_path,extracted_text,created_at")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new AssignmentApiError(500, "FETCH_ATTACHMENTS_FAILED", "Failed to retrieve attachments.");
  }

  return (data ?? []).map((a: {
    id: string;
    assignment_id: string;
    user_id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    storage_path: string;
    extracted_text: string | null;
    created_at: string;
  }) => ({
    id: a.id,
    assignmentId: a.assignment_id,
    userId: a.user_id,
    fileName: a.file_name,
    fileType: a.file_type,
    fileSize: Number(a.file_size),
    storagePath: a.storage_path,
    extractedText: a.extracted_text,
    createdAt: a.created_at,
  }));
}

export async function insertAssignmentAttachment(
  client: Client,
  input: {
    assignmentId: string;
    userId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    storagePath: string;
    extractedText?: string | null;
  }
): Promise<AssignmentAttachmentRecord> {
  assertAssignmentId(input.assignmentId);
  const { data, error } = await client
    .from("assignment_attachments")
    .insert({
      assignment_id: input.assignmentId,
      user_id: input.userId,
      file_name: input.fileName,
      file_type: input.fileType,
      file_size: input.fileSize,
      storage_path: input.storagePath,
      extracted_text: input.extractedText ?? null,
    })
    .select("id,assignment_id,user_id,file_name,file_type,file_size,storage_path,extracted_text,created_at")
    .single();

  if (error) {
    throw new AssignmentApiError(500, "INSERT_ATTACHMENT_FAILED", "Failed to save attachment.");
  }

  return {
    id: data.id,
    assignmentId: data.assignment_id,
    userId: data.user_id,
    fileName: data.file_name,
    fileType: data.file_type,
    fileSize: Number(data.file_size),
    storagePath: data.storage_path,
    extractedText: data.extracted_text,
    createdAt: data.created_at,
  };
}

export async function getAssignmentByShareToken(
  client: Client,
  shareToken: string
): Promise<{ assignment: AssignmentRecord; messages: AssignmentMessageRecord[]; attachments: AssignmentAttachmentRecord[] } | null> {
  if (!shareToken || typeof shareToken !== "string" || shareToken.length < 16) {
    return null;
  }

  const { data: assignmentData, error } = await client
    .from("assignments")
    .select("id,user_id,course_id,title,description,mode,status,extracted_questions,share_token,is_public,created_at,updated_at,courses(code,title)")
    .eq("share_token", shareToken)
    .eq("is_public", true)
    .maybeSingle();

  if (error || !assignmentData) return null;
  const assignment = mapAssignmentRow(assignmentData as AssignmentRow);

  const [messages, attachments] = await Promise.all([
    getAssignmentMessages(client, assignment.id),
    getAssignmentAttachments(client, assignment.id),
  ]);

  return { assignment, messages, attachments };
}

export async function regenerateAssignmentShareToken(
  client: Client,
  assignmentId: string,
  userId: string
): Promise<string> {
  assertAssignmentId(assignmentId);
  const newToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const { error } = await client
    .from("assignments")
    .update({ share_token: newToken, updated_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .eq("user_id", userId);

  if (error) {
    throw new AssignmentApiError(500, "REGENERATE_FAILED", "Could not generate a new share link.");
  }
  return newToken;
}

export async function getUserCollection(
  client: Client,
  userId: string
): Promise<AssignmentCollectionRecord> {
  const { data, error } = await client
    .from("assignment_collections")
    .select("id,user_id,title,description,share_token,is_public,created_at,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[assignments:repository] getUserCollection error:", error);
    throw new AssignmentApiError(500, "FETCH_COLLECTION_FAILED", `Failed to retrieve collection: ${error.message}`);
  }

  if (data) {
    return {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      description: data.description,
      shareToken: data.share_token,
      isPublic: data.is_public,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  // Create default record if not found
  const { data: created, error: createError } = await client
    .from("assignment_collections")
    .insert({ user_id: userId, title: "My Assignments Collection", is_public: false })
    .select("id,user_id,title,description,share_token,is_public,created_at,updated_at")
    .single();

  if (createError) {
    console.error("[assignments:repository] createCollection error:", createError);
    throw new AssignmentApiError(500, "CREATE_COLLECTION_FAILED", `Failed to initialize collection: ${createError.message}`);
  }

  return {
    id: created.id,
    userId: created.user_id,
    title: created.title,
    description: created.description,
    shareToken: created.share_token,
    isPublic: created.is_public,
    createdAt: created.created_at,
    updatedAt: created.updated_at,
  };
}

export async function updateUserCollection(
  client: Client,
  userId: string,
  updates: { isPublic?: boolean; title?: string; description?: string | null; regenerateToken?: boolean }
): Promise<AssignmentCollectionRecord> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.isPublic !== undefined) payload.is_public = updates.isPublic;
  if (updates.title !== undefined) payload.title = updates.title.trim();
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.regenerateToken) {
    payload.share_token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  }

  // Ensure record exists
  await getUserCollection(client, userId);

  const { data, error } = await client
    .from("assignment_collections")
    .update(payload)
    .eq("user_id", userId)
    .select("id,user_id,title,description,share_token,is_public,created_at,updated_at")
    .single();

  if (error) {
    console.error("[assignments:repository] updateUserCollection error:", error);
    throw new AssignmentApiError(500, "UPDATE_COLLECTION_FAILED", `Failed to update collection: ${error.message}`);
  }

  return {
    id: data.id,
    userId: data.user_id,
    title: data.title,
    description: data.description,
    shareToken: data.share_token,
    isPublic: data.is_public,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getCollectionByShareToken(
  client: Client,
  shareToken: string
): Promise<{
  collection: AssignmentCollectionRecord;
  courses: Array<{
    code: string;
    title: string;
    assignments: Array<{
      id: string;
      title: string;
      mode: "answer" | "explain";
      shareToken: string;
      updatedAt: string;
    }>;
  }>;
} | null> {
  if (!shareToken || typeof shareToken !== "string" || shareToken.length < 16) {
    return null;
  }

  const { data: colData, error: colError } = await client
    .from("assignment_collections")
    .select("id,user_id,title,description,share_token,is_public,created_at,updated_at")
    .eq("share_token", shareToken)
    .eq("is_public", true)
    .maybeSingle();

  if (colError || !colData) return null;

  const collection: AssignmentCollectionRecord = {
    id: colData.id,
    userId: colData.user_id,
    title: colData.title,
    description: colData.description,
    shareToken: colData.share_token,
    isPublic: colData.is_public,
    createdAt: colData.created_at,
    updatedAt: colData.updated_at,
  };

  // Get all public assignments for this user
  const { data: assignmentsData, error: aError } = await client
    .from("assignments")
    .select("id,title,mode,share_token,updated_at,course_id,courses(code,title)")
    .eq("user_id", collection.userId)
    .eq("is_public", true)
    .order("updated_at", { ascending: false });

  if (aError) {
    throw new AssignmentApiError(500, "FETCH_COLLECTION_ASSIGNMENTS_FAILED", "Failed to load collection items.");
  }

  // Group by course
  const courseMap = new Map<string, {
    code: string;
    title: string;
    assignments: Array<{
      id: string;
      title: string;
      mode: "answer" | "explain";
      shareToken: string;
      updatedAt: string;
    }>;
  }>();

  for (const row of assignmentsData ?? []) {
    const r = row as {
      id: string;
      title: string;
      mode: "answer" | "explain";
      share_token: string;
      updated_at: string;
      course_id: string | null;
      courses?: { code: string; title: string } | null;
    };
    const courseKey = r.courses?.code || "General";
    if (!courseMap.has(courseKey)) {
      courseMap.set(courseKey, {
        code: r.courses?.code || "GEN",
        title: r.courses?.title || "General Assignments",
        assignments: [],
      });
    }
    courseMap.get(courseKey)!.assignments.push({
      id: r.id,
      title: r.title,
      mode: r.mode,
      shareToken: r.share_token,
      updatedAt: r.updated_at,
    });
  }

  return {
    collection,
    courses: Array.from(courseMap.values()),
  };
}
