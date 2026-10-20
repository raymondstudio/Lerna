export async function POST() {
  return Response.json({ success: false, error: "Use the allowlisted /api/analytics/activity endpoint." }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
