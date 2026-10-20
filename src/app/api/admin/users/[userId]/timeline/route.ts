import { GET as activityGet } from "@/app/api/admin/events/route";
import { UUID } from "@/lib/activity/query";
import { ActivityError } from "@/lib/activity/contracts";
import { activityFailure } from "@/lib/activity/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!UUID.test(userId)) return activityFailure(new ActivityError("Invalid user ID."));
  const url = new URL(request.url); url.searchParams.set("user_id", userId);
  return activityGet(new Request(url, { headers: request.headers }));
}
