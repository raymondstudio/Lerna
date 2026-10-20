import { NextResponse } from "next/server";
import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { getUnverifiedInstitutions, verifyInstitution, deleteInstitution } from "@/lib/repositories/institutions";

export async function GET() {
  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;
  try {
    return NextResponse.json({ success: true, data: await getUnverifiedInstitutions() });
  } catch {
    return NextResponse.json({ success: false, error: "Institutions could not be loaded." }, { status: 500 });
  }
}
export async function POST(req: Request) {
  const authorization = await authorizeAdminApi({ requireMfa: true });
  if (!authorization.ok) return authorization.response;
  try {
    const { id } = await req.json();
    if (typeof id !== "string" || !id) return NextResponse.json({ success: false, error: "ID is required." }, { status: 400 });
    return NextResponse.json({ success: true, data: await verifyInstitution(id) });
  } catch {
    return NextResponse.json({ success: false, error: "Institution could not be verified." }, { status: 500 });
  }
}
export async function DELETE(req: Request) {
  const authorization = await authorizeAdminApi({ requireMfa: true });
  if (!authorization.ok) return authorization.response;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "ID is required." }, { status: 400 });
  try {
    await deleteInstitution(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Institution could not be deleted." }, { status: 500 });
  }
}
