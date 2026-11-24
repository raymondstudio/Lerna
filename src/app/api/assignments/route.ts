import { NextResponse, type NextRequest } from "next/server";
import { authorizeActiveUserApi } from "@/lib/auth/require-active-user-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  listAssignments,
  createAssignment,
  insertAssignmentMessage,
  insertAssignmentAttachment,
  updateAssignment,
  AssignmentApiError,
} from "@/lib/repositories/assignments";
import {
  extractAssignmentFromAttachment,
  generateAssignmentSolution,
} from "@/lib/assignments/service";
import { UPLOADED_MATERIALS_BUCKET } from "@/lib/uploads/constants";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await authorizeActiveUserApi();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const requestId = crypto.randomUUID();
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId") || undefined;
    const search = searchParams.get("search") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;

    const data = await listAssignments(supabase, user.id, { courseId, search, limit });
    return NextResponse.json({ success: true, requestId, ...data });
  } catch (error) {
    console.error("[api:assignments:GET] failed", { requestId, error });
    const status = error instanceof AssignmentApiError ? error.status : 500;
    return NextResponse.json(
      { success: false, requestId, error: { message: error instanceof Error ? error.message : "Unable to load assignments." } },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorizeActiveUserApi();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const requestId = crypto.randomUUID();
  try {
    const contentType = request.headers.get("content-type") || "";

    let title = "New Assignment";
    let description: string | undefined = undefined;
    let courseId: string | undefined = undefined;
    let mode: "answer" | "explain" = "explain";
    let typedPrompt: string | undefined = undefined;
    let fileBuffer: Buffer | null = null;
    let fileName: string | null = null;
    let fileMime: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      title = (formData.get("title") as string) || title;
      description = (formData.get("description") as string) || undefined;
      courseId = (formData.get("courseId") as string) || undefined;
      const rawMode = formData.get("mode") as string;
      if (rawMode === "answer" || rawMode === "explain") {
        mode = rawMode;
      }
      typedPrompt = (formData.get("prompt") as string) || undefined;

      const file = formData.get("file");
      if (file instanceof File && file.size > 0) {
        if (file.size > 20 * 1024 * 1024) {
          return NextResponse.json(
            { success: false, requestId, error: { message: "File exceeds 20MB limit." } },
            { status: 413 }
          );
        }
        fileName = file.name;
        fileMime = file.type || "application/octet-stream";
        fileBuffer = Buffer.from(await file.arrayBuffer());
      }
    } else {
      const body = await request.json();
      if (body.title) title = body.title;
      if (body.description) description = body.description;
      if (body.courseId) courseId = body.courseId;
      if (body.mode === "answer" || body.mode === "explain") mode = body.mode;
      if (body.prompt) typedPrompt = body.prompt;
    }

    if (!typedPrompt?.trim() && !fileBuffer) {
      return NextResponse.json(
        { success: false, requestId, error: { message: "Please upload an assignment file or type a question." } },
        { status: 400 }
      );
    }

    // 1. Create assignment record in 'pending' status
    const assignment = await createAssignment(supabase, {
      userId: user.id,
      courseId: courseId || null,
      title: title.trim(),
      description: description || null,
      mode,
      status: "pending",
    });

    let extractedText = "";

    // 2. Process file attachment if present
    if (fileBuffer && fileName && fileMime) {
      const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `assignments/${user.id}/${assignment.id}/${Date.now()}-${safeName}`;

      await createSupabaseAdminClient().storage
        .from(UPLOADED_MATERIALS_BUCKET)
        .upload(storagePath, fileBuffer, { contentType: fileMime, upsert: true });

      const extracted = await extractAssignmentFromAttachment(fileBuffer, fileMime, fileName, user.id);
      extractedText = extracted.extractedText;

      await insertAssignmentAttachment(supabase, {
        assignmentId: assignment.id,
        userId: user.id,
        fileName,
        fileType: fileMime,
        fileSize: fileBuffer.length,
        storagePath,
        extractedText,
      });

      if (extracted.questions.length > 0) {
        await updateAssignment(supabase, assignment.id, user.id, {
          extractedQuestions: extracted.questions,
        });
      }
    }

    // 3. Save initial user prompt/message
    const userMessageContent = typedPrompt?.trim()
      ? typedPrompt.trim()
      : `Uploaded assignment: ${fileName || "document"}`;
    await insertAssignmentMessage(supabase, {
      assignmentId: assignment.id,
      userId: user.id,
      role: "user",
      content: userMessageContent,
      metadata: { fileName, mode },
    });

    // 4. Generate AI solution in selected mode
    try {
      await updateAssignment(supabase, assignment.id, user.id, { status: "processing" });

      const solution = await generateAssignmentSolution({
        assignmentTitle: assignment.title,
        courseCode: assignment.courses?.code,
        courseTitle: assignment.courses?.title,
        mode,
        extractedText,
        typedPrompt,
        userId: user.id,
        signal: request.signal,
      });

      const assistantMessage = await insertAssignmentMessage(supabase, {
        assignmentId: assignment.id,
        userId: user.id,
        role: "assistant",
        content: solution,
        metadata: { mode, generatedAt: new Date().toISOString() },
      });

      const updated = await updateAssignment(supabase, assignment.id, user.id, { status: "completed" });
      return NextResponse.json({
        success: true,
        requestId,
        assignment: updated,
        solutionMessage: assistantMessage,
      });
    } catch {
      await updateAssignment(supabase, assignment.id, user.id, { status: "failed" });
      return NextResponse.json({
        success: true,
        requestId,
        assignment: { ...assignment, status: "failed" },
        error: { message: "AI solution could not be generated. You can retry from the workspace." },
      });
    }
  } catch (error) {
    const status = error instanceof AssignmentApiError ? error.status : 500;
    return NextResponse.json(
      { success: false, requestId, error: { message: error instanceof Error ? error.message : "Could not create assignment." } },
      { status }
    );
  }
}
