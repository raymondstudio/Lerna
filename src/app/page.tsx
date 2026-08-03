"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, Suspense } from "react";
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
  Users
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";
import { ForgotPasswordModal } from "@/components/auth/forgot-password-modal";
import { ResetPasswordModal } from "@/components/auth/reset-password-modal";

// 9 benefits-focused features
const features = [
  { 
    icon: Brain, 
    title: "AI Tutor", 
    description: "Get clear, step-by-step explanations tailored to your subject, speed, and learning style." 
  },
  { 
    icon: UploadCloud, 
    title: "Upload Lecture Notes", 
    description: "Convert dense lecture slides, recordings, and outlines into structured lessons instantly." 
  },
  { 
    icon: FileText, 
    title: "AI Document Analysis", 
    description: "Parse, extract, and synthesize complex PDFs, articles, and book chapters without cognitive overload." 
  },
  { 
    icon: Calendar, 
    title: "Personalized Study Plans", 
    description: "Set study targets and generate structured timelines to map out exams, courses, and tasks." 
  },
  { 
    icon: Layers, 
    title: "Flashcards", 
    description: "Auto-generate interactive revision decks and review concepts with spaced repetition." 
  },
  { 
    icon: HelpCircle, 
    title: "Quiz Generator", 
    description: "Challenge your comprehension with custom multiple-choice, short-answer, and mock exams." 
  },
  { 
    icon: PenTool, 
    title: "Essay Practice", 
    description: "Draft essays with instant styling feedback, thesis checks, and structural revisions." 
  },
  { 
    icon: History, 
    title: "Persistent Study Sessions", 
    description: "Never lose your spot. Your conversations, document history, and notes stay synced and open." 
  },
  { 
    icon: Mic, 
    title: "Voice Learning", 
    description: "Engage in natural, audio-based study dialogues. Talk to your tutor and listen on the go.",
    isComingSoon: true 
  },
];

const steps = [
  {
    number: "01",
    title: "Upload study materials",
    description: "Drag and drop your lecture slides, class notes, research PDFs, or outlines into your personal workspace."
  },
  {
    number: "02",
    title: "Ask questions & interact",
    description: "Let your AI tutor guide you through difficult concepts, explain diagrams, or break down formulas step-by-step."
  },
  {
    number: "03",
    title: "Master your courses",
    description: "Generate customized practice exams, revision flashcards, and personalized study schedules to master any exam."
  }
];

const pricingPlans = [
  {
    name: "Free",
    price: "₦0",
    description: "Perfect for trying out EduAgent AI.",
    features: [
      "Unlimited sign up",
      "Limited AI usage",
      "Upload documents",
      "Persistent chat history"
    ],
    buttonText: "Get Started for Free",
    isComingSoon: false
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
      "Larger AI quota"
    ],
    buttonText: "Coming Soon",
    isComingSoon: true
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
      "Premium support"
    ],
    buttonText: "Coming Soon",
    isComingSoon: true
  }
];

const testimonials = [
  {
    quote: "EduAgent completely changed how I study for midterms. I uploaded 50 pages of biology slides and it explained the Krebs cycle better than my textbook.",
    name: "Sarah L.",
    role: "Pre-Med Student",
    rating: 5
  },
  {
    quote: "The interactive quiz generator is incredible. Instead of passively reading, I can test myself on the exact material our instructor covered in class.",
    name: "Alex M.",
    role: "Computer Science Junior",
    rating: 5
  },
  {
    quote: "Having my study sessions persist across devices means I can start on my laptop and continue reading on my phone on the train. A lifesaver.",
    name: "David K.",
    role: "Law Student",
    rating: 5
  }
];

