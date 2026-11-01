"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Copy,
  Check,
  MessageCircle,
  CreditCard,
  Zap,
  Star,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Shield,
  Receipt,
  Sparkles,
} from "lucide-react";

type Plan = "pro" | "premium";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlan?: Plan;
}

const PLANS = {
  pro: {
    name: "Pro",
    price: "₦5,200",
    period: "/month",
    color: "cyan",
    icon: Zap,
    features: [
      "Faster AI response times",
      "More document uploads",
      "Voice tutoring",
      "Priority processing",
      "Larger AI quota",
    ],
  },
  premium: {
    name: "Premium",
    price: "₦9,900",
    period: "/month",
    color: "purple",
    icon: Star,
    features: [
      "Highest AI quota",
      "Priority realtime sync",
      "Advanced analytics",
      "Premium support",
    ],
  },
} as const;

const ACCOUNT_NUMBER = "7064019926";
const BANK_NAME = "Moniepoint MFB";
const WHATSAPP_NUMBER = "+2348031611333";

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white active:scale-95"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-cyan-400 font-medium">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          <span>{label ?? "Copy"}</span>
        </>
      )}
    </button>
  );
}

export function PaymentModal({ isOpen, onClose, defaultPlan = "pro" }: PaymentModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<Plan>(defaultPlan);
  const [step, setStep] = useState<1 | 2>(1);

  // Sync plan when prop changes
  useEffect(() => {
    setSelectedPlan(defaultPlan);
  }, [defaultPlan]);

  // Reset step on open
  useEffect(() => {
    if (isOpen) setStep(1);
  }, [isOpen]);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const plan = PLANS[selectedPlan];
  const waMessage = encodeURIComponent(
    `Hi! I just made a transfer for Lerna AI ${plan.name} (${plan.price}/mo). Here is my payment receipt screenshot.`
  );
  const waLink = `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, "")}?text=${waMessage}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="payment-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Container */}
          <motion.div
            key="payment-modal"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0f1117] shadow-2xl shadow-black/70">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/8 bg-[#13151c] px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">Upgrade to {plan.name}</h2>
                    <p className="text-[11px] text-slate-400">
                      Step {step} of 2: {step === 1 ? "Make Bank Transfer" : "Verify & Activate"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Step dots */}
                  <div className="flex items-center gap-1.5 mr-2">
                    <span
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        step === 1 ? "w-5 bg-cyan-400" : "w-1.5 bg-cyan-400/50"
                      }`}
                    />
                    <span
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        step === 2 ? "w-5 bg-cyan-400" : "w-1.5 bg-white/20"
                      }`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Step Content */}
              <div className="p-5">
                <AnimatePresence mode="wait">
                  {step === 1 ? (
                    <motion.div
                      key="step-1"
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-4"
                    >
                      {/* Plan Toggle */}
                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/5 p-1 border border-white/5">
                        {(["pro", "premium"] as Plan[]).map((p) => {
                          const isSelected = selectedPlan === p;
                          const pl = PLANS[p];
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setSelectedPlan(p)}
                              className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                                isSelected
                                  ? p === "pro"
                                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                                    : "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                                  : "text-slate-400 hover:text-white hover:bg-white/5"
                              }`}
                            >
                              <span className="font-semibold">{pl.name}</span>
                              <span className="font-mono font-bold">{pl.price}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Bank Details Card */}
                      <div className="rounded-xl border border-white/10 bg-[#14151a] p-4 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Bank Transfer Details
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                            <Image
                              src="/logos/m-logo.jpeg"
                              alt="Moniepoint"
                              width={14}
                              height={14}
                              className="rounded-full object-cover"
                            />
                            Moniepoint MFB
                          </span>
                        </div>

                        {/* Amount */}
                        <div className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3.5 py-2.5">
                          <div>
                            <p className="text-[10px] text-cyan-400/80 font-medium uppercase tracking-wider">
                              Amount to pay
                            </p>
                            <p className="text-xl font-extrabold tracking-tight text-cyan-300">
                              {plan.price}
                            </p>
                          </div>
                          <CopyButton
                            text={plan.price.replace("₦", "").replace(",", "")}
                            label="Copy"
                          />
                        </div>

                        {/* Account Number */}
                        <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3.5 py-2.5">
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                              Account Number
                            </p>
                            <p className="font-mono text-base font-bold tracking-wider text-white">
                              {ACCOUNT_NUMBER}
                            </p>
                          </div>
                          <CopyButton text={ACCOUNT_NUMBER} label="Copy" />
                        </div>

                        {/* Bank Name */}
                        <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3.5 py-2.5">
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Bank</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="h-5 w-5 rounded-md overflow-hidden relative shrink-0 border border-white/10">
                                <Image
                                  src="/logos/m-logo.jpeg"
                                  alt="Moniepoint"
                                  width={20}
                                  height={20}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <p className="text-sm font-semibold text-white">{BANK_NAME}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Reminder Notice */}
                      <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300/90">
                        <Receipt className="h-4 w-4 shrink-0 text-amber-400" />
                        <span>Please save a screenshot of your transfer receipt before continuing.</span>
                      </div>

                      {/* Step 1 Action */}
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-400 active:scale-[0.98]"
                      >
                        I have made the transfer
                        <ArrowRight className="h-4 w-4" />
                      </button>

                      {/* Trust info */}
                      <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Shield className="h-3 w-3" /> Secure payment
                        </span>
                        <span className="h-2.5 w-px bg-white/10" />
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Fast verification
                        </span>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="step-2"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-4"
                    >
                      {/* Almost Done Badge */}
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <h3 className="text-sm font-bold text-white">Almost there!</h3>
                        <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                          Send your payment screenshot to our official WhatsApp line to activate your{" "}
                          <span className="font-semibold text-cyan-400">{plan.name}</span> membership.
                        </p>
                      </div>

                      {/* WhatsApp Details */}
                      <div className="rounded-xl border border-white/10 bg-[#14151a] p-4 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Send Receipt To
                          </span>
                          <span className="inline-flex items-center gap-1 rounded bg-[#25D366]/15 px-2 py-0.5 text-[10px] font-semibold text-[#25D366]">
                            <MessageCircle className="h-3 w-3" /> WhatsApp
                          </span>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3.5 py-2.5">
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Number</p>
                            <p className="font-mono text-sm font-bold text-white">{WHATSAPP_NUMBER}</p>
                          </div>
                          <CopyButton text={WHATSAPP_NUMBER} label="Copy" />
                        </div>

                        <ul className="space-y-1.5 text-[11px] text-slate-400 pt-1">
                          <li className="flex items-start gap-1.5">
                            <span className="text-cyan-400 font-bold">•</span>
                            <span>Attach your transfer receipt or transaction screenshot</span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="text-cyan-400 font-bold">•</span>
                            <span>Include your registered Lerna email address</span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="text-cyan-400 font-bold">•</span>
                            <span>Your account will be upgraded immediately upon review</span>
                          </li>
                        </ul>
                      </div>

                      {/* Main Action: WhatsApp */}
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-bold text-slate-950 shadow-lg shadow-[#25D366]/20 transition-all hover:bg-[#20bc5a] active:scale-[0.98]"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Open WhatsApp to Send Receipt
                      </a>

                      {/* Back button */}
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors py-1"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to transfer details
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
