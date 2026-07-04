import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { processMaterial } from "@/lib/materials/ingestion";
import { buildUploadPath, UPLOADED_MATERIALS_BUCKET } from "@/lib/uploads/constants";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  console.log(`[upload:api] [${requestId}] Starting upload request handler...`);

  try {
    console.log(`[upload:api] [${requestId}] Step 1: Performing auth check...`);
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      console.warn(`[upload:api] [${requestId}] Auth check failed: Unauthorized`);
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    console.log(`[upload:api] [${requestId}] Auth check successful for user: ${user.id}`);

    console.log(`[upload:api] [${requestId}] Step 2: Parsing formData...`);
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const sessionId = formData.get("sessionId") as string;

    if (!file || !sessionId) {
      console.warn(`[upload:api] [${requestId}] Parsing failed: file or sessionId missing`);
      return NextResponse.json({ success: false, error: "File and sessionId are required" }, { status: 400 });
    }
    console.log(`[upload:api] [${requestId}] FormData parsed: filename="${file.name}", size=${file.size}, sessionId="${sessionId}"`);

    // Convert File to ArrayBuffer and Buffer
    console.log(`[upload:api] [${requestId}] Converting file to ArrayBuffer...`);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Upload file to Supabase storage bucket 'uploaded-materials'
    const storagePath = buildUploadPath(user.id, sessionId, file.name);
    console.log(`[upload:api] [${requestId}] Step 3: Uploading file to storage path: "${storagePath}" in bucket "${UPLOADED_MATERIALS_BUCKET}"...`);
    const { error: uploadError } = await supabase.storage
      .from(UPLOADED_MATERIALS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error(`[upload:api] [${requestId}] Storage upload failed:`, uploadError);
      return NextResponse.json({ success: false, error: "Failed to upload file to storage" }, { status: 500 });
    }
    console.log(`[upload:api] [${requestId}] Storage upload successful`);

    // 2. Insert metadata into the database uploaded_materials table
    console.log(`[upload:api] [${requestId}] Step 4: Inserting metadata into database uploaded_materials table...`);
    const { data: insertedRow, error: insertError } = await supabase
      .from("uploaded_materials")
      .insert({
        user_id: user.id,
        session_id: sessionId,
        file_name: file.name,
        file_type: file.type || "application/octet-stream",
        storage_path: storagePath,
        file_size: file.size,
        ocr_status: "processing",
        embedding_status: "processing",
        last_accessed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !insertedRow) {
      console.error(`[upload:api] [${requestId}] Database insert failed:`, insertError);
      // Clean up uploaded file on failure
      console.log(`[upload:api] [${requestId}] Cleaning up uploaded file from storage...`);
      await supabase.storage.from(UPLOADED_MATERIALS_BUCKET).remove([storagePath]).catch((err) => {
        console.error(`[upload:api] [${requestId}] Cleanup removal failed:`, err);
      });
      return NextResponse.json({ success: false, error: insertError?.message || "Failed to save upload metadata" }, { status: 500 });
    }
    console.log(`[upload:api] [${requestId}] Database insert successful. Inserted ID: ${insertedRow.id}`);

    // 3. Process the material (extraction, chunking, embedding, ElasticSearch indexing)
    console.log(`[upload:api] [${requestId}] Step 5: Invoking processMaterial for ID: ${insertedRow.id}`);
    try {
      await processMaterial({
        supabase,
        materialId: insertedRow.id,
        userId: user.id,
      });
      console.log(`[upload:api] [${requestId}] processMaterial completed successfully`);
    } catch (processError) {
      console.error(`[upload:api] [${requestId}] Document processing failed:`, processError);
      const message = processError instanceof Error ? processError.message : "Document processing failed";
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Successfully processed document.",
    });

  } catch (error) {
    console.error(`[upload:api] [${requestId}] Unexpected route-level handler error:`, error);
    return NextResponse.json({ success: false, error: "Failed to process document" }, { status: 500 });
  }
}
