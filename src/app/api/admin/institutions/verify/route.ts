import { NextResponse } from "next/server";
import { getUnverifiedInstitutions, verifyInstitution, deleteInstitution } from "@/lib/repositories/institutions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function verifyAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    throw new Error("Unauthenticated");
  }

  const { data: isAdmin } = await supabase.rpc("is_admin", { user_id: userData.user.id });
  const adminEmails = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim())
    : ["admin@eduagent.ai"];
  const isFallbackAdmin = userData.user.email && adminEmails.includes(userData.user.email);
  const isRoleAdmin = userData.user.app_metadata?.role === "admin";

  if (!isAdmin && !isFallbackAdmin && !isRoleAdmin) {
    throw new Error("Unauthorized");
  }
}

export async function GET() {
  try {
    await verifyAdmin();
    const data = await getUnverifiedInstitutions();
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    const status = err.message === "Unauthenticated" ? 401 : err.message === "Unauthorized" ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await verifyAdmin();
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });
    }
    const data = await verifyInstitution(id);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    const status = err.message === "Unauthenticated" ? 401 : err.message === "Unauthorized" ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    await verifyAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });
    }
    await deleteInstitution(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.message === "Unauthenticated" ? 401 : err.message === "Unauthorized" ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
