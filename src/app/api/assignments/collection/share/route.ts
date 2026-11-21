import { NextResponse, type NextRequest } from "next/server";
import { authorizeActiveUserApi } from "@/lib/auth/require-active-user-api";
import {
  getUserCollection,
  updateUserCollection,
  AssignmentApiError,
} from "@/lib/repositories/assignments";
import { getAppUrl } from "@/lib/supabase/config";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await authorizeActiveUserApi();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const requestId = crypto.randomUUID();
  try {
    const collection = await getUserCollection(supabase, user.id);

    const appUrl = getAppUrl() || new URL(request.url).origin;
    const shareUrl = `${appUrl}/share/collection/${collection.shareToken}`;

    return NextResponse.json({
      success: true,
      requestId,
      collection: {
        ...collection,
        shareUrl,
      },
    });
  } catch (error) {
    console.error("[api:assignments:collection:share:GET] failed", { requestId, error });
    const status = error instanceof AssignmentApiError ? error.status : 500;
    return NextResponse.json(
      { success: false, requestId, error: { message: error instanceof Error ? error.message : "Failed to load collection settings." } },
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
    const body = await request.json().catch(() => ({}));

    const collection = await updateUserCollection(supabase, user.id, {
      isPublic: body.isPublic !== undefined ? body.isPublic : true,
      title: body.title,
      description: body.description,
      regenerateToken: Boolean(body.regenerate),
    });

    const appUrl = getAppUrl() || new URL(request.url).origin;
    const shareUrl = `${appUrl}/share/collection/${collection.shareToken}`;

    return NextResponse.json({
      success: true,
      requestId,
      collection: {
        ...collection,
        shareUrl,
      },
    });
  } catch (error) {
    console.error("[api:assignments:collection:share:POST] failed", { requestId, error });
    const status = error instanceof AssignmentApiError ? error.status : 500;
    return NextResponse.json(
      { success: false, requestId, error: { message: error instanceof Error ? error.message : "Failed to update collection settings." } },
      { status }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authorizeActiveUserApi();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const requestId = crypto.randomUUID();
  try {
    const collection = await updateUserCollection(supabase, user.id, { isPublic: false });
    return NextResponse.json({
      success: true,
      requestId,
      message: "Collection share link revoked.",
      collection,
    });
  } catch (error) {
    console.error("[api:assignments:collection:share:DELETE] failed", { requestId, error });
    const status = error instanceof AssignmentApiError ? error.status : 500;
    return NextResponse.json(
      { success: false, requestId, error: { message: error instanceof Error ? error.message : "Failed to revoke collection link." } },
      { status }
    );
  }
}
