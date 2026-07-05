"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";

import { AuthContext, type AuthCredentials, type SignUpCredentials } from "@/context/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildOAuthRedirectUrl } from "@/lib/auth/oauth";

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
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      if (!profileError && data) {
        setProfile(data);
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
          .select("onboarding_completed, is_suspended")
          .eq("id", session.user.id)
          .single();

        if (active && prof) {
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
            pathname.startsWith("/auth/");

          if (!isIgnoredRoute && !prof.onboarding_completed) {
            console.info("[auth:provider] onboarding incomplete, redirecting to wizard");
            router.push("/onboarding");
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
    signUp: async ({ email, password, fullName }: SignUpCredentials) => {
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      setError(null);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: fullName ? { full_name: fullName } : undefined,
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

      const options: any = {
        redirectTo: buildOAuthRedirectUrl(redirectTo ?? "/chat"),
      };

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options,
      });

      if (oauthError) {
        throw oauthError;
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
