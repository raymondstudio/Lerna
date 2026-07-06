import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function enqueueEmail(
  recipient: string,
  subject: string,
  template: string,
  payload: Record<string, any>
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("email_queue").insert({
      recipient,
      subject,
      template,
      payload,
      status: "pending"
    });
    if (error) {
      console.error("[EmailQueue] Failed to enqueue email:", error);
    }
  } catch (err) {
    console.error("[EmailQueue] Exception in enqueueEmail:", err);
  }
}
