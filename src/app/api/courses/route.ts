import { NextResponse, type NextRequest } from "next/server";
import { authorizeActiveUserApi } from "@/lib/auth/require-active-user-api";

export async function GET(request: NextRequest) {
  const auth = await authorizeActiveUserApi();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  try {
    const rawQuery = request.nextUrl.searchParams.get("query")?.trim().slice(0, 100) ?? "";
    const searchQuery = rawQuery.replace(/[,()%]/g, " ").replace(/\s+/g, " ").trim();
    const compact = request.nextUrl.searchParams.get("compact") === "true";
    const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? (compact ? 50 : 200));
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 200) : 50;

    let coursesQuery = supabase
      .from("courses")
      .select(compact ? "id,code,title" : "*, uploaded_materials(id)")
      .eq("user_id", user.id);

    if (searchQuery) {
      coursesQuery = coursesQuery.or(`code.ilike.%${searchQuery}%,title.ilike.%${searchQuery}%`);
    }

    const { data, error } = await coursesQuery
      .order(compact ? "code" : "created_at", { ascending: compact })
      .limit(limit);

    if (error) {
      console.error("[api:courses] fetch failed", { code: error.code });
      return NextResponse.json({ error: "Courses could not be loaded." }, { status: 500 });
    }

    return NextResponse.json({ courses: data });
  } catch {
    console.error("[api:courses] unexpected error");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorizeActiveUserApi();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  try {
    const body = await request.json();
    const { code, title, description } = body;

    if (!code || !title) {
      return NextResponse.json({ error: "Code and title are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("courses")
      .insert([
        {
          user_id: user.id,
          code,
          title,
          description,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("[api:courses] create failed", { code: error.code });
      return NextResponse.json({ error: "Course could not be created." }, { status: 500 });
    }

    return NextResponse.json({ course: data });
  } catch {
    console.error("[api:courses] unexpected error");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
