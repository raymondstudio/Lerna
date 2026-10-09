"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  FileText,
  Mic,
  ShieldCheck,
  UploadCloud,
  Menu,
  X,
  Calendar,
  Layers,
  HelpCircle,
  PenTool,
  History,
  Sparkles,
  Star,
  ChevronDown,
  Users,
  ThumbsUp,
  MessageSquare,
  Zap,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";
import { ForgotPasswordModal } from "@/components/auth/forgot-password-modal";
import { ResetPasswordModal } from "@/components/auth/reset-password-modal";

// ── Static motion shims (no framer dependency) ─────────────────────────────
type StaticMotionProps = React.HTMLAttributes<HTMLDivElement> & {
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
  whileInView?: unknown;
  viewport?: unknown;
  whileHover?: unknown;
};

function StaticMotionDiv({
  children,
  initial,
  animate,
  exit,
  transition,
  whileInView,
  viewport,
  whileHover,
  ...props
}: StaticMotionProps) {
  return <div {...props}>{children}</div>;
}

function StaticMotionNav({
  children,
  initial,
  animate,
  exit,
  transition,
  whileInView,
  viewport,
  whileHover,
  ...props
}: StaticMotionProps) {
  return <nav {...props}>{children}</nav>;
}

const motion = { div: StaticMotionDiv, nav: StaticMotionNav };

function AnimatePresence({ children }: { children: ReactNode; initial?: boolean }) {
  return <>{children}</>;
}

// ── Data ───────────────────────────────────────────────────────────────────
const features = [
  {
    icon: Brain,
    title: "AI Tutor",
    description: "Get clear, step-by-step explanations tailored to your subject, speed, and learning style.",
  },
  {
    icon: UploadCloud,
    title: "Upload Lecture Notes",
    description: "Convert dense lecture slides, recordings, and outlines into structured lessons instantly.",
  },
  {
    icon: FileText,
    title: "AI Document Analysis",
    description: "Parse, extract, and synthesize complex PDFs, articles, and book chapters without cognitive overload.",
  },
  {
    icon: Calendar,
    title: "Personalized Study Plans",
    description: "Set study targets and generate structured timelines to map out exams, courses, and tasks.",
  },
  {
    icon: Layers,
    title: "Flashcards",
    description: "Auto-generate interactive revision decks and review concepts with spaced repetition.",
  },
  {
    icon: HelpCircle,
    title: "Quiz Generator",
    description: "Challenge your comprehension with custom multiple-choice, short-answer, and mock exams.",
  },
  {
    icon: PenTool,
    title: "Essay Practice",
    description: "Draft essays with instant styling feedback, thesis checks, and structural revisions.",
  },
  {
    icon: History,
    title: "Persistent Study Sessions",
    description: "Never lose your spot. Your conversations, document history, and notes stay synced and open.",
  },
  {
    icon: Mic,
    title: "Voice Learning",
    description: "Engage in natural, audio-based study dialogues. Talk to your tutor and listen on the go.",
    isComingSoon: true,
  },
];

const steps = [
  {
    number: "01",
    title: "Upload study materials",
    description:
      "Drag and drop your lecture slides, class notes, research PDFs, or outlines into your personal workspace.",
  },
  {
    number: "02",
    title: "Ask questions & interact",
    description:
      "Let your AI tutor guide you through difficult concepts, explain diagrams, or break down formulas step-by-step.",
  },
  {
    number: "03",
    title: "Master your courses",
    description:
      "Generate customized practice exams, revision flashcards, and personalized study schedules to master any exam.",
  },
];

const pricingPlans = [
  {
    name: "Free",
    price: "₦0",
    description: "Perfect for trying out Lerna AI.",
    features: [
      "Unlimited sign up",
      "Limited AI usage",
      "Upload documents",
      "Persistent chat history",
    ],
    buttonText: "Get Started for Free",
    isComingSoon: false,
  },
  {
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
    buttonText: "Coming Soon",
    isComingSoon: true,
  },
  {
    name: "Premium",
    price: "₦9,900",
    period: "/month",
    description: "Best for power users, teams, and heavy study workloads.",
    features: [
      "Highest AI quota",
      "Priority realtime sync",
      "Advanced analytics",
      "Premium support",
    ],
    buttonText: "Coming Soon",
    isComingSoon: true,
  },
];

