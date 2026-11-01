"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDashboard } from "@/context/dashboard-context";
import { Loader2 } from "lucide-react";

export default function AccountRedirectPage() {
  const router = useRouter();
  const { openSettings } = useDashboard();

  useEffect(() => {
    openSettings("account");
    router.replace("/chat?settings=open");
  }, [openSettings, router]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0d0f12]">
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
        Opening settings…
      </div>
    </div>
  );
}
