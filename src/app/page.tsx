"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
const RobotCanvas = dynamic(() => import("@/components/3d/RobotCanvas").then(mod => mod.RobotCanvas), { ssr: false });
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
  Sun,
  Moon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";
import { ForgotPasswordModal } from "@/components/auth/forgot-password-modal";
import { ResetPasswordModal } from "@/components/auth/reset-password-modal";
import { useTheme } from "next-themes";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10" />;
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 transition-colors"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

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
    description: "Perfect for trying out Lerna AI.",
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
    quote: "Lerna completely changed how I study for midterms. I uploaded 50 pages of biology slides and it explained the Krebs cycle better than my textbook.",
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
    answer: "Yes! Lerna AI offers a robust Free plan that lets you sign up, upload study materials, chat with your AI tutor, and access persistent session history."
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
    <div className="border-b border-white/5 last:border-0 py-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left focus:outline-none group"
      >
        <span className="text-lg font-medium text-slate-200 group-hover:text-white transition-colors pr-8">
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "backOut" }}
          className="flex items-center justify-center h-8 w-8 rounded-full bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white transition-colors shrink-0"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="text-base text-slate-400 leading-relaxed pt-4 pr-12">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DemoChat() {
  const [messages, setMessages] = useState<{role: "user" | "ai", content: string}[]>([
    {
      role: "ai",
      content: "Hello! I'm your Lerna AI tutor. I can help you understand complex topics, summarize your lecture notes, or create practice quizzes. What would you like to study today?"
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const starters = [
    "Explain quantum computing in simple terms",
    "What is the difference between active and passive transport?",
    "Give me a quick analogy for recursive programming",
  ];

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    
    // Add user message
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setInputValue("");
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      let aiResponse = "That's a great question! Based on your study materials, here is a breakdown...";
      if (text.toLowerCase().includes("quantum")) {
        aiResponse = "Imagine a coin spinning in the air. While it's spinning, it's both heads and tails at the same time. That's similar to a qubit in quantum computing—it can exist in multiple states simultaneously (superposition) until you measure it!";
      } else if (text.toLowerCase().includes("transport")) {
        aiResponse = "Think of a hill. Passive transport is like rolling a ball down the hill (no energy needed). Active transport is like pushing the ball up the hill (requires ATP energy to move against the concentration gradient).";
      } else if (text.toLowerCase().includes("recursive")) {
        aiResponse = "Recursive programming is like looking into two mirrors facing each other. An image contains a smaller version of itself, which contains a smaller version of itself, until it reaches the edge (the base case) where it stops!";
      }
      
      setMessages(prev => [...prev, { role: "ai", content: aiResponse }]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="w-full max-w-4xl mx-auto rounded-[2.5rem] border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-3xl p-2 shadow-2xl relative overflow-hidden group">
      {/* Glossy top edge highlight */}
      <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-black/20 dark:via-white/20 to-transparent" />
      
      <div className="bg-slate-50 dark:bg-[#111] rounded-[2rem] border border-slate-200 dark:border-white/5 p-6 sm:p-8 relative overflow-hidden h-full flex flex-col">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-cyan-500/5 blur-[100px] pointer-events-none" />
        
        <div className="flex items-center justify-between mb-8 relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-teal-400/5 border border-cyan-500/20 text-cyan-500 dark:text-cyan-400 shadow-inner">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">Interactive AI Tutor</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Powered by Lerna Intelligence</p>
            </div>
          </div>
          <div className="hidden sm:flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-white/10" />
            <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-white/10" />
            <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-white/10" />
          </div>
        </div>

        {/* Messages area */}
        <div className="space-y-6 mb-8 flex-1 relative z-10 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "ai" ? "bg-cyan-500/20 border border-cyan-500/30" : "bg-emerald-500/20 border border-emerald-500/30"}`}>
                {msg.role === "ai" ? (
                  <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                ) : (
                  <div className="w-4 h-4 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center">U</div>
                )}
              </div>
              <div className={`border rounded-2xl p-4 text-sm leading-relaxed max-w-[85%] ${
                msg.role === "ai" 
                  ? "bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 rounded-tl-sm text-slate-700 dark:text-slate-200" 
                  : "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 rounded-tr-sm text-emerald-900 dark:text-emerald-100"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl rounded-tl-sm p-4 flex items-center gap-1.5">
                <div className="w-2 h-2 bg-cyan-500/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-cyan-500/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-cyan-500/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>

        <div className="relative z-10 mt-auto">
          {/* Starters */}
          {messages.length === 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {starters.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => handleSend(starter)}
                  className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-full px-4 py-2 transition-all text-left"
                >
                  {starter}
                </button>
              ))}
            </div>
          )}

          {/* Input row */}
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }}
            className="flex gap-3 relative group/input"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-teal-500/20 rounded-2xl blur-xl opacity-0 group-hover/input:opacity-100 transition-opacity duration-500" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a study question..."
              className="relative flex-1 bg-white dark:bg-black/60 backdrop-blur-sm border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors shadow-inner"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="relative h-auto px-6 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-black font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
            >
              Ask <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
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
    <main className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] text-slate-900 dark:text-slate-200 selection:bg-cyan-500/30 font-body overflow-x-hidden [&_*]:[animation:none!important] [&_*]:[transition:none!important]">
      {/* Structured Data JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Lerna AI",
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
      <nav
        className="absolute md:fixed top-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-5xl z-50 rounded-full border border-slate-200 dark:border-white/5 bg-white/70 dark:bg-white/[0.02] backdrop-blur-2xl shadow-xl dark:shadow-[0_30px_60px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center justify-between px-3 py-2 sm:px-4">
          <div className="flex items-center gap-3 pl-2">
            <Image
              src="/assets/lerna-full-white.png"
              alt="Lerna"
              width={180}
              height={40}
              className="h-7 w-auto object-contain dark:invert-0 invert"
              priority
            />
          </div>
          
          <div className="hidden md:flex items-center gap-8 bg-slate-100/50 dark:bg-white/[0.03] px-8 py-2.5 rounded-full border border-slate-200 dark:border-white/5">
            <Link href="#how-it-works" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors">How it works</Link>
            <Link href="#features" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors">Features</Link>
            <Link href="#pricing" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors">Pricing</Link>
            <Link href="#faq" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors">FAQ</Link>
          </div>
          
          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            <button onClick={() => setActiveModal("login")} className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-4">
              Sign in
            </button>
            <Button onClick={() => setActiveModal("signup")} className="bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-200 rounded-full px-6 h-10 text-sm font-semibold transition-all">
              Get started
            </Button>
          </div>
          
          {/* Mobile Hamburger menu toggle */}
          <div className="flex md:hidden items-center gap-2 pr-2">
            <ThemeToggle />
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex items-center justify-center p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
        
        {/* Mobile Dropdown Panel */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <div
              className="md:hidden absolute top-[calc(100%+0.5rem)] left-0 right-0 rounded-[2rem] border border-slate-200 dark:border-white/5 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-3xl p-6 shadow-2xl flex flex-col gap-6 z-40 overflow-hidden"
            >
              <div className="flex flex-col gap-4">
                <Link 
                  href="#how-it-works" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium transition-colors text-base py-2 border-b border-slate-100 dark:border-white/5"
                >
                  How it works
                </Link>
                <Link 
                  href="#features" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium transition-colors text-base py-2 border-b border-slate-100 dark:border-white/5"
                >
                  Features
                </Link>
                <Link 
                  href="#pricing" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium transition-colors text-base py-2 border-b border-slate-100 dark:border-white/5"
                >
                  Pricing
                </Link>
                <Link 
                  href="#faq" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium transition-colors text-base py-2"
                >
                  FAQ
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={() => { setIsMobileMenuOpen(false); setActiveModal("login"); }} className="w-full text-center text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold py-3 border border-slate-200 dark:border-white/10 rounded-full hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-base">Sign in</button>
                <Button onClick={() => { setIsMobileMenuOpen(false); setActiveModal("signup"); }} className="w-full bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-200 rounded-full py-6 font-semibold text-base justify-center transition-all">Get started <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="relative mx-auto max-w-7xl px-6 pt-40 sm:pt-48 pb-20 overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[800px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-400/20 via-teal-400/10 dark:from-cyan-500/10 dark:via-teal-500/5 to-transparent blur-[120px] pointer-events-none z-0" />
        
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex flex-col items-start text-left"
          >
            <h1 className="font-heading text-5xl sm:text-7xl lg:text-[4.5rem] xl:text-[5rem] font-semibold tracking-tight text-slate-900 dark:text-white mb-8 text-balance max-w-5xl leading-[1.05]">
              Learn <span className="bg-gradient-to-r from-slate-800 via-cyan-600 to-cyan-500 dark:from-white dark:via-cyan-100 dark:to-cyan-300 bg-clip-text text-transparent">smarter</span>,<br className="hidden sm:block" /> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-500 blur-[1px] relative inline-block after:absolute after:inset-0 after:bg-blue-500/10 dark:after:bg-blue-500/20 after:blur-xl after:-z-10">not harder.</span>
            </h1>
            <p className="max-w-2xl text-lg sm:text-xl text-slate-600 dark:text-slate-400 mb-12 text-balance leading-relaxed">
              Upload your dense lecture material and let our AI tutor break it down. Build interactive revision plans and master complex topics in half the time.
            </p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col sm:flex-row items-center justify-start gap-4 mb-12 lg:mb-0 relative z-10 w-full sm:w-auto"
            >
              <Button onClick={() => setActiveModal("signup")} className="bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-200 rounded-full px-8 h-14 text-base font-semibold w-full sm:w-auto shadow-xl dark:shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:scale-[1.02] active:scale-[0.98] transition-all">
                Start studying for free
              </Button>
              <Link href="#features" className="w-full sm:w-auto">
                <Button variant="outline" className="border-slate-300 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-900 dark:text-white rounded-full px-8 h-14 text-base font-semibold w-full backdrop-blur-md transition-all">
                  Explore capabilities <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 perspective-1000 w-full"
          >
            <DemoChat />
          </motion.div>
        </div>
      </section>
      {/* How It Works Section */}
      <section id="how-it-works" className="py-32 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 h-[400px] w-[400px] bg-cyan-500/10 dark:bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="mb-20">
            <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white mb-6">
              Three simple steps to <span className="text-cyan-600 dark:text-cyan-400">smarter learning</span>
            </h2>
            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl">
              No complicated configuration. Upload your materials and start learning in seconds.
            </p>
          </div>

          <div className="bg-slate-100 dark:bg-[#111] border border-slate-200 dark:border-white/5 rounded-[3rem] p-4 sm:p-6 lg:p-8 relative">
            {/* Subtle inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/50 dark:from-white/[0.02] to-transparent rounded-[3rem] pointer-events-none" />
            
            <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 relative z-10">
              {steps.map((step, idx) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: idx * 0.15 }}
                  className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5 rounded-[2rem] p-8 sm:p-10 flex flex-col justify-between hover:bg-slate-50 dark:hover:bg-[#0c0c0c] transition-colors relative overflow-hidden group shadow-sm dark:shadow-none"
                >
                  <div className="absolute -right-12 -top-12 text-[12rem] font-bold text-slate-900/[0.03] dark:text-white/[0.02] group-hover:text-cyan-500/[0.05] dark:group-hover:text-cyan-500/[0.02] transition-colors pointer-events-none leading-none select-none">
                    {step.number}
                  </div>
                  <div className="relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-xl font-bold text-cyan-600 dark:text-cyan-400 mb-8 shadow-inner">
                      {step.number}
                    </div>
                    <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4 tracking-tight">{step.title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Bento Box */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-24 sm:py-32 overflow-hidden">
        <div className="mb-20">
          <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white mb-6">
            Everything you need in a <br className="hidden sm:block" />
            <span className="text-cyan-600 dark:text-cyan-400">personal AI tutor</span>
          </h2>
          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl">
            A comprehensive study suite built to help you review, test, and master your coursework using advanced AI models.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 auto-rows-[280px]">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            
            // Assign specific grid spans to create a bento box layout
            let spanClass = "col-span-1 md:col-span-1 lg:col-span-1 row-span-1";
            let bgClass = "bg-white dark:bg-[#111]";
            let innerContent = null;
            
            if (i === 0) {
              // AI Tutor - large showcase card
              spanClass = "col-span-1 md:col-span-2 lg:col-span-2 row-span-2";
              bgClass = "bg-gradient-to-br from-white to-slate-50 dark:from-[#111] dark:to-[#0a1a2a]";
              innerContent = (
                <div className="absolute right-0 bottom-0 w-3/4 h-2/3 bg-slate-100/50 dark:bg-black/40 border-t border-l border-slate-200 dark:border-white/10 rounded-tl-3xl backdrop-blur-md p-6 overflow-hidden hidden sm:block">
                  <div className="flex flex-col gap-4">
                    <div className="bg-white dark:bg-white/5 rounded-2xl p-4 w-4/5 ml-auto border border-slate-200 dark:border-white/5">
                      <div className="h-2 w-1/2 bg-slate-200 dark:bg-white/10 rounded-full mb-2"></div>
                      <div className="h-2 w-3/4 bg-slate-200 dark:bg-white/10 rounded-full"></div>
                    </div>
                    <div className="bg-cyan-50 dark:bg-cyan-500/10 rounded-2xl p-4 w-4/5 mr-auto border border-cyan-100 dark:border-cyan-500/20">
                      <div className="h-2 w-full bg-cyan-200 dark:bg-cyan-400/20 rounded-full mb-2"></div>
                      <div className="h-2 w-2/3 bg-cyan-200 dark:bg-cyan-400/20 rounded-full"></div>
                    </div>
                  </div>
                </div>
              );
            } else if (i === 1) {
               // Upload
               spanClass = "col-span-1 md:col-span-1 lg:col-span-2 row-span-1";
            } else if (i === 2) {
               // Document analysis
               spanClass = "col-span-1 md:col-span-1 lg:col-span-1 row-span-1";
            } else if (i === 3) {
               // Study Plans
               spanClass = "col-span-1 md:col-span-2 lg:col-span-2 row-span-1";
            } else if (i === 4) {
               // Flashcards
               spanClass = "col-span-1 md:col-span-1 lg:col-span-1 row-span-1";
            }

            return (
              <motion.div 
                key={feature.title} 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className={`relative ${bgClass} border border-slate-200 dark:border-white/5 p-8 rounded-[2rem] overflow-hidden group hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-colors ${spanClass} flex flex-col justify-between shadow-sm dark:shadow-none`}
              >
                <div className="absolute inset-0 bg-black/[0.01] dark:bg-white/[0.01] opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white shadow-inner group-hover:bg-cyan-100 dark:group-hover:bg-cyan-500/10 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 group-hover:border-cyan-200 dark:group-hover:border-cyan-500/20 transition-all duration-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    {feature.isComingSoon && (
                      <span className="text-[10px] uppercase tracking-wider bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 font-bold px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <h3 className={`font-semibold text-slate-900 dark:text-white mb-2 tracking-tight ${i === 0 ? 'text-3xl' : 'text-xl'}`}>
                    {feature.title}
                  </h3>
                  <p className={`text-slate-600 dark:text-slate-400 leading-relaxed ${i === 0 ? 'text-lg max-w-sm' : 'text-sm'}`}>
                    {feature.description}
                  </p>
                </div>
                
                {innerContent}
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] bg-cyan-500/10 dark:bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-24">
            <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white mb-6">
              Simple, transparent pricing
            </h2>
            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400">
              Start studying for free. Lock in advanced capabilities as they launch.
            </p>
          </div>

          <div className="grid gap-6 max-w-5xl mx-auto md:grid-cols-2 lg:grid-cols-3 items-stretch">
            {pricingPlans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.15 }}
                className={`flex flex-col justify-between p-8 sm:p-10 relative overflow-hidden transition-all group ${
                  plan.isComingSoon 
                    ? "bg-slate-100 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5 rounded-[2.5rem]" 
                    : "bg-white dark:bg-gradient-to-b dark:from-[#111] dark:to-[#0c141c] border border-cyan-200 dark:border-cyan-500/20 rounded-[2.5rem] shadow-xl dark:shadow-[0_0_80px_rgba(6,182,212,0.05)] scale-100 md:scale-105 z-10"
                }`}
              >
                {/* Subtle inner highlight */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/50 dark:from-white/[0.04] to-transparent pointer-events-none" />
                
                {plan.isComingSoon && (
                  <div className="absolute top-6 right-6 bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
                    Coming Soon
                  </div>
                )}
                <div className="relative z-10">
                  <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">{plan.name}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-8 h-10">{plan.description}</p>
                  <div className="flex items-baseline gap-1 mb-8 pb-8 border-b border-slate-200 dark:border-white/10">
                    <span className="text-5xl font-bold text-slate-900 dark:text-white tracking-tight">{plan.price}</span>
                    {plan.period && <span className="text-slate-500 dark:text-slate-400 text-lg">{plan.period}</span>}
                  </div>
                  
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-slate-700 dark:text-slate-300 text-sm sm:text-base">
                        <CheckCircle2 className={`h-5 w-5 shrink-0 mt-0.5 ${plan.isComingSoon ? "text-slate-400 dark:text-slate-500" : "text-cyan-500 dark:text-cyan-400"}`} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="relative z-10 mt-auto">
                  <Button
                    disabled={plan.isComingSoon}
                    onClick={() => !plan.isComingSoon && setActiveModal("signup")}
                    className={`w-full h-14 rounded-2xl text-base font-semibold transition-all ${
                      plan.isComingSoon
                        ? "bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-500 cursor-not-allowed"
                        : "bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 hover:bg-cyan-500 dark:hover:bg-cyan-400 shadow-lg dark:shadow-[0_0_20px_rgba(6,182,212,0.25)] dark:hover:shadow-[0_0_30px_rgba(6,182,212,0.4)]"
                    }`}
                  >
                    {plan.buttonText}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-24">
          <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white mb-6">
            Loved by students everywhere
          </h2>
          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400">
            See how Lerna AI is helping college and university students study smarter.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t, idx) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: idx * 0.1 }}
              className="bg-white dark:bg-[#111] border border-slate-200 dark:border-white/5 rounded-[2rem] p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden group hover:border-cyan-300 dark:hover:border-cyan-500/20 transition-all shadow-sm dark:shadow-none"
            >
              <div className="absolute inset-0 bg-black/[0.01] dark:bg-white/[0.01] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="flex gap-1 mb-8 text-cyan-500 dark:text-cyan-400">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-current" />
                  ))}
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-base sm:text-lg leading-relaxed mb-10">
                  "{t.quote}"
                </p>
              </div>
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center font-bold text-slate-900 dark:text-white text-sm">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{t.name}</h4>
                  <p className="text-slate-500 text-xs mt-0.5">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Community Section */}
      {/* Community Section */}
      <section id="community" className="mx-auto max-w-6xl px-6 py-24 sm:py-32 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-4 py-1.5 text-xs sm:text-sm font-medium text-cyan-600 dark:text-cyan-300 mb-6 hover:bg-cyan-500/10 transition-colors backdrop-blur-sm"
          >
            <Users className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Lerna Community</span>
          </motion.div>
          <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white mb-6">
            Join the Community
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Connect, collaborate, and share knowledge with thousands of students worldwide.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* WhatsApp Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-[2.5rem] border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-950/20 p-10 flex flex-col justify-between group hover:border-emerald-400 dark:hover:border-emerald-500/40 transition-all shadow-sm dark:shadow-none"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
            <div className="absolute -right-20 -top-20 h-64 w-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-emerald-500/20 transition-colors duration-500"></div>
            <div className="relative z-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 mb-8 shadow-inner group-hover:scale-110 transition-transform duration-300">
                <svg className="h-7 w-7 fill-current" viewBox="0 0 24 24">
                  <path d="M12.012 2C6.48 2 2 6.48 2 12.012c0 1.764.456 3.48 1.332 5.004L2 22l5.148-1.344c1.488.816 3.168 1.248 4.86 1.248 5.532 0 10.012-4.48 10.012-10.012A9.97 9.97 0 0012.012 2zm5.796 14.196c-.24.672-1.2 1.224-1.656 1.284-.444.06-1.008.084-2.82-.672-2.316-.96-3.804-3.324-3.924-3.48-.108-.156-.936-1.248-.936-2.376 0-1.128.588-1.68.804-1.908.216-.228.468-.288.624-.288.156 0 .312.008.444.012.144.004.336-.056.528.408.192.48.66 1.608.72 1.728.06.12.096.264.012.432-.084.168-.18.276-.3.42-.12.144-.252.3-.36.408-.12.12-.24.252-.108.48.132.228.588.972 1.26 1.572.864.768 1.596 1.008 1.824 1.116.228.108.36.096.492-.06.132-.156.576-.672.732-.9.156-.228.312-.192.528-.108.216.084 1.38.648 1.62.768.24.12.408.18.468.288.06.108.06.624-.18 1.296z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-3">WhatsApp Study Group</h3>
              <p className="text-base text-slate-600 dark:text-emerald-100/60 leading-relaxed mb-10 max-w-sm">
                Get instant support, participate in daily study challenges, and receive platform updates directly.
              </p>
            </div>
            <Link
              href="https://chat.whatsapp.com/GAnA2Edibt8Dcn54nuVHtI?s=cl&p=a&ilr=0"
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-emerald-950 font-bold px-6 h-12 text-sm transition-all shadow-lg dark:shadow-[0_0_30px_rgba(16,185,129,0.2)] w-fit"
            >
              Join WhatsApp Group <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>

          {/* Discord Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative overflow-hidden rounded-[2.5rem] border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-950/20 p-10 flex flex-col justify-between group hover:border-indigo-400 dark:hover:border-indigo-500/40 transition-all shadow-sm dark:shadow-none"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
            <div className="absolute -right-20 -top-20 h-64 w-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-indigo-500/20 transition-colors duration-500"></div>
            <div className="relative z-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 mb-8 shadow-inner group-hover:scale-110 transition-transform duration-300">
                <svg className="h-6 w-6 fill-current" viewBox="0 0 127.14 96.36">
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,52.22,6.83,77.19,77.19,0,0,0,48.92,0,105.15,105.15,0,0,0,18.48,8.07C2.71,31.58-1.54,54.65.37,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.4-5c.87-.64,1.71-1.32,2.5-2a75.48,75.48,0,0,0,72.7,0c.79.7,1.63,1.38,2.5,2a75.48,75.48,0,0,0,31.63-18.83C129.87,49.25,124.9,26.43,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.88,46,53.88,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.12,46,96.12,53,91,65.69,84.69,65.69Z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-3">Discord Server</h3>
              <p className="text-base text-slate-600 dark:text-indigo-100/60 leading-relaxed mb-10 max-w-sm">
                Participate in voice channels, team up for study groups, and voice feedback directly to developers.
              </p>
            </div>
            <Link
              href="https://discord.gg/YneZvF38w"
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-500 dark:hover:bg-indigo-400 text-white font-bold px-6 h-12 text-sm transition-all shadow-lg dark:shadow-[0_0_30px_rgba(99,102,241,0.2)] w-fit"
            >
              Join Discord Server <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>


      {/* FAQ Section */}
      <section id="faq" className="py-24 sm:py-32 relative overflow-hidden">
        <div className="mx-auto max-w-4xl px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-24">
            <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white mb-6">
              Frequently asked questions
            </h2>
            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400">
              Have questions? Find quick answers about Lerna AI's features, pricing, and security.
            </p>
          </div>

          <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 sm:p-12 max-w-3xl mx-auto shadow-2xl relative">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-100/50 dark:from-white/[0.02] to-transparent pointer-events-none rounded-[2.5rem]" />
            <div className="relative z-10">
              {faqs.map((faq) => (
                <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WhatsApp CTA Section */}
      <section className="mx-auto max-w-5xl px-6 py-20 text-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-[3rem] border border-emerald-200 dark:border-emerald-500/20 bg-white dark:bg-[#111] p-10 sm:p-16 shadow-2xl"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-50 dark:from-emerald-500/[0.02] to-transparent pointer-events-none" />
          <div className="absolute top-0 right-0 h-64 w-64 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 h-64 w-64 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>
          
          <div className="flex flex-col items-center justify-center text-center gap-8 relative z-10">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 shadow-inner">
              <svg className="h-10 w-10 fill-current" viewBox="0 0 24 24">
                <path d="M12.012 2C6.48 2 2 6.48 2 12.012c0 1.764.456 3.48 1.332 5.004L2 22l5.148-1.344c1.488.816 3.168 1.248 4.86 1.248 5.532 0 10.012-4.48 10.012-10.012A9.97 9.97 0 0012.012 2zm5.796 14.196c-.24.672-1.2 1.224-1.656 1.284-.444.06-1.008.084-2.82-.672-2.316-.96-3.804-3.324-3.924-3.48-.108-.156-.936-1.248-.936-2.376 0-1.128.588-1.68.804-1.908.216-.228.468-.288.624-.288.156 0 .312.008.444.012.144.004.336-.056.528.408.192.48.66 1.608.72 1.728.06.12.096.264.012.432-.084.168-.18.276-.3.42-.12.144-.252.3-.36.408-.12.12-.24.252-.108.48.132.228.588.972 1.26 1.572.864.768 1.596 1.008 1.824 1.116.228.108.36.096.492-.06.132-.156.576-.672.732-.9.156-.228.312-.192.528-.108.216.084 1.38.648 1.62.768.24.12.408.18.468.288.06.108.06.624-.18 1.296z" />
              </svg>
            </div>
            
            <div className="max-w-xl">
              <h3 className="text-3xl sm:text-4xl font-semibold text-slate-900 dark:text-white mb-4 tracking-tight">Prefer WhatsApp?</h3>
              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                Chat with Lerna AI directly on WhatsApp. Continue your learning sessions on the go without downloading another app.
              </p>
            </div>

            <Link
              href={process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://wa.me/15551234567"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-emerald-950 font-bold px-10 h-14 text-base transition-all shadow-lg dark:shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:scale-[1.02] active:scale-[0.98]"
            >
              Start WhatsApp Chat
            </Link>
          </div>
        </motion.div>
      </section>

      {/* CTA & Footer Section */}
      <footer className="bg-slate-50 dark:bg-[#0a0a0a] pt-32 pb-12 relative overflow-hidden">
        {/* Soft top gradient */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-white/10 to-transparent" />
        
        <div className="mx-auto max-w-7xl px-6 relative z-10 mb-32 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col items-center"
          >
            <h2 className="text-5xl sm:text-7xl font-bold text-slate-900 dark:text-white tracking-tight mb-8">Ready to <span className="text-cyan-600 dark:text-cyan-400">excel?</span></h2>
            <div className="flex gap-4 justify-center items-center">
              <Button 
                onClick={() => setActiveModal("signup")} 
                className="bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-200 rounded-full px-10 h-16 text-lg font-semibold transition-all shadow-xl dark:shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:scale-[1.02]"
              >
                Get started for free
              </Button>
            </div>
          </motion.div>
        </div>

        <div className="mx-auto max-w-7xl px-6">
          <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-white/5 rounded-[3rem] p-12 sm:p-16 shadow-sm dark:shadow-none">
            <div className="grid gap-12 lg:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-5 items-start">
              {/* Brand Column */}
              <div className="flex flex-col space-y-6 lg:col-span-2">
                <Image
                  src="/assets/lerna-full-white.png"
                  alt="Lerna"
                  width={160}
                  height={40}
                  className="h-8 w-auto object-contain dark:invert-0 invert"
                />
                <p className="text-slate-600 dark:text-slate-400 text-base max-w-sm leading-relaxed">
                  Experience the most intuitive AI tutoring platform built for actual studying. Ask questions, upload PDFs, and master courses.
                </p>
              </div>

              {/* Links Column 1: Product */}
              <div className="flex flex-col space-y-6">
                <h4 className="text-slate-900 dark:text-white text-sm font-semibold uppercase tracking-wider">Product</h4>
                <ul className="flex flex-col space-y-4 text-sm">
                  <li><Link href="#how-it-works" className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-white transition-colors">How it works</Link></li>
                  <li><Link href="#features" className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-white transition-colors">Features</Link></li>
                  <li><Link href="#pricing" className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-white transition-colors">Pricing</Link></li>
                </ul>
              </div>

              {/* Links Column 2: Legal */}
              <div className="flex flex-col space-y-6">
                <h4 className="text-slate-900 dark:text-white text-sm font-semibold uppercase tracking-wider">Legal</h4>
                <ul className="flex flex-col space-y-4 text-sm">
                  <li><Link href="/privacy-policy" className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-white transition-colors">Privacy Policy</Link></li>
                  <li><Link href="#" className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-white transition-colors">Terms of Service</Link></li>
                </ul>
              </div>

              {/* Links Column 3: Connect */}
              <div className="flex flex-col space-y-6">
                <h4 className="text-slate-900 dark:text-white text-sm font-semibold uppercase tracking-wider">Connect</h4>
                <ul className="flex flex-col space-y-4 text-sm">
                  <li><Link href="mailto:support@uselerna.app" className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-white transition-colors">Contact Support</Link></li>
                  <li><Link href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-white transition-colors">GitHub</Link></li>
                </ul>
              </div>
            </div>
            
            <div className="h-px w-full bg-slate-200 dark:bg-white/5 my-12"></div>
            
            <div className="flex flex-col md:flex-row justify-between items-center text-sm gap-4 text-slate-500 font-medium">
              <p>Copyright &copy; {new Date().getFullYear()} Lerna AI. All rights reserved.</p>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-slate-500 dark:text-slate-400">Learn Smarter with Lerna AI</span>
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
      <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-cyan-500 border-t-transparent"></div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}