const testimonials = [
  {
    quote:
      "Lerna completely changed how I study for midterms. I uploaded 50 pages of biology slides and it explained the Krebs cycle better than my textbook.",
    name: "Sarah L.",
    role: "Pre-Med Student",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=SarahL&backgroundColor=b5ead7&skinColor=brown",
    rating: 5,
  },
  {
    quote:
      "The interactive quiz generator is incredible. Instead of passively reading, I can test myself on the exact material our instructor covered in class.",
    name: "Alex M.",
    role: "Computer Science Junior",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=AlexM&backgroundColor=ffd6a5&skinColor=darkBrown",
    rating: 5,
  },
  {
    quote:
      "Having my study sessions persist across devices means I can start on my laptop and continue reading on my phone on the train. A lifesaver.",
    name: "David K.",
    role: "Law Student",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=DavidK&backgroundColor=c1e1c1&skinColor=brown",
    rating: 5,
  },
  {
    quote:
      "I used to reread the same lecture notes without knowing what I actually remembered. Lerna turns them into focused questions that make revision much more active.",
    name: "Maya T.",
    role: "Psychology Student",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=MayaT&backgroundColor=fde2e4&skinColor=brown",
    rating: 5,
  },
  {
    quote:
      "The study plans gave me structure when I was juggling three deadlines. I can see what to review next instead of wasting time deciding where to begin.",
    name: "Jordan P.",
    role: "Engineering Student",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=JordanP&backgroundColor=d4e6f1&skinColor=darkBrown",
    rating: 5,
  },
  {
    quote:
      "Being able to ask follow-up questions about my own uploaded materials is the difference. It feels like having a patient study partner available whenever I need one.",
    name: "Nia O.",
    role: "Graduate Student",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=NiaO&backgroundColor=e8d5b7&skinColor=darkBrown",
    rating: 5,
  },
];

const faqs = [
  {
    question: "Is it free?",
    answer:
      "Yes! Lerna AI offers a robust Free plan that lets you sign up, upload study materials, chat with your AI tutor, and access persistent session history.",
  },
  {
    question: "What file types are supported?",
    answer:
      "We support PDF documents, Word files (.docx), and raw text files. We parse and index your course material so you can query it immediately.",
  },
  {
    question: "Can it remember my learning progress?",
    answer:
      "Absolutely. Every study session you start is fully persistent. You can close the tab or switch from desktop to mobile and resume tutoring from the exact same point.",
  },
  {
    question: "Can it generate quizzes?",
    answer:
      "Yes, you can generate customized quizzes with multiple-choice or short-answer formats directly from your uploaded lectures or chat context.",
  },
  {
    question: "Is my data secure?",
    answer:
      "We take your privacy seriously. Your uploaded materials and chat logs are fully encrypted in transit and at rest, and we never share your data or use it to train public models.",
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-white/8 last:border-b-0 py-5 sm:py-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left focus:outline-none group"
      >
        <span className="text-base sm:text-lg font-medium text-white group-hover:text-blue-400 transition-colors pr-4">
          {question}
        </span>
        <div
          className="text-slate-400 group-hover:text-white transition-all ml-4 shrink-0"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
        >
          <ChevronDown className="h-5 w-5" />
        </div>
      </button>
      {isOpen && (
        <p className="mt-4 text-sm sm:text-base text-slate-400 leading-relaxed">
          {answer}
        </p>
      )}
    </div>
  );
}

function TestimonialCard({ testimonial }: { testimonial: (typeof testimonials)[number] }) {
  return (
    <article className="rounded-2xl border border-white/8 bg-[#111827] p-6 transition-colors">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            role="img"
            aria-label={`${testimonial.name} avatar`}
            className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5 bg-cover bg-center"
            style={{ backgroundImage: `url(${testimonial.avatar})` }}
          />
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-white">{testimonial.name}</h4>
            <p className="mt-0.5 truncate text-xs text-slate-500">{testimonial.role}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5 text-blue-400" aria-label={`${testimonial.rating} out of 5 stars`}>
          {[...Array(testimonial.rating)].map((_, index) => (
            <Star key={index} className="h-3.5 w-3.5 fill-current" />
          ))}
        </div>
      </div>
      <p className="text-sm leading-relaxed text-slate-300 italic">&ldquo;{testimonial.quote}&rdquo;</p>
    </article>
  );
}

