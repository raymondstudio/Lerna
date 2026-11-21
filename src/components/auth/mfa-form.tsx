"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sanitizeAuthReturnPath } from "@/lib/auth/return-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MfaForm({ returnTo }: { returnTo: string }) {
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [needsEnrollment, setNeedsEnrollment] = useState(false);
  const [error, setError] = useState("");
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!supabase) throw new Error();
        const { data, error: factorError } = await supabase.auth.mfa.listFactors();
        if (factorError) throw factorError;
        if (!active) return;
        const factor = data.totp.find((item) => item.status === "verified");
        if (factor) setFactorId(factor.id);
        else setNeedsEnrollment(true);
      } catch {
        if (active) setError("Authenticator settings could not be loaded. Reload to retry.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [supabase]);

  async function enroll() {
    setLoading(true);
    setError("");
    try {
      if (!supabase) throw new Error();
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Lerna ${Date.now().toString()}` });
      if (enrollError || !data) throw enrollError;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setNeedsEnrollment(false);
    } catch {
      setError("Authenticator setup could not be started. Please retry or contact support.");
    } finally { setLoading(false); }
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[0-9]{6}$/.test(code)) { setError("Enter the six-digit code from your authenticator."); return; }
    setLoading(true);
    setError("");
    try {
      if (!supabase || !factorId) throw new Error();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (verifyError) throw verifyError;
      // A full navigation propagates the new real AAL2 session to server guards.
      window.location.assign(sanitizeAuthReturnPath(returnTo, "/admin"));
    } catch {
      setCode("");
      setError("The code could not be verified. Use a new code and try again.");
      setLoading(false);
    }
  }

  return <div className="mt-6 space-y-4">
    {loading && !factorId && <p role="status">Loading authenticator settings…</p>}
    {needsEnrollment && <div className="space-y-3">
      <p className="text-sm text-slate-300">Set up an authenticator app on your device, then verify its code.</p>
      <Button onClick={enroll} disabled={loading}>Set up authenticator</Button>
    </div>}
    {qrCode && <div className="space-y-3">
      <p className="text-sm text-slate-300">Scan this private QR code with your authenticator. Do not share or capture it.</p>
      {/* Auth provider generated QR; never inject its SVG as HTML or log the enrollment secret. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode)}`} alt="Private authenticator enrollment QR code" width={220} height={220} className="bg-white p-2" />
    </div>}
    {factorId && <form onSubmit={verify} className="space-y-4">
      <label htmlFor="authenticator-code" className="block text-sm">Authenticator code</label>
      <Input id="authenticator-code" value={code} onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
        inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6} required autoFocus disabled={loading} />
      <Button type="submit" disabled={loading}>{loading ? "Verifying…" : "Verify and continue"}</Button>
    </form>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    <Link href="/admin" className="block text-sm text-cyan-300 underline">Return to admin</Link>
  </div>;
}
