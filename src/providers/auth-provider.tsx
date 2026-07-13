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
      const { data: rawProfile, error: profileError } = await supabase
        .from("profiles")
        .select(`
          *,
          user_preferences(*),
          notification_preferences(*),
          subscriptions(plan, status),
          user_roles(role)
        `)
        .eq("id", session.user.id)
        .single();

      if (!profileError && rawProfile) {
        const pref = Array.isArray(rawProfile.user_preferences) 
          ? rawProfile.user_preferences[0] 
          : rawProfile.user_preferences;

        const notif = Array.isArray(rawProfile.notification_preferences) 
          ? rawProfile.notification_preferences[0] 
          : rawProfile.notification_preferences;

        const sub = Array.isArray(rawProfile.subscriptions) 
          ? rawProfile.subscriptions[0] 
          : rawProfile.subscriptions;

        const r = Array.isArray(rawProfile.user_roles) 
          ? rawProfile.user_roles[0] 
          : rawProfile.user_roles;

        // Flatten database fields into flat profile object for backward-compatible UI consumption
        const flatProfile = {
          ...rawProfile,
          
          // User preferences mapping
          teaching_style: pref?.teaching_style || "Intermediate",
          difficulty: pref?.difficulty || "Medium",
          preferred_language: pref?.preferred_language || "English",
          preferred_quiz_format: pref?.preferred_quiz_format || "Mixed",
          flashcard_preference: pref?.flashcard_preference || "Standard",
          response_length: pref?.response_length || "Medium",
          voice_preference: pref?.voice_preference || "Default",
          study_goals: pref?.learning_goals || [],

          // Notification preferences mapping
          marketing_updates_enabled: notif?.marketing ?? true,
          security_alerts_enabled: notif?.security_alerts ?? true,
          study_reminder_enabled: notif?.study_reminders ?? true,
          product_updates_enabled: notif?.product_updates ?? true,
          announcements_enabled: notif?.announcements ?? true,

          // Subscription details
          plan: sub?.plan || "free",
          subscriptionStatus: sub?.status || "active",

          // Role
          role: r?.role || "user",
        };

        setProfile(flatProfile);
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
