import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center h-full bg-[#0a0a0a]">
      <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
    </div>
  );
}
