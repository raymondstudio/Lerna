"use client";

import { useEffect, useMemo, useState, useRef, useCallback, type ReactNode } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";

import { AuthContext, type AuthCredentials, type SignUpCredentials } from "@/context/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAppUrl } from "@/lib/supabase/config";
import type { ProfileWithAliases } from "@/lib/profile";
import { buildOAuthRedirectUrl } from "@/lib/auth/oauth";
import { confirmUnsavedWorkBeforeSignOut } from "@/lib/study-sessions/unsaved-work";

export function AuthProvider({ children, initialSession }: { children: ReactNode; initialSession?: Session | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(initialSession ?? null);
  const [loading, setLoading] = useState(Boolean(supabase) && !initialSession);
  const [error, setError] = useState<string | null>(supabase ? null : "Supabase is not configured. Set the public Supabase env vars to enable authentication.");
  const [profile, setProfile] = useState<ProfileWithAliases | null>(null);
  const currentUserId = useRef(session?.user?.id);
  const authRevision = useRef(0);
  useEffect(() => {
    currentUserId.current = session?.user?.id;
  }, [session?.user?.id]);

  const userId = session?.user.id;
  const acceptProfile = useCallback(async (response: Response, result: { success?: boolean; code?: string; data?: ProfileWithAliases }, requestedUserId: string) => {
    if (currentUserId.current !== requestedUserId) return;
    if (!response.ok || !result.success) {
      if (result.code === "ACCOUNT_INACTIVE" && supabase) {
        await supabase.auth.signOut({ scope: "local" });
        currentUserId.current = undefined;
        setSession(null);
        setProfile(null);
        router.replace("/?auth=login&error=Account%20unavailable.%20Contact%20support.");
      }
      throw new Error("Your profile could not be loaded. Please retry.");
    }
    if (result.data?.id !== requestedUserId) throw new Error("Profile identity did not match.");
    setProfile(result.data);
  }, [router, supabase]);
  const refreshProfile = useCallback(async () => {
    if (!supabase || !userId || pathname === "/auth/reset-password") return;
    try {
      const response = await fetch("/api/auth/profile", { cache: "no-store" });
      await acceptProfile(response, await response.json(), userId);
    } catch {
      if (currentUserId.current === userId) setError("Your profile could not be loaded. Please retry.");
    }
  }, [supabase, userId, pathname, acceptProfile]);

  useEffect(() => {
    if (!supabase || !userId || pathname === "/auth/reset-password") return;
    const abort = new AbortController();
    // Profile state changes only after the external request settles.
    void fetch("/api/auth/profile", { cache: "no-store", signal: abort.signal })
      .then(async response => { await acceptProfile(response, await response.json(), userId); })
      .catch(() => { if (!abort.signal.aborted && currentUserId.current === userId) setError("Your profile could not be loaded. Please retry."); });
    return () => abort.abort();
  }, [supabase, userId, pathname, acceptProfile]);

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;
    const startingRevision = authRevision.current;

    void (async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (!isMounted || authRevision.current !== startingRevision) {
        return;
      }

      if (userError || !userData?.user) {
        setSession(null);
        setLoading(false);
        return;
      }

      const { data, error: sessionError } = await supabase.auth.getSession();

      if (!isMounted || authRevision.current !== startingRevision) {
        return;
      }

      if (data.session?.user?.id !== userData.user.id) {
        setError("Your session changed while it was being restored. Please sign in again.");
        currentUserId.current = undefined;
        setSession(null);
        setLoading(false);
        return;
      }

      if (sessionError) {
        console.warn("[auth:provider] session restore failed", {
          message: sessionError.message,
        });
        setError(sessionError.message);
      }

      console.info("[auth:provider] session restored", {
        hasSession: Boolean(data.session),
        userId: userData.user.id,
      });
      setSession(data.session ?? null);
      setLoading(false);
    })();

    const { data } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: Session | null) => {
      if (!isMounted) {
        return;
      }

      authRevision.current += 1;
      currentUserId.current = nextSession?.user?.id;
      console.info("[auth:provider] auth state changed", {
        hasSession: Boolean(nextSession),
        userId: nextSession?.user?.id,
      });
      setSession(nextSession);
      setError(null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !session?.user) return;

    if (!profile || profile.id !== session.user.id) return;
    const ignored = pathname === "/onboarding" || pathname === "/" || pathname.startsWith("/auth/") || pathname === "/welcome";
    if (!ignored && !profile.onboardingCompleted) {
      const skipped = window.sessionStorage?.getItem("onboarding_skipped") === "true";
      if (!skipped) router.push("/welcome");
    }
  }, [session, pathname, supabase, router, profile]);

  const value = {
    user: session?.user ?? null,
    session,
    loading,
    ready: Boolean(supabase),
    error,
    profile: profile?.id === session?.user?.id ? profile : null,
    refreshProfile,
    signIn: async ({ email, password }: AuthCredentials) => {
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      setError(null);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }
    },
    signUp: async ({ 
      email, 
      password, 
      fullName, 
      firstName, 
      lastName, 
      referralCode, 
      institutionInviteCode, 
      acceptedTos, 
      acceptedPrivacy 
    }: SignUpCredentials) => {
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      setError(null);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName || undefined,
            last_name: lastName || undefined,
            full_name: fullName || `${firstName || ""} ${lastName || ""}`.trim() || undefined,
            referral_code_used: referralCode || undefined,
            institution_invite_code_used: institutionInviteCode || undefined,
            tos_accepted_at: acceptedTos ? new Date().toISOString() : undefined,
            privacy_accepted_at: acceptedPrivacy ? new Date().toISOString() : undefined,
          },
          emailRedirectTo: `${getAppUrl()}/auth/callback`,
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      return {
        needsEmailConfirmation: !data.session,
      };
    },
    signOut: async () => {
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      if (!await confirmUnsavedWorkBeforeSignOut()) throw new Error("Sign-out cancelled. Your notes are still open.");
      setError(null);
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        throw signOutError;
      }

      currentUserId.current = undefined;
      setSession(null);
    },
    signInWithProvider: async (provider: string, redirectTo?: string) => {
      if (provider !== "google") throw new Error("Choose a supported sign-in provider.");
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      setError(null);

      const builtRedirectTo = buildOAuthRedirectUrl(redirectTo ?? "/chat");
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: builtRedirectTo },
      });

      if (oauthError) {
        throw oauthError;
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
