import { redirect } from "next/navigation";
import { AdminApiError, requireAdminApi } from "@/lib/auth/require-admin-api";
import { sanitizeAuthReturnPath } from "@/lib/auth/return-path";
import { MfaForm } from "@/components/auth/mfa-form";

export const dynamic = "force-dynamic";
export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  try { await requireAdminApi(); } catch (error) {
    if (error instanceof AdminApiError && error.status === 401) redirect("/?auth=login&redirectTo=%2Fauth%2Fmfa");
    if (error instanceof AdminApiError && error.status === 403) redirect("/chat?error=unauthorized");
    throw error;
  }
  const returnTo = sanitizeAuthReturnPath((await searchParams).next, "/admin");
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
    <section className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">Verify your authenticator</h1>
      <p className="mt-2 text-sm text-slate-300">An authenticator code is required for sensitive admin operations.</p>
      <MfaForm returnTo={returnTo} />
    </section>
  </main>;
}