function TestimonialMarqueeColumn({
  items,
  reverse = false,
}: {
  items: typeof testimonials;
  reverse?: boolean;
}) {
  const marqueeItems = [...items, ...items];
  return (
    <div className="min-w-0 flex-1 overflow-hidden">
      <div className={`flex flex-col ${reverse ? "animate-marquee-down" : "animate-marquee-up"}`}>
        <div className="flex shrink-0 flex-col gap-5 pb-5">
          {marqueeItems.map((testimonial, index) => (
            <TestimonialCard key={`${testimonial.name}-${index}`} testimonial={testimonial} />
          ))}
        </div>
        <div className="flex shrink-0 flex-col gap-5 pb-5" aria-hidden="true">
          {marqueeItems.map((testimonial, index) => (
            <TestimonialCard key={`${testimonial.name}-dup-${index}`} testimonial={testimonial} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Hero UI Mockup Card ────────────────────────────────────────────────────
function HeroMockupCard() {
  return (
    <div className="relative w-full max-w-sm mx-auto lg:mx-0 select-none">
      {/* Main chat card */}
      <div className="animate-float relative z-10 rounded-2xl border border-white/10 bg-[#111827] shadow-2xl shadow-black/60 p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Lerna AI Tutor</p>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"></span> Active session
            </p>
          </div>
          <div className="ml-auto flex gap-1">
            <div className="h-2 w-2 rounded-full bg-slate-600"></div>
            <div className="h-2 w-2 rounded-full bg-slate-600"></div>
            <div className="h-2 w-2 rounded-full bg-slate-600"></div>
          </div>
        </div>
        {/* Messages */}
        <div className="space-y-3 mb-4">
          <div className="flex gap-2 items-start">
            <div className="h-6 w-6 rounded-full bg-slate-700 shrink-0 mt-0.5 flex items-center justify-center">
              <span className="text-[9px] text-slate-300">U</span>
            </div>
            <div className="bg-[#1e2d4d] rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%]">
              <p className="text-[11px] text-slate-200">Explain the Krebs cycle in simple terms.</p>
            </div>
          </div>
          <div className="flex gap-2 items-start">
            <div className="h-6 w-6 rounded-lg bg-blue-500/20 shrink-0 mt-0.5 flex items-center justify-center">
              <Brain className="h-3 w-3 text-blue-400" />
            </div>
            <div className="bg-[#162032] border border-blue-500/10 rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%]">
              <p className="text-[11px] text-slate-200 leading-relaxed">
                The Krebs cycle is your cell&apos;s &ldquo;energy factory&rdquo;. It takes acetyl-CoA and spins it through 8 steps, releasing CO₂ and capturing energy as NADH...
              </p>
            </div>
          </div>
        </div>
        {/* Input */}
        <div className="flex gap-2 items-center">
          <div className="flex-1 rounded-lg bg-white/5 border border-white/8 px-3 py-2">
            <p className="text-[10px] text-slate-500">Ask a follow-up question...</p>
          </div>
          <button className="h-7 w-7 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
            <ArrowRight className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      </div>

      {/* Floating badge — top right */}
      <div className="animate-float-slow absolute -top-4 -right-4 z-20 rounded-xl bg-white px-3 py-2 shadow-xl shadow-black/30 flex items-center gap-2">
        <div className="flex text-amber-400">
          {[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}
        </div>
        <p className="text-[10px] font-semibold text-slate-800">4.9 / 5</p>
      </div>

      {/* Floating doc badge — bottom left */}
      <div className="animate-float absolute -bottom-5 -left-4 z-20 rounded-xl bg-[#111827] border border-blue-500/20 px-3 py-2 shadow-xl shadow-black/40 flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
          <FileText className="h-3.5 w-3.5 text-blue-400" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-white">lecture_notes.pdf</p>
          <p className="text-[9px] text-slate-500">Indexed · 42 pages</p>
        </div>
      </div>
    </div>
  );
}


// ── Main Page ──────────────────────────────────────────────────────────────
function HomePageContent() {
  const [activeModal, setActiveModal] = useState<"login" | "signup" | "forgot" | "reset" | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const auth = searchParams.get("auth");
    if (auth === "login") setActiveModal("login");
    if (auth === "signup") setActiveModal("signup");
    if (auth === "reset") setActiveModal("reset");
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-[#0B1120] text-slate-200 overflow-x-hidden font-body">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Lerna AI",
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "NGN" },
            description:
              "The most intuitive AI tutoring platform built for actual studying. Ask questions, upload PDFs, and build smart revision plans.",
          }),
        }}
      />

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <nav
        className={`fixed z-50 transition-all duration-300 left-1/2 -translate-x-1/2 ${
          isScrolled
            ? "top-0 w-full bg-[#0B1120]/80 backdrop-blur-xl border-b border-white/10 shadow-xl"
            : "top-5 w-[calc(100%-2rem)] max-w-6xl bg-transparent"
        }`}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 sm:px-5 py-2.5">
          {/* Logo */}
          <div className="flex items-center">
            <Image
              src="/assets/lerna-full-white.png"
              alt="Lerna"
              width={220}
              height={44}
              style={{ width: "auto", height: "auto" }}
              className="h-12 sm:max-w-[100px] max-w-[100px] object-contain"
              priority
            />
          </div>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-7">
            <Link href="#how-it-works" className="text-slate-400 hover:text-white text-sm font-medium transition-colors">
              How it works
            </Link>
            <Link href="#features" className="text-slate-400 hover:text-white text-sm font-medium transition-colors">
              Features
            </Link>
            <Link href="#pricing" className="text-slate-400 hover:text-white text-sm font-medium transition-colors">
              Pricing
            </Link>
            <Link href="#faq" className="text-slate-400 hover:text-white text-sm font-medium transition-colors">
              FAQ
            </Link>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => setActiveModal("login")}
              className="text-sm text-slate-400 hover:text-white font-medium transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={() => setActiveModal("signup")}
              className="rounded-full bg-white text-[#0B1120] hover:bg-slate-100 px-5 h-9 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Get started
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex md:hidden items-center justify-center p-2 text-slate-400 hover:text-white transition-colors"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <div className="md:hidden absolute top-[calc(100%+0.5rem)] left-0 right-0 rounded-2xl border border-white/10 bg-[#0B1120] backdrop-blur-2xl p-6 shadow-2xl flex flex-col gap-5 z-40">
              <div className="flex flex-col gap-3">
                {["How it works", "Features", "Pricing", "FAQ"].map((label) => (
                  <Link
                    key={label}
                    href={`#${label.toLowerCase().replace(/\s+/g, "-")}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-slate-300 hover:text-white font-medium transition-colors text-base py-2 border-b border-white/5"
                  >
                    {label}
                  </Link>
                ))}
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={() => { setIsMobileMenuOpen(false); setActiveModal("login"); }}
                  className="w-full text-center text-slate-300 hover:text-white font-semibold py-3 border border-white/10 rounded-full hover:bg-white/5 transition-all"
                >
                  Sign in
                </button>
                <button
                  onClick={() => { setIsMobileMenuOpen(false); setActiveModal("signup"); }}
                  className="w-full bg-white text-[#0B1120] hover:bg-slate-100 rounded-full py-3 font-semibold text-base transition-all flex items-center justify-center gap-2"
                >
                  Get started <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── Hero Section ────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-6 pt-32 pb-24 sm:pt-40 sm:pb-32">
        {/* Background glow */}
        <div className="pointer-events-none absolute top-0 left-1/4 h-[500px] w-[600px] rounded-full bg-blue-600/8 blur-[120px]" />

        <div className="relative z-10 flex flex-col items-start pt-8 sm:pt-12 text-left">
          {/* Top: text */}
          <div className="max-w-[42rem] flex flex-col items-start">
            <h1 className="font-body text-5xl sm:text-6xl lg:text-[5rem] font-medium tracking-tight text-white leading-[1.1] mb-6">
              Learn{" "}
              <span className="italic text-cyan-400 relative inline-block">
                smarter,
                <svg className="absolute left-0 w-full -bottom-1 text-cyan-400" viewBox="0 0 100 20" preserveAspectRatio="none" style={{ height: '10px' }}>
                  <path d="M0,10 Q10,20 20,10 T40,10 T60,10 T80,10 T100,10" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </span>
              <br />
              not harder.
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 leading-relaxed mb-10 max-w-lg">
              Ask questions, upload study materials, build smart revision plans, and keep every learning session organized in one workspace.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 items-center justify-start">
              <button
                onClick={() => setActiveModal("signup")}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-[#0B1120] hover:bg-slate-200 px-6 h-12 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Get started <ArrowRight className="h-4 w-4" />
              </button>
              <Link href="#how-it-works">
                <button className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">
                  See how it works
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom: Dashboard mockup image */}
        <div className="relative z-10 mt-20 sm:mt-24 w-full">
          <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-2 sm:p-4 shadow-2xl backdrop-blur-xl">
            <div className="rounded-lg sm:rounded-xl overflow-hidden border border-white/5 relative bg-[#0B1120]">
              <div className="absolute top-0 left-0 w-full h-8 sm:h-12 bg-[#1A2234] border-b border-white/5 flex items-center px-3 sm:px-4 gap-1.5 sm:gap-2 z-10">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-rose-500/80"></div>
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-500/80"></div>
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500/80"></div>
              </div>
              <div className="pt-8 sm:pt-12">
                <Image
                  src="/dashboard-mockup.png"
                  alt="Lerna Dashboard Interface"
                  width={1280}
                  height={720}
                  className="w-full h-auto object-cover opacity-90"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>




      {/* ── How It Works ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-28 sm:py-36 relative overflow-hidden">
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[600px] rounded-full bg-blue-700/5 blur-[100px]" />
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="max-w-2xl mb-16 sm:mb-20">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400 mb-4 block">
              Getting started
            </span>
            <h2 className="font-heading text-4xl sm:text-5xl lg:text-[3rem] font-normal tracking-tight text-white leading-[1.1] mb-5">
              Three steps to smarter learning
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              No complicated setup. Upload your materials and start learning in seconds.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {steps.map((step, idx) => (
              <div
                key={step.number}
                className="relative bg-[#111827] border border-white/8 rounded-2xl p-8 sm:p-10 transition-all"
              >
                <div className="font-heading text-6xl sm:text-7xl font-normal text-white/8 transition-colors mb-6 leading-none select-none">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
                <p className="text-slate-400 text-base leading-relaxed">{step.description}</p>
                {idx < 2 && (
                  <div className="hidden lg:flex absolute top-10 -right-4 z-20 h-8 w-8 items-center justify-center rounded-full bg-[#1e2d4d] border border-white/10">
                    <ArrowRight className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ────────────────────────────────────────────── */}
      <section id="features" className="py-28 sm:py-36 border-t border-white/5 relative">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl mb-16 sm:mb-20">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400 mb-4 block">
              Features
            </span>
            <h2 className="font-heading text-4xl sm:text-5xl lg:text-[3rem] font-normal tracking-tight text-white leading-[1.1] mb-5">
              Everything you need in a personal AI tutor
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              A comprehensive study suite built to help you review, test, and master your coursework.
            </p>
          </div>

          <div className="grid gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="relative bg-[#111827] border border-white/8 p-7 rounded-2xl transition-all duration-300 cursor-default"
                >
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                    {feature.isComingSoon && (
                      <span className="text-[10px] uppercase tracking-wider bg-blue-500/15 text-blue-300 font-bold px-2.5 py-1 rounded-full">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing Section ─────────────────────────────────────────────── */}
      <section id="pricing" className="py-28 sm:py-36 border-t border-white/5 relative">
        <div className="pointer-events-none absolute top-0 right-1/4 h-72 w-72 rounded-full bg-blue-700/6 blur-[80px]" />
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="max-w-2xl mb-16 sm:mb-20">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400 mb-4 block">
              Pricing
            </span>
            <h2 className="font-heading text-4xl sm:text-5xl lg:text-[3rem] font-normal tracking-tight text-white leading-[1.1] mb-5">
              Simple, transparent pricing
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Start studying for free. Lock in advanced capabilities as they launch.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`flex flex-col justify-between rounded-2xl p-8 relative overflow-hidden border transition-all ${
                  plan.name === "Pro"
                    ? "bg-[#0d1e3a] border-blue-500/50 shadow-[0_0_40px_rgba(59,130,246,0.12)]"
                    : "bg-[#111827] border-white/8"
                }`}
              >
                {plan.isComingSoon && plan.name !== "Pro" && (
                  <div className="absolute top-0 right-0 bg-blue-500/15 text-blue-300 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-bl-xl">
                    Soon
                  </div>
                )}
                {plan.name === "Pro" && (
                  <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-bl-xl">
                    Popular
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-slate-400 mb-6">{plan.description}</p>
                  <div className="flex items-baseline gap-1 mb-7">
                    <span className="text-4xl font-bold tracking-tight text-white">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-sm text-slate-400">{plan.period}</span>
                    )}
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />
                        <span className="text-slate-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  disabled={plan.isComingSoon}
                  onClick={() => !plan.isComingSoon && setActiveModal("signup")}
                  className={`w-full h-11 rounded-xl text-sm font-semibold transition-all ${
                    plan.isComingSoon
                      ? "bg-white/5 border border-white/10 text-slate-500 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20"
                  }`}
                >
                  {plan.buttonText}
                </button>

              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials Section ─────────────────────────────────────────── */}
      <section id="testimonials" className="py-28 sm:py-36 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl mb-16 sm:mb-20">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400 mb-4 block">
              Student stories
            </span>
            <h2 className="font-heading text-4xl sm:text-5xl lg:text-[3rem] font-normal tracking-tight text-white leading-[1.1] mb-5">
              Real study wins from Lerna students
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              See how students are using Lerna AI to turn scattered materials into confident progress.
            </p>
          </div>

          <div
            className="relative overflow-hidden"
            style={{
              maskImage: "linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)",
            }}
          >
            <div className="grid gap-5 md:hidden">
              {testimonials.map((t) => (
                <TestimonialCard key={t.name} testimonial={t} />
              ))}
            </div>
            <div className="hidden h-[620px] gap-5 md:flex">
              <TestimonialMarqueeColumn items={testimonials.filter((_, i) => i % 3 === 0)} />
              <TestimonialMarqueeColumn items={testimonials.filter((_, i) => i % 3 === 1)} reverse />
              <div className="hidden min-w-0 flex-1 lg:block">
                <TestimonialMarqueeColumn items={testimonials.filter((_, i) => i % 3 === 2)} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Comparison Section ───────────────────────────────────────────── */}
      <section id="compare" className="py-28 sm:py-36 border-t border-white/5 relative overflow-hidden">
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[600px] rounded-full bg-blue-700/5 blur-[100px]" />
        <div className="mx-auto max-w-5xl px-6 relative z-10">
          <div className="text-center mb-16 sm:mb-20">
            <span className="inline-flex items-center justify-center rounded-full bg-[#1e2d4d] border border-blue-500/20 text-blue-300 text-xs font-semibold px-4 py-1.5 mb-6 tracking-wide">
              Capabilities
            </span>
            <h2 className="font-heading text-4xl sm:text-5xl lg:text-[3rem] font-normal tracking-tight text-white leading-[1.1] mb-5">
              More than just answers. <br className="hidden sm:block" />
              <span className="italic text-blue-400">Built to learn.</span>
            </h2>
          </div>

          <div className="overflow-x-auto pb-8">
            <div className="min-w-[700px] rounded-2xl border border-white/8 bg-[#111827]/50 backdrop-blur-sm overflow-hidden">
              {/* Header Row */}
              <div className="grid grid-cols-4 bg-white/5 border-b border-white/8 p-4 sm:p-6 items-center">
                <div className="col-span-1"></div>
                <div className="text-center font-heading text-xl sm:text-2xl text-blue-400 font-semibold tracking-wide">
                  Lerna AI
                </div>
                <div className="text-center font-heading text-lg sm:text-xl text-slate-400 tracking-wide">
                  ChatGPT
                </div>
                <div className="text-center font-heading text-lg sm:text-xl text-slate-400 tracking-wide">
                  NotebookLM
                </div>
              </div>

              {/* Feature Rows */}
              {[
                { title: "Interactive AI Tutor with saved learning progress", lerna: true, gpt: false, notebook: false },
                { title: "Audio & voice learning based on your sources", lerna: true, gpt: false, notebook: true },
                { title: "Auto-generates flashcards & mock exams", lerna: true, gpt: "partial", notebook: "partial" },
                { title: "Personalized exam study schedules & timelines", lerna: true, gpt: false, notebook: false },
                { title: "Essay drafting with instant structural feedback", lerna: true, gpt: "partial", notebook: false },
                { title: "Sustained session history & progress tracking", lerna: true, gpt: true, notebook: false },
                { title: "Chat with multiple complex PDFs concurrently", lerna: true, gpt: true, notebook: true },
                { title: "Dedicated workspaces for course materials", lerna: true, gpt: false, notebook: true },
              ].map((row, idx) => (
                <div key={idx} className="grid grid-cols-4 border-b border-white/5 last:border-0 p-4 sm:p-6 items-center hover:bg-white/[0.02] transition-colors">
                  <div className="col-span-1 text-sm sm:text-base text-slate-300 pr-4 font-medium">
                    {row.title}
                  </div>
                  <div className="flex justify-center">
                    {row.lerna ? (
                      <span className="font-heading italic text-blue-400 text-2xl font-normal tracking-wide">Yes</span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </div>
                  <div className="flex justify-center">
                    {row.gpt === true || row.gpt === "partial" ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-500 text-slate-900">
                        <CheckCircle2 className="h-3 w-3" />
                      </div>
                    ) : (
                      <span className="text-slate-600 font-medium">-</span>
                    )}
                  </div>
                  <div className="flex justify-center">
                    {row.notebook === true || row.notebook === "partial" ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-500 text-slate-900">
                        <CheckCircle2 className="h-3 w-3" />
                      </div>
                    ) : (
                      <span className="text-slate-600 font-medium">-</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Community Section ───────────────────────────────────────────── */}
      <section id="community" className="py-28 sm:py-36 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl mb-16 sm:mb-20">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400 mb-4 block">
              Community
            </span>
            <h2 className="font-heading text-4xl sm:text-5xl lg:text-[3rem] font-normal tracking-tight text-white leading-[1.1] mb-5">
              Join the community of students worldwide
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Connect, collaborate, and share knowledge with thousands of students using Lerna AI globally.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* WhatsApp */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#111827] p-8 flex flex-col justify-between transition-all">
              <div className="absolute -right-8 -top-8 h-40 w-40 bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 mb-6">
                  <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12.012 2C6.48 2 2 6.48 2 12.012c0 1.764.456 3.48 1.332 5.004L2 22l5.148-1.344c1.488.816 3.168 1.248 4.86 1.248 5.532 0 10.012-4.48 10.012-10.012A9.97 9.97 0 0012.012 2zm5.796 14.196c-.24.672-1.2 1.224-1.656 1.284-.444.06-1.008.084-2.82-.672-2.316-.96-3.804-3.324-3.924-3.48-.108-.156-.936-1.248-.936-2.376 0-1.128.588-1.68.804-1.908.216-.228.468-.288.624-.288.156 0 .312.008.444.012.144.004.336-.056.528.408.192.48.66 1.608.72 1.728.06.12.096.264.012.432-.084.168-.18.276-.3.42-.12.144-.252.3-.36.408-.12.12-.24.252-.108.48.132.228.588.972 1.26 1.572.864.768 1.596 1.008 1.824 1.116.228.108.36.096.492-.06.132-.156.576-.672.732-.9.156-.228.312-.192.528-.108.216.084 1.38.648 1.62.768.24.12.408.18.468.288.06.108.06.624-.18 1.296z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">WhatsApp Study Group</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-7">
                  Join our official WhatsApp group to get instant support, participate in daily study challenges, and receive platform updates directly.
                </p>
              </div>
              <Link
                href="https://chat.whatsapp.com/GAnA2Edibt8Dcn54nuVHtI?s=cl&p=a&ilr=0"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 h-10 text-sm transition-all w-fit"
              >
                Join WhatsApp Group <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Discord */}
            <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-[#111827] p-8 flex flex-col justify-between transition-all">
              <div className="absolute -right-8 -top-8 h-40 w-40 bg-indigo-500/8 rounded-full blur-3xl pointer-events-none" />
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 mb-6">
                  <svg className="h-5 w-5 fill-current" viewBox="0 0 127.14 96.36">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,52.22,6.83,77.19,77.19,0,0,0,48.92,0,105.15,105.15,0,0,0,18.48,8.07C2.71,31.58-1.54,54.65.37,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.4-5c.87-.64,1.71-1.32,2.5-2a75.48,75.48,0,0,0,72.7,0c.79.7,1.63,1.38,2.5,2a75.48,75.48,0,0,0,31.63-18.83C129.87,49.25,124.9,26.43,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.88,46,53.88,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.12,46,96.12,53,91,65.69,84.69,65.69Z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Discord Server</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-7">
                  Join our Discord community to participate in voice channels, team up for study groups, share resources, and voice feedback directly to developers.
                </p>
              </div>
              <Link
                href="https://discord.gg/YneZvF38w"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold px-5 h-10 text-sm transition-all w-fit"
              >
                Join Discord Server <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ Section ─────────────────────────────────────────────────── */}
      <section id="faq" className="py-28 sm:py-36 border-t border-white/5">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-14">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400 mb-4 block">
              FAQ
            </span>
            <h2 className="font-heading text-4xl sm:text-5xl font-normal tracking-tight text-white leading-[1.1] mb-5">
              Frequently asked questions
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Have questions? Find quick answers about Lerna AI&apos;s features, pricing, and security.
            </p>
          </div>

          <div className="bg-[#111827] border border-white/8 rounded-2xl px-6 sm:px-8 py-2">
            {faqs.map((faq) => (
              <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer CTA + Footer ─────────────────────────────────────────── */}
      <footer>
        {/* CTA band */}
        <div className="relative overflow-hidden border-t border-white/8 bg-[#0d1424] px-6 py-20 sm:py-24 text-center">
          <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-64 w-[500px] rounded-full bg-blue-600/10 blur-[80px]" />
          <div className="relative z-10 mx-auto max-w-2xl flex flex-col items-center">
            <span className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
              Your next breakthrough starts here
            </span>
            <h2 className="font-heading text-4xl sm:text-5xl font-normal tracking-tight text-white leading-[1.1] mb-5">
              Make every study session count.
            </h2>
            <p className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-lg mb-8">
              Bring your notes, questions, and goals into one focused workspace built to help you learn with confidence.
            </p>
            <button
              onClick={() => setActiveModal("signup")}
              className="inline-flex items-center gap-2 rounded-full bg-white text-[#0B1120] hover:bg-slate-100 px-8 h-12 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-white/10"
            >
              Get started for free <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Footer links */}
        <div className="border-t border-white/5 bg-[#0B1120] px-6 py-14">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 grid-cols-2 md:grid-cols-5 items-start">
              {/* Brand */}
              <div className="col-span-2 flex flex-col gap-4">
                <Image
                  src="/assets/lerna-full-white.png"
                  alt="Lerna"
                  width={200}
                  height={40}
                  className="h-10 w-auto object-contain"
                />
                <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
                  The most intuitive AI tutoring platform built for actual studying. Ask questions, upload PDFs, and master courses.
                </p>
              </div>

              {/* Product */}
              <div className="flex flex-col gap-4">
                <h4 className="text-white text-xs font-semibold uppercase tracking-wider">Product</h4>
                <ul className="flex flex-col gap-3 text-sm">
                  <li><Link href="#how-it-works" className="text-slate-500 hover:text-white transition-colors">How it works</Link></li>
                  <li><Link href="#features" className="text-slate-500 hover:text-white transition-colors">Features</Link></li>
                  <li><Link href="#pricing" className="text-slate-500 hover:text-white transition-colors">Pricing</Link></li>
                </ul>
              </div>

              {/* Legal */}
              <div className="flex flex-col gap-4">
                <h4 className="text-white text-xs font-semibold uppercase tracking-wider">Legal</h4>
                <ul className="flex flex-col gap-3 text-sm">
                  <li><Link href="/privacy-policy" className="text-slate-500 hover:text-white transition-colors">Privacy Policy</Link></li>
                  <li><Link href="#" className="text-slate-500 hover:text-white transition-colors">Terms of Service</Link></li>
                </ul>
              </div>

              {/* Connect */}
              <div className="flex flex-col gap-4">
                <h4 className="text-white text-xs font-semibold uppercase tracking-wider">Connect</h4>
                <ul className="flex flex-col gap-3 text-sm">
                  <li><Link href="mailto:support@uselerna.app" className="text-slate-500 hover:text-white transition-colors">Support</Link></li>
                  <li><Link href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white transition-colors">GitHub</Link></li>
                </ul>
              </div>
            </div>

            <div className="h-px w-full bg-white/5 mt-12 mb-6" />

            <div className="flex flex-col md:flex-row justify-between items-center text-xs gap-3 text-slate-600">
              <p>Copyright &copy; {new Date().getFullYear()} Lerna AI. All rights reserved.</p>
              <span>Built for student excellence</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Auth Modals ──────────────────────────────────────────────────── */}
      <Modal isOpen={activeModal === "login"} onClose={() => setActiveModal(null)}>
        <LoginForm
          onSwitchToSignup={() => setActiveModal("signup")}
          onSwitchToForgot={() => setActiveModal("forgot")}
          redirectTo="/chat"
        />
      </Modal>

      <Modal isOpen={activeModal === "signup"} onClose={() => setActiveModal(null)}>
        <SignupForm onSwitchToLogin={() => setActiveModal("login")} redirectTo="/chat" />
      </Modal>

      <Modal isOpen={activeModal === "forgot"} onClose={() => setActiveModal(null)}>
        <ForgotPasswordModal
          onSwitchToLogin={() => setActiveModal("login")}
          onClose={() => setActiveModal(null)}
        />
      </Modal>

      <Modal isOpen={activeModal === "reset"} onClose={() => setActiveModal(null)}>
        <ResetPasswordModal
          onClose={() => setActiveModal(null)}
          onSuccess={() => setActiveModal("login")}
        />
      </Modal>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B1120] flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
