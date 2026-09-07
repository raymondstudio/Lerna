import type { ReactNode } from "react";

export const metadata = {
  title: "Admin Dashboard | Lerna AI",
  description: "Internal control panel and analytics layer for Lerna AI.",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen w-full bg-[#0a0a0a] text-slate-200 overflow-hidden font-body">
      {children}
    </div>
  );
}
