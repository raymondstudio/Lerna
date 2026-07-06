import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MATERIAL_SELECT, type MaterialRow } from "@/lib/materials/types";
import { serializeMaterial } from "@/lib/materials/serialize";

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        requestId,
        error: {
          code: "UNAUTHORIZED",
          message: "You must be signed in to view materials.",
        },
      },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  let query = supabase
    .from("uploaded_materials")
    .select(MATERIAL_SELECT)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      {
        success: false,
        requestId,
        error: {
          code: "FETCH_FAILED",
          message: error.message,
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    requestId,
    data: {
      materials: ((data ?? []) as MaterialRow[]).map(serializeMaterial),
    },
  });
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        requestId,
        error: {
          code: "UNAUTHORIZED",
          message: "You must be signed in to create materials.",
        },
      },
      { status: 401 }
    );
  }

  try {
    const { sessionId, fileName, fileType, storagePath, fileSize } = await req.json();
    if (!sessionId || !fileName || !fileType || !storagePath) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: "BAD_REQUEST",
            message: "Missing required fields.",
          },
        },
        { status: 400 }
      );
    }

    const { insertMaterial } = await import("@/lib/repositories/materials");
    const insertedRow = await insertMaterial(user.id, sessionId, fileName, fileType, storagePath, fileSize);

    return NextResponse.json({
      success: true,
      requestId,
      data: insertedRow
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        requestId,
        error: {
          code: "INSERT_FAILED",
          message: err.message || String(err),
        },
      },
      { status: 500 }
    );
  }
}
