import { redirect } from "next/navigation";
import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const requireUser = cache(async (redirectTo: string) => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect(`/?auth=login&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  return data.user;
});
