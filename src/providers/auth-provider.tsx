"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";

import { AuthContext, type AuthCredentials, type SignUpCredentials } from "@/context/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAppUrl } from "@/lib/supabase/config";
import { buildOAuthRedirectUrl } from "@/lib/auth/oauth";
import { normalizeProfile } from "@/lib/profile";

export function AuthProvider({ children, initialSession }: { children: ReactNode; initialSession?: Session | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(initialSession ?? null);
  const [loading, setLoading] = useState(!initialSession);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);

  const refreshProfile = async () => {
    if (!supabase || !session?.user) {
      setProfile(null);
      return;
    }
    try {
      const [profileResult, subscriptionResult, roleResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).single(),
        supabase.from("subscriptions").select("plan, status, billing_cycle, subscription_status").eq("user_id", session.user.id).single(),
        supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle(),
      ]);

      const flatProfile = normalizeProfile(profileResult.data, subscriptionResult.data, roleResult.data);

      if (flatProfile) {
        setProfile(flatProfile as any);
      }
    } catch (err) {
      console.warn("[auth:provider] Failed to fetch profile:", err);
    }
  };

  useEffect(() => {
    void refreshProfile();
  }, [session, supabase]);

  useEffect(() => {
    if (!supabase) {
      setError("Supabase is not configured. Set the public Supabase env vars to enable authentication.");
      setLoading(false);
      return;
    }

    let isMounted = true;

    void (async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (!isMounted) {
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
        userId: data.session?.user?.id,
      });
      setSession(data.session ?? null);
      setLoading(false);
    })();

    const { data } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: Session | null) => {
      if (!isMounted) {
        return;
      }

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

    let active = true;
    void (async () => {
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("onboarding_completed, is_suspended, is_deleted")
          .eq("id", session.user.id)
          .single();

        if (active && prof) {
          if (prof.is_deleted) {
            console.warn("[auth:provider] user account is soft-deleted, logging out");
            await supabase.auth.signOut();
            setSession(null);
            setProfile(null);
            router.push("/?auth=login&error=This account has been deleted.");
            return;
          }

          if (prof.is_suspended) {
            console.warn("[auth:provider] user is suspended, logging out");
            await supabase.auth.signOut();
            setSession(null);
            setProfile(null);
            router.push("/?auth=login&error=Your account has been suspended by an administrator.");
            return;
          }

          const isIgnoredRoute = 
            pathname === "/onboarding" || 
            pathname === "/" || 
            pathname.startsWith("/auth/") ||
            pathname === "/welcome";

          if (!isIgnoredRoute && !prof.onboarding_completed) {
            const skipped = typeof window !== "undefined" && window.sessionStorage?.getItem("onboarding_skipped") === "true";
            if (!skipped) {
              console.info("[auth:provider] onboarding incomplete, redirecting to welcome screen");
              router.push("/welcome");
            }
          }
        }
      } catch (err) {
        console.warn("[auth:provider] failed to verify onboarding completion:", err);
      }
    })();

    return () => {
      active = false;
    };
  }, [session, pathname, supabase, router]);

  const value = {
    user: session?.user ?? null,
    session,
    loading,
    ready: Boolean(supabase),
    error,
    profile,
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

      setError(null);

      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        throw signOutError;
      }

      setSession(null);
    },
    signInWithProvider: async (provider: string, redirectTo?: string) => {
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      setError(null);

      let builtRedirectTo: string;
      try {
        builtRedirectTo = buildOAuthRedirectUrl(redirectTo ?? "/chat");
      } catch (urlError) {
        console.error("[auth:provider] buildOAuthRedirectUrl FAILED", { urlError });
        throw urlError;
      }

      console.info("[auth:provider] signInWithOAuth starting", {
        provider,
        redirectTo: builtRedirectTo,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(not set)",
        hasAnonKey: Boolean(
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ),
      });

      const { data: oauthData, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: { redirectTo: builtRedirectTo },
      });

      console.info("[auth:provider] signInWithOAuth response", {
        hasUrl: Boolean(oauthData?.url),
        oauthUrl: oauthData?.url ?? "(no URL returned — CRITICAL)",
        errorMessage: oauthError?.message ?? null,
        errorStatus: (oauthError as any)?.status ?? null,
        errorName: oauthError?.name ?? null,
      });

      if (oauthError) {
        throw oauthError;
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
