import { redirect } from "next/navigation";
import { AuthApiError, requireAuthenticatedUserApi } from "@/lib/auth/require-active-user-api";
import { RecoveryForm } from "@/components/auth/recovery-form";
import { cookies } from "next/headers";
import { assertRecoveryProof, RecoveryError, RECOVERY_PROOF_COOKIE } from "@/lib/auth/recovery-server";

export const dynamic = "force-dynamic";
export default async function ResetPasswordPage() {
  try {
    const { supabase } = await requireAuthenticatedUserApi();
    await assertRecoveryProof(supabase, (await cookies()).get(RECOVERY_PROOF_COOKIE)?.value);
  } catch (error) {
    if ((error instanceof AuthApiError || error instanceof RecoveryError) && error.status === 401) redirect("/?auth=login&error=Recovery%20link%20invalid%20or%20expired.%20Request%20a%20new%20link.");
    throw error;
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
    <section className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 sm:p-8" aria-label="Password recovery">
      <RecoveryForm />
    </section>
  </main>;
}
