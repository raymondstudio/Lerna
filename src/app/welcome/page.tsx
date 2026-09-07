"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Clock } from "lucide-react";
import { motion } from "framer-motion";

export default function WelcomePage() {
  const router = useRouter();
  const { user, loading, profile } = useAuth();

  useEffect(() => {
    // If not loading and no user session exists, send to home page
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <LoaderSpinner />
          <p className="text-xs text-slate-500 font-semibold tracking-wider uppercase animate-pulse">
            Loading your workspace...
          </p>
        </div>
      </div>
    );
  }

  function handleCompleteLater() {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.setItem("onboarding_skipped", "true");
    }
    router.push("/chat");
    router.refresh();
  }

  function handlePersonalizeNow() {
    router.push("/onboarding");
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Decorative ambient glowing backdrops */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[10000ms]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative max-w-md w-full bg-[#111318]/60 border border-white/5 backdrop-blur-2xl rounded-3xl p-8 text-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-8"
      >
        {/* Animated Accent Sparkle Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-blue-500/20 text-cyan-400 border border-cyan-400/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] relative">
          <Sparkles className="h-8 w-8 animate-pulse text-cyan-300" />
          <div className="absolute inset-0 rounded-2xl border border-white/10 animate-ping opacity-25 pointer-events-none" />
        </div>

        {/* Text Details */}
        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold text-white tracking-tight font-heading leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-slate-400">
            Welcome to Lerna AI
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            We'll personalize your AI tutor in less than one minute.
          </p>
        </div>

        {/* Dynamic Buttons */}
        <div className="flex flex-col gap-3 pt-2">
          <Button 
            onClick={handlePersonalizeNow} 
            className="w-full h-12 bg-white text-slate-950 font-bold hover:bg-slate-200 rounded-xl transition-all duration-200 transform hover:scale-[1.01] flex items-center justify-center gap-2 group shadow-md"
          >
            Personalize Now
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Button>
          <Button 
            onClick={handleCompleteLater} 
            variant="ghost" 
            className="w-full h-12 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Clock className="h-4 w-4 text-slate-500" />
            Complete Later
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function LoaderSpinner() {
  return (
    <div className="relative flex items-center justify-center h-10 w-10">
      <div className="absolute h-full w-full rounded-full border-4 border-slate-800" />
      <div className="absolute h-full w-full rounded-full border-4 border-cyan-500 border-t-transparent animate-spin" />
    </div>
  );
}
