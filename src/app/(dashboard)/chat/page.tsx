import { Suspense } from "react";
import nextDynamic from "next/dynamic";

import { requireUser } from "@/lib/auth/require-user";
import { Loader2 } from "lucide-react";

const StudyWorkspace = nextDynamic(() => import("@/components/chat/StudyWorkspace").then(m => m.StudyWorkspace), {
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
      <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
    </div>
  )
});

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  await requireUser("/chat");

  return (
    
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      }>
        <StudyWorkspace />
      </Suspense>
    
  );
}
