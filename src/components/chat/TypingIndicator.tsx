"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const THINKING_STAGES = [
  "Thinking…",
  "Analyzing context…",
  "Synthesizing response…",
  "Formulating explanation…",
];

export function TypingIndicator() {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % THINKING_STAGES.length);
    }, 2400);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="flex w-full flex-col items-start my-2.5"
    >
      <div className="flex items-center gap-2.5 py-1 text-slate-400 select-none">
        {/* Subtle pulsing indicator */}
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-50" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
        </span>

        {/* Thought state text */}
        <div className="h-5 flex items-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.span
              key={stageIndex}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="italic text-slate-400 font-normal text-sm md:text-[15px] tracking-wide"
            >
              {THINKING_STAGES[stageIndex]}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
