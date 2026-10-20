import { redirect } from "next/navigation";
import { AdminApiError, requireAdminApi } from "@/lib/auth/require-admin-api";

export async function requireAdmin() {
  try {
    const { user } = await requireAdminApi();
    return user;
  } catch (error) {
    if (!(error instanceof AdminApiError)) throw error;
    if (error.status === 401) redirect("/?auth=login&redirectTo=%2Fadmin");
    if (error.status === 403) redirect("/chat?error=unauthorized");
    throw error;
  }
}
