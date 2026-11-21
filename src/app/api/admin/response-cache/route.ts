/**
 * GET  /api/admin/response-cache         — cache health & top-hit analytics
 * DELETE /api/admin/response-cache       — flush the entire cache (admin only)
 * DELETE /api/admin/response-cache?id=… — evict a single entry by UUID
 */

import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

// ---------------------------------------------------------------------------
// GET — cache analytics
// ---------------------------------------------------------------------------
export async function GET() {
  const auth = await authorizeAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const db = createSupabaseAdminClient();

    const [summary, topHits] = await Promise.all([
      db
        .from("ai_response_cache")
        .select("id, hit_count, created_at, expires_at, model_used, request_type", {
          count: "exact",
        })
        .order("created_at", { ascending: false })
        .limit(1),

      db
        .from("ai_response_cache")
        .select(
          "id, question_text, hit_count, similarity:hit_count, model_used, created_at, last_hit_at"
        )
        .order("hit_count", { ascending: false })
        .limit(20),
    ]);

    // Aggregate totals across all rows via a separate count query.
    const { count: totalEntries } = await db
      .from("ai_response_cache")
      .select("*", { count: "exact", head: true });

    const { data: hitTotals } = await db
      .from("ai_response_cache")
      .select("hit_count");

    const totalHits = (hitTotals ?? []).reduce(
      (sum, row) => sum + (row.hit_count ?? 0),
      0
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          totalEntries: totalEntries ?? 0,
          totalHits,
          topHits: topHits.data ?? [],
          latestEntry: summary.data?.[0] ?? null,
        },
      },
      { headers: NO_STORE }
    );
  } catch (err) {
    console.error("[api:admin:response-cache] GET failed", err);
    return NextResponse.json(
      { success: false, error: "Cache analytics could not be loaded." },
      { status: 503, headers: NO_STORE }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — flush all entries OR evict a single entry by ?id=<uuid>
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const auth = await authorizeAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const db = createSupabaseAdminClient();
    const entryId = req.nextUrl.searchParams.get("id");

    if (entryId) {
      // Single-entry eviction.
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuid.test(entryId)) {
        return NextResponse.json(
          { success: false, error: "Invalid entry ID." },
          { status: 400, headers: NO_STORE }
        );
      }

      const { error } = await db
        .from("ai_response_cache")
        .delete()
        .eq("id", entryId);

      if (error) throw error;
      return NextResponse.json({ success: true, evicted: entryId }, { headers: NO_STORE });
    }

    // Full flush.
    const { error } = await db
      .from("ai_response_cache")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all rows

    if (error) throw error;
    return NextResponse.json({ success: true, flushed: true }, { headers: NO_STORE });
  } catch (err) {
    console.error("[api:admin:response-cache] DELETE failed", err);
    return NextResponse.json(
      { success: false, error: "Cache operation failed." },
      { status: 503, headers: NO_STORE }
    );
  }
}
