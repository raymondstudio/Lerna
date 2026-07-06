import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function searchInstitutions(query: string, type?: string, limit?: number) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("search_institutions", {
    search_query: query,
    filter_type: type || null,
    limit_val: limit || 20
  });
  if (error) throw error;
  return data || [];
}

export async function createCustomInstitution(data: {
  name: string;
  institution_type: string;
  state: string;
  country: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: newInst, error } = await supabase
    .from("institutions")
    .insert({
      name: data.name.trim(),
      institution_type: data.institution_type,
      state: data.state.trim() || null,
      country: data.country.trim() || "Nigeria",
      is_verified: false // Custom school flagged for admin review
    })
    .select()
    .single();

  if (error) throw error;
  return newInst;
}

export async function getInstitutionAnalytics() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_institution_analytics");
  if (error) throw error;
  return data;
}

export async function getUnverifiedInstitutions() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("institutions")
    .select("*")
    .eq("is_verified", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function verifyInstitution(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("institutions")
    .update({ is_verified: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteInstitution(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("institutions")
    .delete()
    .eq("id", id);
  if (error) throw error;
  return true;
}
