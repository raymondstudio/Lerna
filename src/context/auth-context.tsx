"use client";

import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export type AuthCredentials = {
  email: string;
  password: string;
};

export type SignUpCredentials = AuthCredentials & {
  fullName?: string;
};

export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  ready: boolean;
  error: string | null;
  signIn: (credentials: AuthCredentials) => Promise<void>;
  signUp: (credentials: SignUpCredentials) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  signInWithProvider?: (provider: string, redirectTo?: string) => Promise<void>;
  profile: any | null;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
