"use client";

import { useState } from "react";
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

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
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

      const { error: updateError } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (updateError) {
        throw updateError;
      }

      setMessage("Password updated successfully. You will now be redirected to the landing page.");
      
      // Delay before redirecting to complete success flow
      setTimeout(async () => {
        await supabase.auth.signOut();
        onSuccess();
      }, 2500);
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
          Choose a secure password with a minimum of 6 characters.
        </p>
      </div>

      {message ? (
        <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              id="new-password"
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#1c1f26] border-white/5 h-11 focus-visible:ring-cyan-500/50"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Input
              id="confirm-password"
              type="password"
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
