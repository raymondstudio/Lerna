"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ForgotPasswordModal({
  onSwitchToLogin,
  onClose
}: {
  onSwitchToLogin: () => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address.");
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

      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/chat?auth=reset")}`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (resetError) {
        throw resetError;
      }

      setMessage("Check your inbox for a password reset email containing your recovery link.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send password reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white">Reset Password</h2>
        <p className="text-slate-400 text-xs mt-2">
          Enter your email address and we'll send you a recovery link to choose a new password.
        </p>
      </div>

      {message ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {message}
          </p>
          <Button onClick={onSwitchToLogin} className="w-full h-11 bg-cyan-500 text-slate-950 hover:bg-cyan-400">
            Back to Sign In
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              id="forgot-email"
              type="email"
              placeholder="Email address"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              onClick={onSwitchToLogin}
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
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
