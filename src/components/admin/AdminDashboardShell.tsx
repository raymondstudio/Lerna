"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { 
  BarChart2, 
  BookOpen, 
  Brain, 
  Cpu, 
  LayoutDashboard, 
  LogOut, 
  Megaphone, 
  Menu, 
  MessageSquare, 
  PanelLeftClose, 
  PanelLeftOpen, 
  Settings, 
  Sparkles, 
  Users, 
  Bell,
  ArrowLeft,
  Activity,
  HelpCircle,
  GraduationCap,
  CreditCard
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

import { OverviewTab } from "./OverviewTab";
import { UsersTab } from "./UsersTab";
import { AnalyticsTab } from "./AnalyticsTab";
import { LearningAnalyticsTab } from "./LearningAnalyticsTab";
import { AiAnalyticsTab } from "./AiAnalyticsTab";
import { MarketingTab } from "./MarketingTab";
import { HealthTab } from "./HealthTab";
import { AgentTab } from "./AgentTab";
import { SupportTab } from "./SupportTab";
import { FeedbackTab } from "./FeedbackTab";
import { AnnouncementsTab } from "./AnnouncementsTab";
import { SettingsTab } from "./SettingsTab";
import { InstitutionsTab } from "./InstitutionsTab";
import { BillingTab } from "./BillingTab";

type NavItem = {
  name: string;
  tab: string;
  icon: any;
};

export function AdminDashboardShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const { signOut } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const navItems: NavItem[] = [
    { name: "Overview", tab: "overview", icon: LayoutDashboard },
    { name: "Users", tab: "users", icon: Users },
    { name: "Institutions", tab: "institutions", icon: GraduationCap },
    { name: "Billing Center", tab: "billing", icon: CreditCard },
    { name: "Analytics", tab: "analytics", icon: BarChart2 },
    { name: "Learning Analytics", tab: "learning", icon: BookOpen },
    { name: "AI Analytics", tab: "ai", icon: Cpu },
    { name: "Marketing", tab: "marketing", icon: Megaphone },
    { name: "System Health", tab: "health", icon: Activity },
    { name: "Support Helpdesk", tab: "support", icon: HelpCircle },
    { name: "Feedback", tab: "feedback", icon: MessageSquare },
    { name: "Announcements", tab: "announcements", icon: Bell },
    { name: "Settings", tab: "settings", icon: Settings },
  ];

  const agentItems: NavItem[] = [
    { name: "AI Pluggable Agents", tab: "agents", icon: Sparkles },
  ];

  const handleTabClick = (tab: string) => {
    router.push(`/admin?tab=${tab}`);
    setMobileSidebarOpen(false);
  };

  const renderActiveContent = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab />;
      case "users":
        return <UsersTab />;
      case "institutions":
        return <InstitutionsTab />;
      case "billing":
        return <BillingTab />;
      case "analytics":
        return <AnalyticsTab />;
      case "learning":
        return <LearningAnalyticsTab />;
      case "ai":
        return <AiAnalyticsTab />;
      case "marketing":
        return <MarketingTab />;
      case "health":
        return <HealthTab />;
      case "agents":
        return <AgentTab />;
      case "support":
        return <SupportTab />;
      case "feedback":
        return <FeedbackTab />;
      case "announcements":
        return <AnnouncementsTab />;
      case "settings":
        return <SettingsTab />;
      default:
        return <OverviewTab />;
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#141414] text-slate-200 border-r border-white/5">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/5">
        <Link href="/chat" className="flex items-center gap-2.5 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500 text-black">
            <Brain className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-heading font-semibold text-white tracking-tight text-sm leading-tight">Lerna AI</span>
            <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider">Admin Center</span>
          </div>
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

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div className="space-y-1">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 mb-2">Control Panel</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.tab}
                onClick={() => handleTabClick(item.tab)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all font-medium ${
                  isActive 
                    ? "bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400 pl-2" 
                    : "text-slate-300 hover:bg-[#202020] hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-cyan-400" : "text-slate-500"}`} />
                {item.name}
              </button>
            );
          })}
        </div>

        <div className="space-y-1 pt-4 border-t border-white/5">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 mb-2">Business Layer</div>
          {agentItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.tab}
                onClick={() => handleTabClick(item.tab)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all font-medium ${
                  isActive 
                    ? "bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400 pl-2" 
                    : "text-slate-300 hover:bg-[#202020] hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-cyan-400" : "text-slate-500"}`} />
                {item.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer controls */}
      <div className="p-3 border-t border-white/5 space-y-1">
        <Link
          href="/chat"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:bg-[#202020] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-slate-500" />
          Go to Tutor App
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start text-xs text-slate-400 hover:text-white hover:bg-[#202020] rounded-xl h-10 px-3"
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
        >
          <LogOut className="mr-3 h-4 w-4 text-slate-500" />
          Log out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-[#0a0a0a] text-slate-200 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-[#141414] transition-all duration-300 ease-in-out shrink-0 ${
          sidebarOpen ? "w-[260px]" : "w-0 overflow-hidden"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Sidebar Trigger */}
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

      {/* Mobile Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileSidebarOpen(false)} 
          />
          <aside className="relative flex w-[260px] flex-col bg-[#141414] h-full animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Content pane */}
      <div className="flex-1 flex flex-col relative min-w-0 h-full overflow-hidden bg-[#0d0d0e]">
        {/* Top Header */}
        <header className="flex items-center justify-between p-4 border-b border-white/5 bg-[#141414]/40 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden h-9 w-9 text-slate-400 hover:bg-white/5 rounded-xl"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-sm font-semibold text-white capitalize hidden md:block">
              Admin / <span className="text-cyan-400 font-bold">{activeTab}</span>
            </h1>
            <span className="font-heading font-semibold text-white text-base md:hidden">Lerna Admin</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">System Live</span>
          </div>
        </header>

        {/* Scrollable viewport */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 min-h-0 bg-[#0a0a0a]">
          <div className="max-w-7xl mx-auto space-y-8">
            {renderActiveContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
