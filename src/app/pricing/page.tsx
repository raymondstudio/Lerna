"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Zap,
  Star,
  Shield,
} from "lucide-react";
import { PaymentModal } from "@/components/payments/PaymentModal";

type Plan = "pro" | "premium";

const plans = [
  {
    id: "free" as const,
    name: "Free",
    price: "₦0",
    period: "",
    description: "Start learning with no commitment.",
    features: [
      "Unlimited sign up",
      "Limited AI usage",
      "Upload documents",
      "Persistent chat history",
    ],
    cta: "Get started free",
    highlight: false,
    isPaid: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "₦5,200",
    period: "/month",
    description: "The ultimate learning accelerator.",
    features: [
      "Faster AI response times",
      "More document uploads",
      "Voice tutoring",
      "Priority processing",
      "Larger AI quota",
    ],
    cta: "Upgrade to Pro",
    highlight: true,
    isPaid: true,
  },
  {
    id: "premium" as const,
    name: "Premium",
    price: "₦9,900",
    period: "/month",
    description: "For power users and heavy workloads.",
    features: [
      "Highest AI quota",
      "Priority realtime sync",
      "Advanced analytics",
      "Premium support",
    ],
    cta: "Upgrade to Premium",
    highlight: false,
    isPaid: true,
  },
];

function PricingContent() {
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("pro");

  // Auto-open modal if ?upgrade=true or ?plan=pro/premium
  useEffect(() => {
    const upgrade = searchParams.get("upgrade");
    const plan = searchParams.get("plan") as Plan | null;
    if (upgrade === "true" || plan === "pro" || plan === "premium") {
      setSelectedPlan(plan === "premium" ? "premium" : "pro");
      setModalOpen(true);
    }
  }, [searchParams]);

  const handleUpgradeClick = (planId: Plan) => {
    setSelectedPlan(planId);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200 font-body">
      {/* Nav */}
      <nav className="border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <Image
            src="/assets/lerna-full-white.png"
            alt="Lerna"
            width={100}
            height={28}
            style={{ width: "auto", height: "auto" }}
            className="h-8 object-contain"
          />
          <Link
            href="/chat"
            className="rounded-full bg-white text-[#0a0a0a] hover:bg-slate-100 px-4 h-8 text-xs font-semibold transition-all flex items-center"
          >
            Open app
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative py-20 sm:py-28 px-5 text-center overflow-hidden">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[350px] w-[600px] rounded-full bg-cyan-500/6 blur-[100px]" />
        <div className="relative z-10 mx-auto max-w-2xl">
          <span className="mb-4 inline-block rounded-full border border-cyan-500/20 bg-cyan-500/8 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-cyan-400">
            Pricing
          </span>
          <h1 className="font-heading text-4xl sm:text-5xl font-normal tracking-tight text-white leading-[1.1] mb-5">
            Simple, transparent pricing
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed max-w-lg mx-auto">
            Start for free. Upgrade when you&apos;re ready to unlock the full power of your AI tutor.
          </p>
        </div>
      </section>

      {/* Plans grid */}
      <section className="pb-24 px-5">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-5 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-7 transition-all ${
                  plan.highlight
                    ? "border-cyan-500/40 bg-[#0d1a1f] shadow-[0_0_40px_rgba(6,182,212,0.1)]"
                    : "border-white/8 bg-[#111317]"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2 rounded-b-xl bg-cyan-500 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-[#0a0a0a]">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  {/* Icon */}
                  <div
                    className={`mb-4 flex h-9 w-9 items-center justify-center rounded-xl ${
                      plan.id === "pro"
                        ? "bg-cyan-500/15"
                        : plan.id === "premium"
                        ? "bg-purple-500/15"
                        : "bg-white/8"
                    }`}
                  >
                    {plan.id === "pro" ? (
                      <Zap className="h-4 w-4 text-cyan-400" />
                    ) : plan.id === "premium" ? (
                      <Star className="h-4 w-4 text-purple-400" />
                    ) : (
                      <Shield className="h-4 w-4 text-slate-400" />
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                  <p className="text-sm text-slate-400 mb-5">{plan.description}</p>

                  <div className="flex items-baseline gap-1 mb-6">
                    <span
                      className={`text-3xl font-bold tracking-tight ${
                        plan.id === "pro"
                          ? "text-cyan-400"
                          : plan.id === "premium"
                          ? "text-purple-400"
                          : "text-white"
                      }`}
                    >
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-sm text-slate-500">{plan.period}</span>
                    )}
                  </div>

                  <ul className="space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                        <CheckCircle2
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            plan.id === "pro"
                              ? "text-cyan-400"
                              : plan.id === "premium"
                              ? "text-purple-400"
                              : "text-slate-500"
                          }`}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto pt-5">
                  {plan.isPaid ? (
                    <button
                      type="button"
                      onClick={() => handleUpgradeClick(plan.id as Plan)}
                      className={`w-full rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98] ${
                        plan.id === "pro"
                          ? "bg-cyan-500 text-[#0a0a0a] hover:bg-cyan-400 shadow-lg shadow-cyan-500/20"
                          : "bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-500/15"
                      }`}
                    >
                      {plan.cta}
                    </button>
                  ) : (
                    <Link
                      href="/chat"
                      className="flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-slate-300 transition-all hover:border-white/20 hover:bg-white/8 hover:text-white"
                    >
                      {plan.cta}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Trust note */}
          <div className="mt-10 flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-slate-500">
              No automated billing. Manual bank transfer required. Upgrade activates within 24 hours after payment confirmation.
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-600 mt-1">
              <span className="flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                Secure transfer
              </span>
              <span className="h-3 w-px bg-white/10" />
              <span className="flex items-center gap-1.5">
                <Image
                  src="/logos/m-logo.jpeg"
                  alt="Moniepoint"
                  width={14}
                  height={14}
                  className="rounded-full object-cover"
                />
                Moniepoint MFB
              </span>
              <span className="h-3 w-px bg-white/10" />
              <span>WhatsApp verified</span>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultPlan={selectedPlan}
      />
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <PricingContent />
    </Suspense>
  );
}
