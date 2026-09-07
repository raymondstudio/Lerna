import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  description,
  children,
}: Readonly<{
  title: string;
  description: string;
  children: ReactNode;
}>) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden border-r border-white/10 bg-slate-950 px-8 py-10 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.18),transparent_25%)]" />
        <div className="relative z-10">
          <Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">Lerna AI</Badge>
          <h1 className="mt-6 max-w-xl font-heading text-5xl font-semibold tracking-tight text-white text-balance">
            Premium tutoring infrastructure for the next generation of learners.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            Adaptive tutoring, RAG-powered document learning, generated notes, quizzes, and voice tutoring in one system.
          </p>
        </div>
        <div className="relative z-10 grid gap-3 text-sm text-slate-300">
          <p>Built for scalable AI workflows.</p>
          <p>Designed for premium UX from day one.</p>
          <p>Ready for Gemini, ElasticSearch, and Supabase.</p>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
        <Card className="w-full max-w-xl border-white/10 bg-white/[0.04] shadow-2xl shadow-slate-950/50">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-8">
              <p className="text-sm uppercase tracking-[0.28em] text-cyan-300">Lerna AI</p>
              <h2 className="mt-3 font-heading text-3xl font-semibold text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
            </div>
            {children}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
