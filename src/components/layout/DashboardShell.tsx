"use client";

import { ReactNode, useMemo, useState } from "react";
import Link from "next/link";
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
  User 
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useDashboard } from "@/context/dashboard-context";

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
  } = useDashboard();

  const [searchQuery, setSearchQuery] = useState("");

  const filteredSessions = useMemo(() => {
    const norm = searchQuery.trim().toLowerCase();
    if (!norm) return sessions;
    return sessions.filter((s) => {
      const title = s.title?.toLowerCase() || "";
      const cat = s.topicCategory?.toLowerCase() || "";
      const msg = s.lastMessage?.toLowerCase() || "";
      return title.includes(norm) || cat.includes(norm) || msg.includes(norm);
    });
  }, [searchQuery, sessions]);

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

  const showSessionListLoading = loadingSessions && sessions.length === 0;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#141414] text-slate-200">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500 text-black">
            <Brain className="h-5 w-5" />
          </div>
          <span className="font-heading font-semibold text-white tracking-tight text-lg">EduAgent</span>
        </Link>
        <Button
          onClick={() => setSidebarOpen(false)}
          variant="ghost"
          size="icon"
          className="hidden md:flex h-8 w-8 text-slate-400 hover:text-slate-200 hover:bg-[#202020] shrink-0"
        >
          <PanelLeftClose className="h-4.5 w-4.5" />
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
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-3 text-xs bg-[#0a0a0a] border-white/5 rounded-lg text-white placeholder-slate-600 focus-visible:ring-cyan-500/30"
            />
          </div>

          {showSessionListLoading ? (
            <div className="text-xs text-slate-500 px-3 py-2">Loading...</div>
          ) : filteredSessions.length > 0 ? (
            <div className="space-y-0.5 overflow-y-auto max-h-[220px] pr-1">
              {filteredSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleSessionClick(session.id)}
                  className={`w-full text-left px-3 py-2 text-xs rounded-lg truncate transition-colors block ${
                    session.id === activeSessionId && pathname === "/chat"
                      ? "bg-[#202020] text-white font-medium"
                      : "text-slate-400 hover:bg-[#202020] hover:text-white"
                  }`}
                >
                  {session.title || "Untitled Session"}
                </button>
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
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-[#141414] border-r border-white/5 transition-all duration-300 ease-in-out shrink-0 ${
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
            className="h-10 w-10 text-slate-400 hover:text-slate-200 hover:bg-[#202020] border border-white/5 bg-[#141414]/80 backdrop-blur-md rounded-xl"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Mobile Drawer Sidebar */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileSidebarOpen(false)} 
          />
          {/* Menu Drawer */}
          <aside className="relative flex w-[260px] flex-col bg-[#141414] border-r border-white/5 h-full animate-in slide-in-from-left duration-200">
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
        <div className="flex items-center justify-between p-3 md:hidden border-b border-white/5 bg-[#141414] shrink-0 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileSidebarOpen(true)}
            className="h-9 w-9 text-slate-400 hover:bg-[#202020] rounded-lg"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-heading font-semibold text-white tracking-tight text-base">EduAgent</span>
          <div className="w-9" /> {/* Spacer */}
        </div>

        {/* Content Injector with Motion Page Transition */}
        <main className="flex-1 overflow-hidden relative min-h-0">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="h-full w-full flex flex-col"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
