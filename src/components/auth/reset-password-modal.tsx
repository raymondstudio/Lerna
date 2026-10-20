"use client";

import { useState } from "react";
import { completePasswordRecovery, validRecoveryPassword } from "@/lib/auth/password-recovery";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResetPasswordModal({
  onClose,
  onSuccess
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!password.trim() || !confirmPassword.trim()) {
      setError("Please fill out both password fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!validRecoveryPassword(password)) {
      setError("Use at least 8 characters, including uppercase, lowercase, a number and a special character.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      const result = await completePasswordRecovery(supabase, password);
      if (!result.signedOut) {
        setMessage("Password updated. Sign-out could not be confirmed. Close this page and sign in again.");
        return;
      }

      setMessage("Password updated. Sign in with your new password.");

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white">Create New Password</h2>
        <p className="text-slate-400 text-xs mt-2">
          Use 8 or more characters with uppercase, lowercase, a number and a special character.
        </p>
      </div>

      {message ? (
        <div className="space-y-4">
          <p role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</p>
          <Button onClick={onSuccess} className="w-full">Continue to sign in</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="new-password" className="sr-only">New password</label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#1c1f26] border-white/5 h-11 focus-visible:ring-cyan-500/50"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className="sr-only">Confirm new password</label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-[#1c1f26] border-white/5 h-11 focus-visible:ring-cyan-500/50"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              type="button"
              onClick={onClose}
              className="flex-1 border-white/5 bg-[#1c1f26] text-slate-200 hover:bg-[#252a33]"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              type="submit"
              disabled={loading}
            >
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
