import { redirect } from "next/navigation";
import { cache } from "react";
import { AuthApiError, requireActiveUserApi } from "@/lib/auth/require-active-user-api";
import { sanitizeAuthReturnPath } from "@/lib/auth/return-path";

export const requireUser = cache(async (returnTo: string) => {
  try {
    const { user } = await requireActiveUserApi();
    return user;
  } catch (error) {
    if (!(error instanceof AuthApiError)) throw error;
    if (error.status === 401) redirect(`/?auth=login&redirectTo=${encodeURIComponent(sanitizeAuthReturnPath(returnTo))}`);
    if (error.status === 403) redirect("/?auth=login&error=Account%20unavailable.%20Contact%20support.");
    throw error;
  }
});