const faqs = [
  {
    question: "Is it free?",
    answer: "Yes! EduAgent AI offers a robust Free plan that lets you sign up, upload study materials, chat with your AI tutor, and access persistent session history."
  },
  {
    question: "What file types are supported?",
    answer: "We support PDF documents, Word files (.docx), and raw text files. We parse and index your course material so you can query it immediately."
  },
  {
    question: "Can it remember my learning progress?",
    answer: "Absolutely. Every study session you start is fully persistent. You can close the tab or switch from desktop to mobile and resume tutoring from the exact same point."
  },
  {
    question: "Can it generate quizzes?",
    answer: "Yes, you can generate customized quizzes with multiple-choice or short-answer formats directly from your uploaded lectures or chat context."
  },
  {
    question: "Is my data secure?",
    answer: "We take your privacy seriously. Your uploaded materials and chat logs are fully encrypted in transit and at rest, and we never share your data or use it to train public models."
  }
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/5 py-4 sm:py-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left focus:outline-none group py-2"
      >
        <span className="text-base sm:text-lg font-medium text-slate-200 group-hover:text-cyan-400 transition-colors">
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-slate-400 group-hover:text-white transition-colors ml-4 shrink-0"
        >
          <ChevronDown className="h-5 w-5" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: "auto", opacity: 1, marginTop: 12 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed pb-2">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DemoChat({ onTriggerSignup }: { onTriggerSignup: () => void }) {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCTA, setShowCTA] = useState(false);

  const starters = [
    "Explain quantum computing in simple terms",
    "What is the difference between active and passive transport?",
    "Give me a quick analogy for recursive programming",
  ];

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError(null);
    setLoading(true);
    setInput("");
    
    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);

    try {
      const res = await fetch("/api/demo-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate answer.");
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      setShowCTA(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I apologize, but I'm having trouble connecting to the tutoring engine right now. Please try again or sign up for full access!" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto rounded-3xl border border-white/10 bg-[#141414]/40 backdrop-blur-md p-6 sm:p-8 text-left shadow-[0_0_50px_rgba(6,182,212,0.05)] mb-24">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
          <Brain className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">Interactive AI Tutor Demo</h3>
          <p className="text-xs text-slate-500 mt-0.5">Test EduAgent's capabilities immediately below.</p>
        </div>
      </div>

      {/* Messages area */}
      <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400 leading-relaxed italic">
            Ask any study question below, or select a starter topic to preview tutoring capabilities instantly.
          </p>
        )}
        {messages.map((msg, index) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={index}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-cyan-500/15 border border-cyan-500/20 text-white rounded-br-none"
                  : "bg-white/[0.04] border border-white/5 text-slate-300 rounded-bl-none"
              }`}
            >
              {msg.content}
            </div>
          </motion.div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] border border-white/5 px-4 py-2.5">
              <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-bounce"></span>
            </div>
          </div>
        )}
      </div>

      {/* Starters */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {starters.map((starter) => (
            <button
              key={starter}
              onClick={() => handleSend(starter)}
              disabled={loading}
              className="text-xs text-slate-400 border border-white/10 bg-white/[0.02] rounded-full px-3.5 py-1.5 hover:border-cyan-500/30 hover:bg-cyan-500/5 hover:text-white transition-colors"
            >
              {starter}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
          placeholder="Ask a study question... (e.g. How does DNA replicate?)"
          disabled={loading}
          className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
        />
        <button
          onClick={() => handleSend(input)}
          disabled={loading || !input.trim()}
          className="h-11 px-5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          Ask
        </button>
      </div>

      {/* CTA Conversion Box */}
      {showCTA && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-8 border border-cyan-500/25 bg-cyan-500/10 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Unlock full tutoring powers!</p>
            <p className="text-xs text-cyan-200 mt-1">
              Create persistent study sessions, upload your lecture materials, and generate custom practice quizzes.
            </p>
          </div>
          <button
            onClick={onTriggerSignup}
            className="whitespace-nowrap rounded-xl bg-white hover:bg-slate-200 text-slate-950 px-5 py-2.5 text-xs font-semibold shadow-md transition-all flex items-center gap-1 shrink-0"
          >
            Create free account <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </div>
  );
}

function HomePageContent() {
  const [activeModal, setActiveModal] = useState<"login" | "signup" | "forgot" | "reset" | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const auth = searchParams.get("auth");
    if (auth === "login") setActiveModal("login");
    if (auth === "signup") setActiveModal("signup");
    if (auth === "reset") setActiveModal("reset");
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-slate-200 selection:bg-cyan-500/30 font-body overflow-x-hidden">
      {/* Structured Data JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "EduAgent AI",
            "applicationCategory": "EducationalApplication",
            "operatingSystem": "Web",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            },
            "description": "Experience the most intuitive AI tutoring platform built for actual studying. Ask questions, upload PDFs, and build smart revision plans.",
          }),
        }}
      />
      
      {/* Floating Navigation */}
      <motion.nav 
        initial={{ y: -100, x: "-50%" }}
        animate={{ y: 0, x: "-50%" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="fixed top-6 left-1/2 w-[calc(100%-2rem)] max-w-7xl z-50 rounded-2xl border border-white/10 bg-[#0a0a0a]/50 backdrop-blur-xl mix-blend-plus-lighter shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-black">
              <Brain className="h-6 w-6" />
            </div>
            <span className="font-heading font-semibold text-white tracking-tight text-xl">EduAgent</span>
          </div>
          
          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-5 lg:gap-6">
            <Link href="#how-it-works" className="text-slate-300 hover:text-white font-medium transition-colors text-base">How it works</Link>
            <Link href="#features" className="text-slate-300 hover:text-white font-medium transition-colors text-base">Features</Link>
            <Link href="#pricing" className="text-slate-300 hover:text-white font-medium transition-colors text-base">Pricing</Link>
            <Link href="#faq" className="text-slate-300 hover:text-white font-medium transition-colors text-base">FAQ</Link>
          </div>
          
          {/* Desktop Auth Actions */}
          <div className="hidden md:flex items-center gap-4">
            <button onClick={() => setActiveModal("login")} className="text-slate-300 hover:text-white font-medium transition-colors text-base">Sign in</button>
            <Button onClick={() => setActiveModal("signup")} className="bg-white text-black hover:bg-slate-200 rounded-full px-5 lg:px-6 h-11 text-base font-medium transition-all">
              Get started <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {/* Mobile Hamburger menu toggle */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex md:hidden items-center justify-center p-2 text-slate-400 hover:text-white transition-colors"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Dropdown Panel */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="md:hidden absolute top-[calc(100%+0.5rem)] left-0 right-0 rounded-2xl border border-white/10 bg-[#0a0a0a]/95 backdrop-blur-2xl p-6 shadow-2xl flex flex-col gap-6 z-40 overflow-hidden"
            >
              <div className="flex flex-col gap-4">
                <Link 
                  href="#how-it-works" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-slate-300 hover:text-white font-medium transition-colors text-base py-2 border-b border-white/5"
                >
                  How it works
                </Link>
                <Link 
                  href="#features" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-slate-300 hover:text-white font-medium transition-colors text-base py-2 border-b border-white/5"
                >
                  Features
                </Link>
                <Link 
                  href="#pricing" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-slate-300 hover:text-white font-medium transition-colors text-base py-2 border-b border-white/5"
                >
                  Pricing
                </Link>
                <Link 
                  href="#faq" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-slate-300 hover:text-white font-medium transition-colors text-base py-2 border-b border-white/5"
                >
                  FAQ
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setActiveModal("login");
                  }}
                  className="w-full text-center text-slate-300 hover:text-white font-semibold py-3 border border-white/10 rounded-full hover:bg-white/5 transition-all text-base"
                >
                  Sign in
                </button>
                <Button 
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setActiveModal("signup");
                  }}
                  className="w-full bg-white text-black hover:bg-slate-200 rounded-full py-6 font-semibold text-base justify-center transition-all"
                >
                  Get started <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative mx-auto max-w-7xl px-6 pt-36 sm:pt-48 pb-20 text-center">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[350px] w-[350px] sm:h-[600px] sm:w-[600px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none z-0" />
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10"
        >

          <h1 className="font-heading text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6 text-balance max-w-5xl mx-auto leading-[1.1]">
            Learn <span className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">smarter</span>, not harder.
          </h1>
          <p className="mx-auto max-w-3xl text-lg sm:text-xl text-slate-400 mb-10 text-balance leading-relaxed">
            Ask questions, upload study material, build smart revision plans, and keep every learning session organized in one workspace. No fluff, just results.
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20 relative z-10 max-w-md mx-auto sm:max-w-none"
        >
          <Button onClick={() => setActiveModal("signup")} className="bg-white text-black hover:bg-slate-200 rounded-full px-10 h-14 text-lg font-medium w-full sm:w-auto shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all">
            Start studying <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Link href="#features" className="w-full sm:w-auto">
            <Button variant="outline" className="border-white/10 bg-[#141414]/60 hover:bg-[#1f1f1f]/80 text-white rounded-full px-10 h-14 text-lg font-medium w-full transition-all">
              Explore features
            </Button>
          </Link>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          className="relative z-10"
        >
          <DemoChat onTriggerSignup={() => setActiveModal("signup")} />
        </motion.div>
        
        {/* Dashboard Image Mockup */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
          className="relative mx-auto max-w-5xl rounded-[2rem] overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(6,182,212,0.08)] bg-[#0e1115]/50 p-2 z-10"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent z-20 pointer-events-none" />
           <Image
             src="/dashboard-mockup.png"
             alt="EduAgent AI Tutoring Dashboard Mockup"
             width={2048}
             height={1366}
             className="w-full h-auto object-cover rounded-[1.7rem]"
             priority
           />
        </motion.div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="border-t border-white/5 bg-[#08080a] py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 h-[400px] w-[400px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-24">
            <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight text-white mb-6">
              Three simple steps to smarter learning
            </h2>
            <p className="text-lg sm:text-xl text-slate-400">
              No complicated configuration. Upload your materials and start learning in seconds.
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-3 relative">
            {steps.map((step, idx) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: idx * 0.15 }}
                className="relative bg-white/[0.01] border border-white/5 rounded-3xl p-8 sm:p-10 flex flex-col justify-between hover:border-cyan-500/20 transition-all group"
              >
                <div>
                  <div className="font-heading text-5xl sm:text-6xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent opacity-80 group-hover:opacity-100 transition-opacity mb-6">
                    {step.number}
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-4">{step.title}</h3>
                  <p className="text-slate-400 text-base sm:text-lg leading-relaxed">{step.description}</p>
                </div>
                {/* Connecting arrow/line on desktop */}
                {idx < 2 && (
                  <div className="hidden lg:block absolute top-1/2 -right-6 translate-x-1/2 -translate-y-1/2 z-20 text-cyan-500/30">
                    <ArrowRight className="h-6 w-6" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-24 sm:py-32 overflow-hidden">
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-24">
          <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight text-white mb-6">
            Everything you need in a personal AI tutor
          </h2>
          <p className="text-lg sm:text-xl text-slate-400">
            A comprehensive study suite built to help you review, test, and master your coursework.
          </p>
        </div>

        <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div 
                key={feature.title} 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                whileHover={{ y: -6 }}
                className="relative bg-white/[0.01] border border-white/5 hover:border-cyan-500/30 hover:bg-white/[0.03] p-8 rounded-3xl transition-all duration-300 group cursor-default"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="h-6 w-6" />
                  </div>
                  {feature.isComingSoon && (
                    <span className="text-[10px] uppercase tracking-wider bg-cyan-500/20 text-cyan-300 font-bold px-2.5 py-1 rounded-full">
                      Coming Soon
                    </span>
                  )}
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold text-white mb-3">{feature.title}</h3>
                <p className="text-slate-400 text-sm sm:text-base leading-relaxed">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="bg-[#08080a] border-t border-white/5 py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-24">
            <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight text-white mb-6">
              Simple, transparent pricing
            </h2>
            <p className="text-lg sm:text-xl text-slate-400">
              Start studying for free. Lock in advanced capabilities as they launch.
            </p>
          </div>

          <div className="grid gap-8 max-w-4xl mx-auto md:grid-cols-2 items-stretch">
            {pricingPlans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.15 }}
                className={`flex flex-col justify-between bg-white/[0.01] border rounded-3xl p-8 sm:p-10 relative overflow-hidden ${
                  plan.isComingSoon 
                    ? "border-cyan-500/20 shadow-[0_0_50px_rgba(6,182,212,0.04)]" 
                    : "border-white/5"
                }`}
              >
                {plan.isComingSoon && (
                  <div className="absolute top-0 right-0 bg-cyan-500 text-black text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl">
                    Coming Soon
                  </div>
                )}
                <div>
                  <h3 className="text-2xl font-semibold text-white mb-2">{plan.name}</h3>
                  <p className="text-sm text-slate-400 mb-6">{plan.description}</p>
                  <div className="flex items-baseline gap-1 mb-8">
                    <span className="text-5xl font-bold text-white tracking-tight">{plan.price}</span>
                    {plan.period && <span className="text-slate-400 text-lg">{plan.period}</span>}
                  </div>
                  
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-slate-300 text-sm sm:text-base">
                        <CheckCircle2 className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  disabled={plan.isComingSoon}
                  onClick={() => !plan.isComingSoon && setActiveModal("signup")}
                  className={`w-full h-12 rounded-xl text-base font-semibold transition-all mt-4 ${
                    plan.isComingSoon
                      ? "bg-white/5 border border-white/10 text-slate-500 cursor-not-allowed"
                      : "bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]"
                  }`}
                >
                  {plan.buttonText}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-24">
          <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight text-white mb-6">
            Loved by students everywhere
          </h2>
          <p className="text-lg sm:text-xl text-slate-400">
            See how EduAgent AI is helping college and university students study smarter.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {testimonials.map((t, idx) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: idx * 0.1 }}
              className="bg-white/[0.01] border border-white/5 rounded-3xl p-8 flex flex-col justify-between hover:border-cyan-500/10 transition-colors"
            >
              <div>
                <div className="flex gap-1 mb-6 text-cyan-400">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-current" />
                  ))}
                </div>
                <p className="text-slate-300 text-base sm:text-lg leading-relaxed italic mb-8">
                  "{t.quote}"
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-white text-base">{t.name}</h4>
                <p className="text-slate-500 text-sm mt-0.5">{t.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Community Section */}
      <section id="community" className="mx-auto max-w-5xl px-6 py-24 sm:py-32 relative z-10 border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-4 py-1.5 text-xs sm:text-sm font-medium text-cyan-300 mb-6 hover:bg-cyan-500/10 transition-colors"
          >
            <Users className="h-3.5 w-3.5 text-cyan-400" />
            <span>EduAgent Community</span>
          </motion.div>
          <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight text-white mb-6">
            Join the Community of Students worldwide
          </h2>
          <p className="text-lg text-slate-400">
            Connect, collaborate, and share knowledge with thousands of students using EduAgent AI globally.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* WhatsApp Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-emerald-950/5 backdrop-blur-md p-8 flex flex-col justify-between hover:border-emerald-500/40 hover:bg-emerald-950/10 transition-all group"
          >
            <div className="absolute -right-10 -top-10 h-32 w-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:scale-125 transition-transform duration-500"></div>
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-6">
                <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
                  <path d="M12.012 2C6.48 2 2 6.48 2 12.012c0 1.764.456 3.48 1.332 5.004L2 22l5.148-1.344c1.488.816 3.168 1.248 4.86 1.248 5.532 0 10.012-4.48 10.012-10.012A9.97 9.97 0 0012.012 2zm5.796 14.196c-.24.672-1.2 1.224-1.656 1.284-.444.06-1.008.084-2.82-.672-2.316-.96-3.804-3.324-3.924-3.48-.108-.156-.936-1.248-.936-2.376 0-1.128.588-1.68.804-1.908.216-.228.468-.288.624-.288.156 0 .312.008.444.012.144.004.336-.056.528.408.192.48.66 1.608.72 1.728.06.12.096.264.012.432-.084.168-.18.276-.3.42-.12.144-.252.3-.36.408-.12.12-.24.252-.108.48.132.228.588.972 1.26 1.572.864.768 1.596 1.008 1.824 1.116.228.108.36.096.492-.06.132-.156.576-.672.732-.9.156-.228.312-.192.528-.108.216.084 1.38.648 1.62.768.24.12.408.18.468.288.06.108.06.624-.18 1.296z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">WhatsApp Study Group</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-8">
                Join our official WhatsApp group to get instant support, participate in daily study challenges, and receive platform updates directly.
              </p>
            </div>
            <Link
              href="https://chat.whatsapp.com/GAnA2Edibt8Dcn54nuVHtI?s=cl&p=a&ilr=0"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-6 h-11 text-xs transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)] group-hover:scale-[1.01] active:scale-[0.99] w-fit"
            >
              Join WhatsApp Group <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>

          {/* Discord Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-indigo-950/5 backdrop-blur-md p-8 flex flex-col justify-between hover:border-indigo-500/40 hover:bg-indigo-950/10 transition-all group"
          >
            <div className="absolute -right-10 -top-10 h-32 w-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:scale-125 transition-transform duration-500"></div>
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-6">
                <svg className="h-5 w-5 fill-current" viewBox="0 0 127.14 96.36">
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,52.22,6.83,77.19,77.19,0,0,0,48.92,0,105.15,105.15,0,0,0,18.48,8.07C2.71,31.58-1.54,54.65.37,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.4-5c.87-.64,1.71-1.32,2.5-2a75.48,75.48,0,0,0,72.7,0c.79.7,1.63,1.38,2.5,2a75.48,75.48,0,0,0,31.63-18.83C129.87,49.25,124.9,26.43,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.88,46,53.88,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.12,46,96.12,53,91,65.69,84.69,65.69Z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Discord Server</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-8">
                Join our Discord community to participate in voice channels, team up for study groups, share resources, and voice feedback directly to developers.
              </p>
            </div>
            <Link
              href="https://discord.gg/YneZvF38w"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold px-6 h-11 text-xs transition-all shadow-[0_0_20px_rgba(99,102,241,0.15)] group-hover:scale-[1.01] active:scale-[0.99] w-fit"
            >
              Join Discord Server <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="bg-[#08080a] border-t border-white/5 py-24 sm:py-32 relative overflow-hidden">
        <div className="mx-auto max-w-4xl px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-24">
            <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight text-white mb-6">
              Frequently asked questions
            </h2>
            <p className="text-lg sm:text-xl text-slate-400">
              Have questions? Find quick answers about EduAgent AI's features, pricing, and security.
            </p>
          </div>

          <div className="bg-white/[0.01] border border-white/5 rounded-3xl p-6 sm:p-10 max-w-3xl mx-auto">
            {faqs.map((faq) => (
              <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* WhatsApp CTA Section */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-emerald-950/10 backdrop-blur-md p-8 sm:p-12 shadow-[0_0_50px_rgba(16,185,129,0.03)]"
        >
          <div className="absolute top-0 right-0 h-40 w-40 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 h-40 w-40 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex flex-col items-center justify-center text-center gap-6 relative z-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <svg className="h-7 w-7 fill-current" viewBox="0 0 24 24">
                <path d="M12.012 2C6.48 2 2 6.48 2 12.012c0 1.764.456 3.48 1.332 5.004L2 22l5.148-1.344c1.488.816 3.168 1.248 4.86 1.248 5.532 0 10.012-4.48 10.012-10.012A9.97 9.97 0 0012.012 2zm5.796 14.196c-.24.672-1.2 1.224-1.656 1.284-.444.06-1.008.084-2.82-.672-2.316-.96-3.804-3.324-3.924-3.48-.108-.156-.936-1.248-.936-2.376 0-1.128.588-1.68.804-1.908.216-.228.468-.288.624-.288.156 0 .312.008.444.012.144.004.336-.056.528.408.192.48.66 1.608.72 1.728.06.12.096.264.012.432-.084.168-.18.276-.3.42-.12.144-.252.3-.36.408-.12.12-.24.252-.108.48.132.228.588.972 1.26 1.572.864.768 1.596 1.008 1.824 1.116.228.108.36.096.492-.06.132-.156.576-.672.732-.9.156-.228.312-.192.528-.108.216.084 1.38.648 1.62.768.24.12.408.18.468.288.06.108.06.624-.18 1.296z" />
              </svg>
            </div>
            
            <div className="max-w-md">
              <h3 className="text-xl sm:text-2xl font-semibold text-white">Prefer WhatsApp?</h3>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                Chat with EduAgent AI directly on WhatsApp. Continue your learning sessions on the go.
              </p>
            </div>

            <Link
              href={process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://wa.me/15551234567"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-8 h-12 text-sm transition-all shadow-[0_0_25px_rgba(16,185,129,0.2)] hover:scale-[1.02] active:scale-[0.98]"
            >
              Start WhatsApp Chat
            </Link>
          </div>
        </motion.div>
      </section>

      {/* CTA & Footer Section */}
      <footer className="bg-[#0a0a0a] pt-24 border-t border-white/5">
        <div className="relative overflow-hidden h-[240px] flex justify-center items-center border-b border-white/5">
          <div className="w-[2000px] md:w-[4000px] h-[800px] absolute -top-[720px] left-1/2 -translate-x-1/2 bg-gradient-to-b from-[#0a0a0a] via-[#141414] to-cyan-500/10 rounded-[100%]"></div>
          <div className="w-20 md:w-80 h-10 bg-gradient-to-l from-cyan-500/20 via-cyan-500/10 to-transparent blur-[4.95px] absolute top-1/2 -translate-y-1/2 right-[56%]"></div>
          <div className="w-20 md:w-80 h-10 bg-gradient-to-r from-cyan-500/20 via-cyan-500/10 to-transparent blur-[4.95px] absolute top-1/2 -translate-y-1/2 left-[56%]"></div>
          <div className="absolute top-1/2 -translate-y-1/2 right-1/2 w-[300px] md:w-[1000px] h-[70px] md:h-[140px] bg-gradient-to-l from-cyan-500/10 via-cyan-500/5 to-transparent blur-[60px] [clip-path:polygon(100%_50%,0_0,0_100%)] pointer-events-none z-0"></div>
          <div className="absolute top-1/2 -translate-y-1/2 left-1/2 w-[300px] md:w-[1000px] h-[70px] md:h-[140px] bg-gradient-to-r from-cyan-500/10 via-cyan-500/5 to-transparent blur-[60px] [clip-path:polygon(0_50%,100%_0,100%_100%)] pointer-events-none z-0"></div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex gap-3 justify-center relative items-center z-10"
          >
            <button 
              onClick={() => setActiveModal("signup")} 
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all text-slate-950 py-2 rounded-full h-12 px-8 text-[15px] bg-cyan-500 hover:bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:scale-[1.02]"
            >
              Get started for free
            </button>
            <button 
              onClick={() => setActiveModal("signup")}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all text-slate-950 rounded-full w-12 h-12 bg-cyan-500 hover:bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:scale-[1.02]"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
          <div className="w-[2000px] md:w-[4000px] h-[800px] absolute -bottom-[720px] left-1/2 -translate-x-1/2 rounded-[100%] pointer-events-none bg-gradient-to-t from-[#0a0a0a] via-[#141414] to-cyan-500/10"></div>
        </div>

        <div className="pt-20 pb-8 md:px-6 px-4">
          <div className="container mx-auto space-y-12">
            {/* Main Links Grid */}
            <div className="grid gap-8 grid-cols-2 md:grid-cols-4 lg:grid-cols-5 items-start">
              {/* Brand Column */}
              <div className="flex flex-col space-y-4 col-span-2">
                <div className="flex items-center gap-3">
                  <Brain className="h-9 w-9 text-cyan-500" />
                  <h3 className="text-3xl font-heading font-semibold tracking-tight text-white leading-none">EduAgent</h3>
                </div>
                <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                  Experience the most intuitive AI tutoring platform built for actual studying. Ask questions, upload PDFs, and master courses.
                </p>
              </div>

              {/* Links Column 1: Product */}
              <div className="flex flex-col space-y-4">
                <h4 className="text-white text-sm font-semibold uppercase tracking-wider">Product</h4>
                <ul className="flex flex-col space-y-3 text-sm">
                  <li><Link href="#how-it-works" className="text-slate-400 hover:text-white transition-colors">How it works</Link></li>
                  <li><Link href="#features" className="text-slate-400 hover:text-white transition-colors">Features</Link></li>
                  <li><Link href="#pricing" className="text-slate-400 hover:text-white transition-colors">Pricing</Link></li>
                </ul>
              </div>

              {/* Links Column 2: Legal */}
              <div className="flex flex-col space-y-4">
                <h4 className="text-white text-sm font-semibold uppercase tracking-wider">Legal</h4>
                <ul className="flex flex-col space-y-3 text-sm">
                  <li><Link href="#" className="text-slate-400 hover:text-white transition-colors">Privacy Policy</Link></li>
                  <li><Link href="#" className="text-slate-400 hover:text-white transition-colors">Terms of Service</Link></li>
                </ul>
              </div>

              {/* Links Column 3: Contact & Social */}
              <div className="flex flex-col space-y-4">
                <h4 className="text-white text-sm font-semibold uppercase tracking-wider">Connect</h4>
                <ul className="flex flex-col space-y-3 text-sm">
                  <li><Link href="mailto:support@eduagentai.com" className="text-slate-400 hover:text-white transition-colors">Contact Support</Link></li>
                  <li><Link href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors">GitHub</Link></li>
                </ul>
              </div>
            </div>
            
            <div className="h-[1px] w-full bg-white/10 mt-12 mb-8"></div>
            
            <div className="flex flex-col md:flex-row justify-between items-center text-sm gap-4 text-slate-500 font-medium pb-4">
              <p className="text-center md:text-left">Copyright &copy; {new Date().getFullYear()} EduAgent AI. All rights reserved.</p>
              <div className="flex items-center gap-6">
                <span className="text-slate-600">Built for student excellence</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Auth Modals */}
      <Modal isOpen={activeModal === "login"} onClose={() => setActiveModal(null)}>
        <LoginForm 
          onSwitchToSignup={() => setActiveModal("signup")} 
          onSwitchToForgot={() => setActiveModal("forgot")}
          redirectTo="/chat" 
        />
      </Modal>

      <Modal isOpen={activeModal === "signup"} onClose={() => setActiveModal(null)}>
        <SignupForm 
          onSwitchToLogin={() => setActiveModal("login")} 
          redirectTo="/chat" 
        />
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
          onSuccess={() => {
            setActiveModal("login");
          }}
        />
      </Modal>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}
