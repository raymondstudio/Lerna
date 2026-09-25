import { NextResponse, type NextRequest } from "next/server";

import type { ChatReference } from "@/lib/chat/references";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CourseRow = {
  id: string;
  code: string;
  title: string;
};

type MaterialReferenceRow = {
  id: string;
  file_name: string;
  file_type: string;
  course_id: string | null;
};

const MAX_REFERENCE_RESULTS = 50;
const MAX_RESULTS_PER_KIND = MAX_REFERENCE_RESULTS / 2;

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        requestId,
        error: { code: "UNAUTHORIZED", message: "You must be signed in to search learning materials." },
      },
      { status: 401 },
    );
  }

  const rawQuery = request.nextUrl.searchParams.get("query")?.trim().slice(0, 100) ?? "";
  const searchQuery = rawQuery.replace(/[^\p{L}\p{N}\s._-]/gu, " ").replace(/\s+/g, " ").trim();

  try {
    let coursesQuery = supabase
      .from("courses")
      .select("id,code,title")
      .eq("user_id", user.id);

    let materialsQuery = supabase
      .from("uploaded_materials")
      .select("id,file_name,file_type,course_id")
      .eq("user_id", user.id)
      .eq("status", "ready")
      .is("deleted_at", null);

    if (searchQuery) {
      coursesQuery = coursesQuery.or(`code.ilike.%${searchQuery}%,title.ilike.%${searchQuery}%`);
      materialsQuery = materialsQuery.ilike("file_name", `%${searchQuery}%`);
    }

    const [{ data: courses, error: coursesError }, { data: materials, error: materialsError }] = await Promise.all([
      coursesQuery.order("code", { ascending: true }).limit(MAX_RESULTS_PER_KIND),
      materialsQuery.order("created_at", { ascending: false }).limit(MAX_RESULTS_PER_KIND),
    ]);

    if (coursesError || materialsError) {
      console.error("[api:chat-references] lookup failed", {
        requestId,
        coursesError,
        materialsError,
      });
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: { code: "FETCH_FAILED", message: "Learning materials could not be loaded." },
        },
        { status: 500 },
      );
    }

    const materialRows = (materials ?? []) as MaterialReferenceRow[];
    const courseIds = [...new Set(materialRows.map((material) => material.course_id).filter((id): id is string => Boolean(id)))];
    const courseCodes = new Map<string, string>();

    if (courseIds.length > 0) {
      const { data: linkedCourses, error: linkedCoursesError } = await supabase
        .from("courses")
        .select("id,code")
        .eq("user_id", user.id)
        .in("id", courseIds);

      if (linkedCoursesError) {
        console.warn("[api:chat-references] course metadata lookup failed", { requestId, linkedCoursesError });
      } else {
        for (const course of linkedCourses ?? []) {
          courseCodes.set(course.id, course.code);
        }
      }
    }

    const references: ChatReference[] = [
      ...((courses ?? []) as CourseRow[]).map((course) => ({
        id: course.id,
        kind: "course" as const,
        title: course.title,
        code: course.code,
      })),
      ...materialRows.map((material) => ({
        id: material.id,
        kind: "material" as const,
        title: material.file_name,
        fileType: material.file_type,
        courseCode: material.course_id ? courseCodes.get(material.course_id) : undefined,
      })),
    ].slice(0, MAX_REFERENCE_RESULTS);

    return NextResponse.json({
      success: true,
      requestId,
      data: { references },
    });
  } catch (error) {
    console.error("[api:chat-references] unexpected error", { requestId, error });
    return NextResponse.json(
      {
        success: false,
        requestId,
        error: { code: "SERVER_ERROR", message: "Learning materials could not be loaded." },
      },
      { status: 500 },
    );
  }
}
