"use client";

import { ThemeProvider } from "next-themes";
import { type ReactNode, Suspense, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "@/providers/auth-provider";
import { DashboardProvider } from "@/context/dashboard-context";
import { AnalyticsTracker } from "@/components/analytics/AnalyticsTracker";

export function Providers({ children, initialSession }: { children: ReactNode; initialSession?: Session | null }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        <AuthProvider initialSession={initialSession}>
          <Suspense fallback={null}>
            <AnalyticsTracker />
          </Suspense>
          <DashboardProvider>{children}</DashboardProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
