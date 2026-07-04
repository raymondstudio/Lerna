import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect(`/?auth=login&redirectTo=${encodeURIComponent("/admin")}`);
  }

  try {
    const { data: isAdmin, error } = await supabase.rpc("is_admin", {
      user_id: data.user.id,
    });

    if (error) {
      console.error("[require-admin] RPC is_admin failed:", error);
    }

    if (isAdmin) {
      return data.user;
    }
  } catch (err) {
    console.error("[require-admin] Failed to check admin status:", err);
  }

  // Fallback checks for bootstrapping or offline/local testing
  const adminEmails = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim())
    : ["admin@eduagent.ai"];

  if (data.user.email && adminEmails.includes(data.user.email)) {
    return data.user;
  }

  if (data.user.app_metadata?.role === "admin") {
    return data.user;
  }

  // Redirect to workspace page if not authorized
  redirect("/chat?error=unauthorized");
}
