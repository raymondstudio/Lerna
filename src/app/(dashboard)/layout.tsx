import { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { requireUser } from "@/lib/auth/require-user";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // We can require user here so it protects all dashboard routes!
  await requireUser("/chat"); // Default redirect back to /chat, or just /

  return (
    <DashboardShell>
      {children}
    </DashboardShell>
  );
}
