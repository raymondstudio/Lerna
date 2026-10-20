"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState, type MouseEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, Check, ChevronDown, FileText, Layers, Menu, MessageSquare, NotebookPen, UploadCloud } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";
import { ForgotPasswordModal } from "@/components/auth/forgot-password-modal";
import { ResetPasswordModal } from "@/components/auth/reset-password-modal";
import styles from "./landing.module.css";

type AuthView = "login" | "signup" | "forgot" | "reset" | null;
const navigation = [
  { label: "How it works", id: "how-it-works" },
  { label: "Features", id: "features" },
  { label: "Pricing", id: "pricing" },
  { label: "FAQ", id: "faq" },
];
const questions = [
  { question: "What can I bring to Lerna?", answer: "Upload a PDF, Word document, presentation, text file, or supported image. Connect your material to a study session, then ask questions about it." },
  { question: "Do I have to be a student?", answer: "Lerna supports students, researchers, and professionals. Choose the account type that describes your work during onboarding." },
  { question: "How do saved notes work?", answer: "Your notes belong to a study session. Wait for the Saved status before leaving, and reopen that session when you want to review or edit them." },
  { question: "Can an AI explanation be wrong?", answer: "Yes. Check important details against your original material and reliable sources. Use Lerna to explore a topic and ask follow-up questions." },
  { question: "Is the example on this page live?", answer: "The study flow is illustrative. It uses a fixed biology example and does not upload a document or send a prompt to an AI model." },
];

/** Keep query-driven authentication in its own boundary so landing content can render before JavaScript. */
function AuthQuery({ onOpen }: { onOpen: (view: AuthView) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const auth = searchParams.get("auth");
    if (auth === "login" || auth === "signup" || auth === "reset") onOpen(auth);
  }, [searchParams, onOpen]);
  return null;
}

/** Finite progressive enhancement. Content is fully visible with JS/motion disabled. */
function useLandingMotion() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !window.IntersectionObserver || !Element.prototype.animate) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Map<Element, Animation>();
    const finish = () => {
      for (const animation of animations.values()) { try { animation.finish(); } catch { animation.cancel(); } }
      animations.clear();
    };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          const active = animations.get(entry.target);
          if (active) { try { active.finish(); } catch { active.cancel(); } animations.delete(entry.target); observer.unobserve(entry.target); }
          continue;
        }
        if (animations.has(entry.target)) continue;
        if (preference.matches || document.hidden) { observer.unobserve(entry.target); continue; }
        const animation = entry.target.animate([
          { opacity: 0.72, transform: "translateY(16px)" },
          { opacity: 1, transform: "translateY(0)" },
        ], { duration: 520, easing: "cubic-bezier(.22,1,.36,1)" });
        animations.set(entry.target, animation);
        animation.onfinish = () => { animations.delete(entry.target); observer.unobserve(entry.target); };
      }
    }, { threshold: 0.12 });
    for (const target of element.querySelectorAll("[data-landing-reveal]")) observer.observe(target);
    const visibility = () => { if (document.hidden) finish(); };
    const onPreference = () => { if (preference.matches) finish(); };
    document.addEventListener("visibilitychange", visibility);
    preference.addEventListener("change", onPreference);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      preference.removeEventListener("change", onPreference);
      for (const animation of animations.values()) animation.cancel();
    };
  }, []);
  return ref;
}

function StudyFlow() {
  return <figure className={styles.studyFlow} aria-labelledby="study-flow-caption">
    <div className={styles.workspace} data-landing-reveal>
      <article className={styles.materialSheet}>
        <div className={styles.artifactHeader}><FileText size={17} aria-hidden="true" /><span>Biology study material</span><span className={styles.fileType}>PDF</span></div>
        <h2>Energy in living systems</h2>
        <p>Plants turn light energy into chemical energy through photosynthesis.</p>
        <div className={styles.sourceExcerpt}>Light + water + carbon dioxide<br /><strong>Stored energy in sugars</strong></div>
      </article>
      <article className={styles.explanationSheet}>
        <div className={styles.artifactHeader}><MessageSquare size={17} aria-hidden="true" /><span>An explanation to work with</span></div>
        <h2>Where does the energy go?</h2>
        <p>Chlorophyll captures light. The plant uses that energy to make sugars from water and carbon dioxide.</p>
        <div className={styles.reference}><BookOpen size={14} aria-hidden="true" />Connected to your material</div>
      </article>
      <article className={styles.noteSheet}>
        <div className={styles.artifactHeader}><NotebookPen size={17} aria-hidden="true" /><span>A note in your own words</span></div>
        <p>Photosynthesis stores energy in sugar, ready for the plant to use.</p>
        <div className={styles.savedExample}><Check size={15} aria-hidden="true" />Saved with the study session</div>
      </article>
    </div>
    <figcaption id="study-flow-caption">Illustrative study flow. Your material, a clearer explanation, and a note to return to.</figcaption>
  </figure>;
}

