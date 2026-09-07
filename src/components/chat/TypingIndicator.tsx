"use client";

import { motion } from "framer-motion";
import { Brain } from "lucide-react";

export function TypingIndicator() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      transition={{ duration: 0.25 }}
      className="flex w-full gap-4 group px-2 sm:px-0"
    >
      <div className="flex-shrink-0 flex flex-col items-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)]">
          <Brain className="h-5 w-5" />
        </div>
      </div>
      
      <div className="flex-1 min-w-0 pt-1">
        <div className="font-semibold text-slate-400 text-sm mb-1">
          Lerna
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/[0.04] px-4 py-3 flex items-center gap-1.5 w-fit">
          <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
          <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
          <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-bounce"></span>
        </div>
      </div>
    </motion.div>
  );
}
