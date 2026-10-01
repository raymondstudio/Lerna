import { createSupabaseServerClient } from "@/lib/supabase/server";

export class AdminApiError extends Error {
  constructor(message: string, public readonly status: 401 | 403) {
    super(message);
  }
}

export async function requireAdminApi() {
  const supabase = await createSupabaseServerClient();
  const { data, error: userError } = await supabase.auth.getUser();
  const user = data.user;

  if (userError || !user) throw new AdminApiError("Unauthenticated", 401);

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin", { user_id: user.id });
  const configuredAdmins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const fallbackAdmin = Boolean(user.email && configuredAdmins.includes(user.email.toLowerCase()));
  const roleAdmin = user.app_metadata?.role === "admin" || user.app_metadata?.role === "owner";

  if ((!isAdmin || adminError) && !fallbackAdmin && !roleAdmin) {
    throw new AdminApiError("Unauthorized", 403);
  }

  return { supabase, user };
}