export default function HomePage() {
  const [activeModal, setActiveModal] = useState<AuthView>(null);
  const root = useLandingMotion();
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  const openAuth = (view: "login" | "signup") => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (mobileMenu.current) mobileMenu.current.open = false;
    setActiveModal(view);
  };
  const closeMenu = () => { if (mobileMenu.current) mobileMenu.current.open = false; };

  return <main ref={root} className={styles.landing}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Lerna AI",
      applicationCategory: "EducationalApplication", operatingSystem: "Web", url: "https://www.uselerna.app",
      description: "Ask questions about your learning materials and keep notes linked to study sessions.",
    }) }} />
    <a href="#main-content" className={styles.skipLink}>Skip to content</a>
    <header className={styles.header}>
      <div className={styles.navbar}>
        <Link href="/" className={styles.logo} aria-label="Lerna home">
          <Image src="/assets/lerna-full-white.png" alt="Lerna" width={128} height={44} priority className={styles.brandLogo} style={{ height: "auto" }} />
        </Link>
        <nav aria-label="Main navigation" className={styles.desktopNav}>
          {navigation.map(item => <a key={item.id} href={"#" + item.id}>{item.label}</a>)}
        </nav>
        <div className={styles.navActions}>
          <Link href="/?auth=login" onClick={openAuth("login")} className={styles.signIn}>Sign in</Link>
          <Link href="/?auth=signup" onClick={openAuth("signup")} className={styles.navSignup}>Get started <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        <details ref={mobileMenu} className={styles.mobileMenu}>
          <summary aria-label="Navigation menu"><Menu size={22} aria-hidden="true" /></summary>
          <nav aria-label="Mobile navigation">
            {navigation.map(item => <a key={item.id} href={"#" + item.id} onClick={closeMenu}>{item.label}</a>)}
            <a href="#community" onClick={closeMenu}>Community</a>
            <Link href="/?auth=signup" onClick={openAuth("signup")}>Get started <ArrowRight size={16} aria-hidden="true" /></Link>
          </nav>
        </details>
      </div>
    </header>

    <section className={styles.hero} id="main-content" tabIndex={-1} aria-labelledby="landing-title">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>A place to make sense of it.</p>
        <h1 id="landing-title"><span>Understand your materials.</span>{" "}<span>Keep what you learn.</span></h1>
        <p className={styles.heroDescription}>Ask better questions, connect the explanation to your materials, and save the ideas you want to remember.</p>
        <div className={styles.heroActions}>
          <Link href="/?auth=signup" onClick={openAuth("signup")} className={styles.primaryButton}>Get started <ArrowRight size={18} aria-hidden="true" /></Link>
          <a href="#how-it-works" className={styles.textLink}>See how it works <ChevronDown size={16} aria-hidden="true" /></a>
        </div>
      </div>
      <StudyFlow />
    </section>

    <section id="how-it-works" className={styles.section} aria-labelledby="how-title">
      <div className={styles.sectionHeading} data-landing-reveal>
        <h2 id="how-title">From a page to a clearer idea.</h2>
        <p>Choose a material, ask the next question, and keep the explanation in your own words.</p>
      </div>
      <div className={styles.workflow}>
        <article><UploadCloud size={25} strokeWidth={1.6} aria-hidden="true" /><h3>Bring your material</h3><p>Start with the notes, slides, or reading you are already working through.</p></article>
        <article><MessageSquare size={25} strokeWidth={1.6} aria-hidden="true" /><h3>Follow your questions</h3><p>Ask for an explanation, work through an example, then explore what still feels unclear.</p></article>
        <article><NotebookPen size={25} strokeWidth={1.6} aria-hidden="true" /><h3>Keep what matters</h3><p>Write a note, check that it is saved, and come back to the same session.</p></article>
      </div>
    </section>

    <section id="features" className={styles.features} aria-labelledby="features-title">
      <div className={styles.featureIntro} data-landing-reveal>
        <h2 id="features-title">Your questions have a place to go.</h2>
        <p>A conversation, its materials, and your next study session stay connected.</p>
      </div>
      <div className={styles.productFrame} data-landing-reveal>
        <Image src="/dashboard-mockup.png" alt="Lerna chat workspace showing a biology explanation, saved conversations, and study tools" width={2048} height={1220} sizes="(max-width: 767px) 100vw, (max-width: 1279px) 90vw, 1160px" className={styles.productImage} />
      </div>
      <div className={styles.featureNotes}>
        <article><MessageSquare size={20} aria-hidden="true" /><h3>Ask the follow-up</h3><p>Keep the conversation with your AI tutor in one place.</p></article>
        <article><Layers size={20} aria-hidden="true" /><h3>Return with context</h3><p>Reopen a saved session and its connected materials.</p></article>
        <article><NotebookPen size={20} aria-hidden="true" /><h3>Make it your own</h3><p>Keep editable notes alongside your study work.</p></article>
      </div>
    </section>

    <section id="pricing" className={styles.pricing} aria-labelledby="pricing-title">
      <div data-landing-reveal><p className={styles.eyebrow}>Room to begin.</p><h2 id="pricing-title">Start with the free plan.</h2><p>Explore tutoring, upload a material, and create your first study session. Your account shows your current usage allowance.</p></div>
      <div className={styles.freePlan}><div className={styles.price}><span>Free</span><strong>₦0</strong></div><p>AI and upload limits apply.</p><Link href="/?auth=signup" onClick={openAuth("signup")} className={styles.primaryButton}>Get started <ArrowRight size={18} aria-hidden="true" /></Link></div>
    </section>

    <section id="faq" className={styles.faq} aria-labelledby="faq-title">
      <h2 id="faq-title">A few things to know.</h2>
      <div>{questions.map(item => <details key={item.question}><summary>{item.question}<ChevronDown size={18} aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</div>
    </section>

    <section id="community" className={styles.community} aria-labelledby="community-title">
      <div><h2 id="community-title">Learning can be a conversation.</h2><p>Meet other learners, ask for help, and share feedback with the Lerna community.</p></div>
      <div className={styles.communityLinks}>
        <a href="https://chat.whatsapp.com/GAnA2Edibt8Dcn54nuVHtI?s=cl&p=a&ilr=0" target="_blank" rel="noopener noreferrer">WhatsApp study group <ArrowRight size={17} aria-hidden="true" /><span className={styles.visuallyHidden}> (opens in a new tab)</span></a>
        <a href="https://discord.gg/YneZvF38w" target="_blank" rel="noopener noreferrer">Discord community <ArrowRight size={17} aria-hidden="true" /><span className={styles.visuallyHidden}> (opens in a new tab)</span></a>
      </div>
    </section>

    <footer className={styles.footer}>
      <Link href="/" aria-label="Lerna home"><Image src="/assets/lerna-full-white.png" alt="Lerna" width={112} height={38} className={styles.brandLogo} style={{ height: "auto" }} /></Link>
      <p>For the things you want to understand.</p>
      <nav aria-label="Footer navigation"><Link href="/privacy-policy">Privacy policy</Link><a href="mailto:support@uselerna.app">Contact support</a><a href="#community">Community</a></nav>
      <small>© {new Date().getFullYear()} Lerna AI</small>
    </footer>

    <Suspense fallback={null}><AuthQuery onOpen={setActiveModal} /></Suspense>
    <Modal isOpen={activeModal === "login"} onClose={() => setActiveModal(null)}><LoginForm onSwitchToSignup={() => setActiveModal("signup")} onSwitchToForgot={() => setActiveModal("forgot")} redirectTo="/chat" /></Modal>
    <Modal isOpen={activeModal === "signup"} onClose={() => setActiveModal(null)}><SignupForm onSwitchToLogin={() => setActiveModal("login")} redirectTo="/chat" /></Modal>
    <Modal isOpen={activeModal === "forgot"} onClose={() => setActiveModal(null)}><ForgotPasswordModal onSwitchToLogin={() => setActiveModal("login")} onClose={() => setActiveModal(null)} /></Modal>
    <Modal isOpen={activeModal === "reset"} onClose={() => setActiveModal(null)}><ResetPasswordModal onClose={() => setActiveModal(null)} onSuccess={() => setActiveModal("login")} /></Modal>
  </main>;
}
