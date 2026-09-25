"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { 
  Brain, 
  BookOpen, 
  Timer, 
  GraduationCap, 
  LogOut, 
  PanelLeftClose, 
  PanelLeftOpen, 
  Menu, 
  Plus,
  Search,
  User,
  Loader2,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConversationActions } from "@/components/chat/ConversationActions";
import { useAuth } from "@/hooks/use-auth";
import { useDashboard } from "@/context/dashboard-context";
import type { StudySessionRecord } from "@/lib/study-sessions/types";

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, profile } = useAuth();
  
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    loadingSessions,
    sidebarOpen,
    setSidebarOpen,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    deleteSession,
  } = useDashboard();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudySessionRecord[]>([]);
  const [searchingSessions, setSearchingSessions] = useState(false);
  const [sessionSearchError, setSessionSearchError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deletingSession, setDeletingSession] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const mobileDrawerRef = useRef<HTMLElement>(null);

  const filteredSessions = useMemo(() => {
    const norm = searchQuery.trim().toLowerCase();
    if (!norm) return sessions;
    return searchResults;
  }, [searchQuery, searchResults, sessions]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchingSessions(false);
      setSessionSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearchingSessions(true);
      setSessionSearchError(null);
      try {
        const params = new URLSearchParams({ summary: "true", limit: "30", query });
        const response = await fetch(`/api/study-sessions?${params}`, { signal: controller.signal });
        const payload = (await response.json()) as {
          success?: boolean;
          data?: { sessions?: StudySessionRecord[] };
          error?: { message?: string };
        };
        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message || "Conversations could not be searched.");
        }
        setSearchResults(payload.data?.sessions ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setSearchResults([]);
          setSessionSearchError(error instanceof Error ? error.message : "Conversations could not be searched.");
        }
      } finally {
        if (!controller.signal.aborted) setSearchingSessions(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      mobileDrawerRef.current?.querySelector<HTMLElement>("button, a, input")?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileSidebarOpen(false);
        return;
      }
      if (event.key === "Tab" && mobileDrawerRef.current) {
        const focusable = Array.from(
          mobileDrawerRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [mobileSidebarOpen, setMobileSidebarOpen]);

  const navItems = [
    { name: "Chat Tutor", href: "/chat", icon: Brain },
    { name: "Study Session", href: "/study", icon: Timer },
    { name: "Courses Hub", href: "/courses", icon: BookOpen },
    { name: "AI Quizzes", href: "/quiz", icon: GraduationCap },
  ];

  const handleNewChatClick = () => {
    setActiveSessionId(null);
    router.push("/chat");
    if (window.innerWidth < 768) setMobileSidebarOpen(false);
  };

  const handleSessionClick = (id: string) => {
    setActiveSessionId(id);
    router.push(`/chat?session=${id}`);
    if (window.innerWidth < 768) setMobileSidebarOpen(false);
  };

  const handleDeleteRequest = (id: string, title: string) => {
    setDeleteError(null);
    setDeleteTarget({ id, title: title || "Untitled conversation" });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deletingSession) return;
    const deletingActiveSession = deleteTarget.id === activeSessionId;
    setDeletingSession(true);
    setDeleteError(null);

    try {
      await deleteSession(deleteTarget.id);
      setSearchResults((current) => current.filter((session) => session.id !== deleteTarget.id));
      setDeleteTarget(null);
      if (deletingActiveSession) router.replace("/chat");
      if (window.innerWidth < 768) setMobileSidebarOpen(false);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Unable to delete this conversation.");
    } finally {
      setDeletingSession(false);
    }
  };

  const showSessionListLoading = loadingSessions && sessions.length === 0;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#141414] text-slate-200">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <Image
            src="/assets/lerna-full-white.png"
            alt="Lerna"
            width={128}
            height={50}
            className="h-12 w-auto object-contain"
          />
        </Link>
        <Button
          onClick={() => {
            if (window.innerWidth < 768) setMobileSidebarOpen(false);
            else setSidebarOpen(false);
          }}
          variant="ghost"
          size="icon"
          aria-label="Close sidebar"
          className="flex h-11 w-11 text-slate-400 hover:text-slate-200 hover:bg-[#202020] shrink-0 md:h-8 md:w-8"
        >
          <PanelLeftClose className="h-4.5 w-4.5" aria-hidden="true" />
        </Button>
      </div>

      {/* Primary Action Button */}
      <div className="px-3 pt-4 pb-2">
        <Button
          onClick={handleNewChatClick}
          variant="ghost"
          className="w-full justify-start gap-2 h-10 hover:bg-[#202020] text-slate-200 border border-white/5 bg-[#1a1a1a]"
        >
          <Plus className="h-4 w-4 text-cyan-400" />
          <span className="font-medium text-sm">New chat</span>
        </Button>
      </div>

      {/* Main Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
        {/* Navigation Links */}
        <div className="space-y-1">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-2 mb-2">Workspace</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive 
                    ? "bg-cyan-500/10 text-cyan-400 font-medium" 
                    : "text-slate-300 hover:bg-[#202020] hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Search & Recents */}
        <div className="space-y-3 pt-2 border-t border-white/5">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-2">Recent Chats</div>
          
          {/* Search bar inside Recents */}
          <div className="relative px-2">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <Input
              type="text"
              name="conversation-search"
              aria-label="Search conversations"
              autoComplete="off"
              placeholder="Search chats…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-3 text-xs bg-[#0a0a0a] border-white/5 rounded-lg text-white placeholder-slate-600 focus-visible:ring-cyan-500/30"
            />
          </div>

          {showSessionListLoading || searchingSessions ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {searchingSessions ? "Searching…" : "Loading…"}
            </div>
          ) : sessionSearchError ? (
            <div className="px-3 py-2 text-xs text-amber-300" role="alert">{sessionSearchError}</div>
          ) : filteredSessions.length > 0 ? (
            <div className="max-h-[min(40dvh,22rem)] space-y-0.5 overflow-y-auto overscroll-contain pr-1">
              {filteredSessions.map((session) => (
                <div key={session.id} className="group/conversation flex min-w-0 items-center gap-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => handleSessionClick(session.id)}
                    title={session.title || "Untitled conversation"}
                    className={`block min-h-11 min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 md:min-h-8 ${
                      session.id === activeSessionId && pathname === "/chat"
                        ? "bg-[#202020] text-white font-medium"
                        : "text-slate-400 hover:bg-[#202020] hover:text-white"
                    }`}
                  >
                    {session.title || "Untitled conversation"}
                  </button>
                  <ConversationActions
                    conversationId={session.id}
                    conversationTitle={session.title || "Untitled conversation"}
                    onRequestDelete={handleDeleteRequest}
                  />
                </div>
              ))}
            </div>
          ) : (
             <div className="text-xs text-slate-600 italic px-3 py-2">No history</div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/5 mt-auto space-y-1">
        <Link href="/account" className="block w-full">
          <Button
            variant="ghost"
            className={`w-full justify-start h-10 ${
              pathname === "/account"
                ? "bg-cyan-500/10 text-cyan-400 font-medium"
                : "text-slate-300 hover:text-white hover:bg-[#202020]"
            }`}
          >
            <User className={`mr-2 h-4 w-4 ${pathname === "/account" ? "text-cyan-400" : "text-slate-400"}`} />
            Account settings
          </Button>
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start text-slate-300 hover:text-white hover:bg-[#202020] h-10"
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
        >
          <LogOut className="mr-2 h-4 w-4 text-slate-400" />
          Log out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] w-full bg-[#0a0a0a] text-slate-200 overflow-hidden font-body">
      <a
        href="#dashboard-main-content"
        className="sr-only z-[60] rounded-md bg-white px-4 py-2 text-sm font-medium text-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        Skip to main content
      </a>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-[#141414] border-r border-white/5 transition-[width] duration-300 ease-in-out motion-reduce:transition-none shrink-0 ${
          sidebarOpen ? "w-[260px]" : "w-0 overflow-hidden border-none"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Sidebar Trigger (When sidebar is closed) */}
      {!sidebarOpen && (
        <div className="hidden md:block absolute top-4 left-4 z-40">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            className="h-10 w-10 text-slate-400 hover:text-slate-200 hover:bg-[#202020] border border-white/5 bg-[#141414]/80 backdrop-blur-md rounded-xl"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Mobile Drawer Sidebar */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close sidebar"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity motion-reduce:transition-none"
            onClick={() => setMobileSidebarOpen(false)} 
          />
          {/* Menu Drawer */}
          <aside
            ref={mobileDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Workspace navigation"
            className="relative flex h-full w-[min(18rem,85vw)] flex-col border-r border-white/5 bg-[#141414] animate-in slide-in-from-left duration-200 motion-reduce:animate-none"
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Page Area */}
      <div className="flex-1 flex flex-col relative min-w-0 h-full overflow-hidden bg-[#0a0a0a]">
        {profile && !profile.onboarding_completed && (
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-500/20 px-4 py-2 text-xs flex justify-between items-center text-amber-200/90 shrink-0 select-none animate-in slide-in-from-top duration-300 gap-4">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              You are browsing in preview mode. Set up your personalized learning companion to unlock tailored quizzes, terminologies, and study recommendations.
            </span>
            <Button
              onClick={() => router.push("/onboarding")}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3.5 h-7 text-[10px] rounded-lg shrink-0 border-none"
            >
              Set Up Now
            </Button>
          </div>
        )}
        {/* Mobile Header */}
        <div data-chat-mobile-header className="z-10 flex shrink-0 items-center justify-between border-b border-white/5 bg-[#141414] p-3 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open sidebar"
            className="h-9 w-9 text-slate-400 hover:bg-[#202020] rounded-lg"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-heading font-semibold text-white tracking-tight text-base">Lerna</span>
          <div className="w-9" /> {/* Spacer */}
        </div>

        {/* Content Injector with Motion Page Transition */}
        <main id="dashboard-main-content" tabIndex={-1} className="relative min-h-0 flex-1 overflow-hidden">
          <motion.div
            key={pathname}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
            className="h-full w-full flex flex-col"
          >
            {children}
          </motion.div>
        </main>
      </div>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (!deletingSession) setDeleteTarget(null);
        }}
        title="Delete conversation?"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="break-words text-sm font-medium text-white">{deleteTarget?.title}</p>
            <p className="text-sm leading-6 text-slate-400">
              This conversation and its messages will be removed from your history. Uploaded materials will remain in your library.
            </p>
          </div>
          {deleteError && (
            <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {deleteError}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deletingSession}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteConfirm} disabled={deletingSession}>
              {deletingSession && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {deletingSession ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
