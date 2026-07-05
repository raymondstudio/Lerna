"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  User, 
  Settings, 
  CreditCard, 
  Shield, 
  BarChart3, 
  HelpCircle, 
  Info,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
  Plus
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TabId = "profile" | "preferences" | "subscription" | "security" | "stats" | "support" | "about";

export default function AccountPage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  // Profile Form States
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [institution, setInstitution] = useState("");
  const [department, setDepartment] = useState("");
  const [studyLevel, setStudyLevel] = useState("");
  const [studyGoals, setStudyGoals] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState("");

  // Preferences States
  const [teachingStyle, setTeachingStyle] = useState("Intermediate");
  const [preferredQuestionType, setPreferredQuestionType] = useState("Mixed");
  const [studyReminderEnabled, setStudyReminderEnabled] = useState(true);
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(15);
  const [preferredTheme, setPreferredTheme] = useState("dark");

  // Security Form States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Stats States
  const [stats, setStats] = useState({
    streak: 0,
    questions: 0,
    documents: 0,
    sessions: 0,
    hours: 0,
  });

  // UX Status
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  // Load profile and stats
  useEffect(() => {
    if (!user || !supabase) return;

    async function loadData() {
      if (!supabase) return;
      try {
        // Fetch profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user?.id)
          .single();

        if (profile) {
          setFirstName(profile.first_name || "");
          setLastName(profile.last_name || "");
          setEmail(profile.email || user?.email || "");
          setInstitution(profile.institution || "");
          setDepartment(profile.department || "");
          setStudyLevel(profile.study_level || "");
          setStudyGoals(profile.study_goals || []);
          setAvatarUrl(profile.avatar_url || "");
          
          setTeachingStyle(profile.teaching_style || "Intermediate");
          setPreferredQuestionType(profile.preferred_question_type || "Mixed");
          setStudyReminderEnabled(profile.study_reminder_enabled ?? true);
          setDailyGoalMinutes(profile.daily_goal_minutes || 15);
          setPreferredTheme(profile.preferred_theme || "dark");
          
          setStats(prev => ({
            ...prev,
            streak: profile.learning_streak || 0,
            hours: Number(profile.hours_studied) || 0,
          }));
        }

        // Fetch counts for live aggregates
        const [docsRes, sessionsRes, aiRequestsRes] = await Promise.all([
          supabase
            .from("uploaded_materials")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user?.id)
            .is("deleted_at", null),
          supabase
            .from("study_sessions")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user?.id),
          supabase
            .from("ai_requests")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user?.id)
        ]);

        setStats(prev => ({
          ...prev,
          documents: docsRes.count || 0,
          sessions: sessionsRes.count || 0,
          questions: aiRequestsRes.count || 0,
        }));
      } catch (err) {
        console.error("[account] Error loading settings:", err);
      }
    }

    void loadData();
  }, [user, supabase]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !supabase) return;

    try {
      setProfileSaving(true);
      setProfileMessage(null);
      setProfileError(null);

      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          institution,
          department,
          study_level: studyLevel,
          study_goals: studyGoals,
          teaching_style: teachingStyle,
          preferred_question_type: preferredQuestionType,
          study_reminder_enabled: studyReminderEnabled,
          daily_goal_minutes: dailyGoalMinutes,
          preferred_theme: preferredTheme,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);

      if (error) throw error;
      setProfileMessage("Account settings updated successfully.");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long.");
      return;
    }

    try {
      setUpdatingPassword(true);
      setPasswordError(null);
      setPasswordSuccess(null);

      const { error } = await supabase.auth.updateUser({
        password: newPassword.trim(),
      });

      if (error) throw error;

      setPasswordSuccess("Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleLogoutAllDevices = async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut({ scope: "global" });
      router.push("/");
    } catch (err) {
      console.error(err);
    }
  };

  const isGoogleConnected = user?.app_metadata?.providers?.includes("google") || false;

  const sidebarTabs = [
    { id: "profile", label: "My Profile", icon: User },
    { id: "preferences", label: "Learning Preferences", icon: Settings },
    { id: "subscription", label: "Billing & Plans", icon: CreditCard },
    { id: "security", label: "Security & Access", icon: Shield },
    { id: "stats", label: "Performance Stats", icon: BarChart3 },
    { id: "support", label: "FAQ & Support", icon: HelpCircle },
    { id: "about", label: "Release Info", icon: Info },
  ] as const;

  return (
    <DashboardShell>
      <div className="h-full flex flex-col md:flex-row overflow-hidden bg-[#0d0f12]">
        
        {/* Settings Left Tab Menu */}
        <div className="w-full md:w-64 shrink-0 bg-[#111317] border-b md:border-b-0 md:border-r border-white/5 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible p-2.5 gap-1 shrink-0 scrollbar-none">
          <div className="hidden md:block px-3 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Settings Workspace
          </div>
          {sidebarTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors select-none ${
                  active 
                    ? "bg-cyan-500/10 text-cyan-400 font-semibold" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#1a1c22]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Settings Panel Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 max-w-4xl">
          {activeTab === "profile" && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Profile settings</h2>
                <p className="text-xs text-slate-500 mt-1">Personalize your academic identities and workspace labels.</p>
              </div>

              {/* Success/Error displays */}
              {profileMessage && (
                <div className="flex items-center gap-2 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-300">
                  <Check className="h-4 w-4 shrink-0" /> {profileMessage}
                </div>
              )}
              {profileError && (
                <div className="flex items-center gap-2 p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {profileError}
                </div>
              )}

              <div className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-[#14161a]">
                <div className="h-16 w-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-lg font-bold uppercase shrink-0">
                  {firstName ? `${firstName[0]}${lastName?.[0] || ""}` : email?.[0] || "U"}
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-white block">Profile Picture</span>
                  <span className="text-[10px] text-slate-500 block">Avatar is managed dynamically from your connected signup profile.</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">First Name</label>
                  <Input 
                    value={firstName} 
                    onChange={e => setFirstName(e.target.value)} 
                    className="bg-[#14161a] border-white/5 h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Last Name</label>
                  <Input 
                    value={lastName} 
                    onChange={e => setLastName(e.target.value)} 
                    className="bg-[#14161a] border-white/5 h-11"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Email Address</label>
                <Input 
                  value={email} 
                  disabled
                  className="bg-[#14161a]/40 border-white/5 h-11 text-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Institution Name</label>
                  <Input 
                    value={institution} 
                    onChange={e => setInstitution(e.target.value)} 
                    className="bg-[#14161a] border-white/5 h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Department / Course</label>
                  <Input 
                    value={department} 
                    onChange={e => setDepartment(e.target.value)} 
                    className="bg-[#14161a] border-white/5 h-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Current Study Level</label>
                  <Input 
                    value={studyLevel} 
                    onChange={e => setStudyLevel(e.target.value)} 
                    className="bg-[#14161a] border-white/5 h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Learning Goals</label>
                  <Input 
                    value={studyGoals.join(", ")} 
                    onChange={e => setStudyGoals(e.target.value.split(",").map(s => s.trim()))} 
                    placeholder="e.g. Exam prep, assignments"
                    className="bg-[#14161a] border-white/5 h-11"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={profileSaving}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold h-11 rounded-lg"
              >
                {profileSaving ? "Saving..." : "Save Profile Details"}
              </Button>
            </form>
          )}

          {activeTab === "preferences" && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Learning preferences</h2>
                <p className="text-xs text-slate-500 mt-1">Configure your AI tutor's explanation difficulty and styles.</p>
              </div>

              {profileMessage && (
                <div className="flex items-center gap-2 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-300">
                  <Check className="h-4 w-4 shrink-0" /> {profileMessage}
                </div>
              )}

              <div className="space-y-4">
                {/* Teaching Style */}
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Tutor Teaching Style</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Beginner", "Intermediate", "Advanced"].map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setTeachingStyle(style)}
                        className={`py-3.5 text-xs font-semibold rounded-xl border transition-all ${
                          teachingStyle === style
                            ? "border-cyan-500 bg-cyan-500/5 text-white"
                            : "border-white/5 bg-[#14161a] text-slate-400"
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preferred Question style */}
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Preferred Question Type</label>
                  <div className="grid grid-cols-4 gap-2">
                    {["Essay", "Flashcards", "Multiple Choice", "Mixed"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPreferredQuestionType(type)}
                        className={`py-3 text-[10px] font-semibold rounded-xl border transition-all ${
                          preferredQuestionType === type
                            ? "border-cyan-500 bg-cyan-500/5 text-white"
                            : "border-white/5 bg-[#14161a] text-slate-400"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Daily Study target */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Daily Target (minutes)</label>
                    <Input
                      type="number"
                      value={dailyGoalMinutes}
                      onChange={e => setDailyGoalMinutes(Number(e.target.value))}
                      className="bg-[#14161a] border-white/5 h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Preferred Theme</label>
                    <div className="grid grid-cols-2 gap-2 h-11 border border-white/5 rounded-lg p-1 bg-[#14161a] text-xs font-semibold">
                      {["dark", "light"].map(theme => (
                        <button
                          key={theme}
                          type="button"
                          onClick={() => setPreferredTheme(theme)}
                          className={`rounded-md capitalize ${preferredTheme === theme ? "bg-cyan-500/10 text-cyan-400" : "text-slate-400"}`}
                        >
                          {theme}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Reminders switch */}
                <div className="p-4 rounded-xl border border-white/5 bg-[#14161a] flex justify-between items-center">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-white block">Email Study Reminders</span>
                    <span className="text-[9px] text-slate-500 block">Receive nudge alerts when you are behind on your daily learning target.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStudyReminderEnabled(!studyReminderEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${studyReminderEnabled ? "bg-cyan-500" : "bg-white/10"}`}
                  >
                    <div className={`absolute top-1 left-1 bg-slate-950 w-4 h-4 rounded-full transition-transform ${studyReminderEnabled ? "translate-x-5" : ""}`} />
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={profileSaving}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold h-11 rounded-lg"
              >
                {profileSaving ? "Saving..." : "Save Preferences"}
              </Button>
            </form>
          )}

          {activeTab === "subscription" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Subscription & Plan</h2>
                <p className="text-xs text-slate-500 mt-1">Review your usage metrics and upgrade your account settings.</p>
              </div>

              <div className="p-5 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Current active plan</span>
                    <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                      EduAgent Free <span className="text-xs px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded-full font-normal border border-cyan-500/10">Active</span>
                    </h3>
                  </div>
                  <span className="text-3xl font-bold text-white">$0 <span className="text-sm text-slate-500 font-normal">/mo</span></span>
                </div>

                <div className="h-[1px] bg-white/5 w-full" />

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-500">AI Tokens Used</span>
                    <span className="text-white font-bold block">{stats.questions * 2}k / 20k tokens</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500">Upload Workspace Storage</span>
                    <span className="text-white font-bold block">{stats.documents * 2}MB / 100MB</span>
                  </div>
                </div>

                <Button className="w-full h-11 bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-bold rounded-lg flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4" /> Upgrade to Pro ($12/mo)
                </Button>
              </div>

              {/* Billing list */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white">Invoices & Billing History</h3>
                <div className="p-6 rounded-xl border border-white/5 bg-[#14161a] text-center text-xs text-slate-500">
                  You are currently on the Free plan. No invoice records are available.
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Security & sessions</h2>
                <p className="text-xs text-slate-500 mt-1">Modify login details, manage OAuth links, and active device sessions.</p>
              </div>

              {/* Change Password Form */}
              <form onSubmit={handleChangePassword} className="p-5 rounded-xl border border-white/5 bg-[#14161a] space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lock className="h-4 w-4 text-cyan-400" /> Change Password
                </h3>

                {passwordSuccess && (
                  <div className="flex items-center gap-2 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-300">
                    <Check className="h-4 w-4 shrink-0" /> {passwordSuccess}
                  </div>
                )}
                {passwordError && (
                  <div className="flex items-center gap-2 p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {passwordError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">New Password</label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="bg-[#0d0f12] border-white/5 h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Confirm New Password</label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="bg-[#0d0f12] border-white/5 h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={updatingPassword}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold h-10 px-6 rounded-lg text-xs"
                >
                  {updatingPassword ? "Updating..." : "Update Password"}
                </Button>
              </form>

              {/* Connected Accounts */}
              <div className="p-5 rounded-xl border border-white/5 bg-[#14161a] space-y-3">
                <h3 className="text-sm font-bold text-white">Linked Identities</h3>
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    <span>Google Authentication Account</span>
                  </div>
                  {isGoogleConnected ? (
                    <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg font-semibold text-[10px] border border-emerald-500/10 flex items-center gap-1">
                      <Check className="h-3 w-3 stroke-[3]" /> Connected
                    </span>
                  ) : (
                    <span className="text-slate-500 text-[10px]">Not Linked</span>
                  )}
                </div>
              </div>

              {/* Active Sessions */}
              <div className="p-5 rounded-xl border border-white/5 bg-[#14161a] space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-white">Active login sessions</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Logout from other browser devices to protect your educational assets.</p>
                  </div>
                  <Button 
                    onClick={handleLogoutAllDevices}
                    variant="outline"
                    className="h-8 border-red-500/20 text-red-400 bg-red-500/5 hover:bg-red-500/10 text-[10px] font-semibold"
                  >
                    Logout All Devices
                  </Button>
                </div>
                <div className="divide-y divide-white/5 text-xs">
                  <div className="py-2.5 flex justify-between items-center">
                    <div>
                      <span className="font-semibold block text-slate-300">This Device (Active Browser)</span>
                      <span className="text-[10px] text-slate-500">Currently active session</span>
                    </div>
                    <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded-md border border-cyan-500/10 text-[10px] font-medium">Online</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "stats" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Performance statistics</h2>
                <p className="text-xs text-slate-500 mt-1">Review live study aggregate data and user telemetry.</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: "Learning Streak", value: `${stats.streak} days`, desc: "Consecutive study days" },
                  { label: "Questions Asked", value: stats.questions, desc: "Prompts sent to AI Tutor" },
                  { label: "Documents Uploaded", value: stats.documents, desc: "Lecture slides & PDFs" },
                  { label: "Study Sessions", value: stats.sessions, desc: "Total sessions generated" },
                  { label: "Hours Studied", value: `${stats.hours.toFixed(1)} hrs`, desc: "Accumulated dashboard time" },
                  { label: "Topics Learned", value: stats.sessions * 2, desc: "Concepts checked" },
                ].map((stat) => (
                  <div key={stat.label} className="p-4 rounded-xl border border-white/5 bg-[#14161a] space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">{stat.label}</span>
                    <span className="text-2xl font-bold text-white block">{stat.value}</span>
                    <span className="text-[10px] text-slate-500 block">{stat.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "support" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Support & Community</h2>
                <p className="text-xs text-slate-500 mt-1">Find tutorials, query support pipelines, or join social communities.</p>
              </div>

              {/* Actions Grid */}
              <div className="grid grid-cols-2 gap-4">
                <a 
                  href="mailto:support@eduagentai.com?subject=Support Request" 
                  className="p-4 rounded-xl border border-white/5 bg-[#14161a] hover:border-cyan-500/30 transition-colors block space-y-1"
                >
                  <span className="text-xs font-bold text-white block">Email Support</span>
                  <span className="text-[10px] text-slate-500 block">Get direct troubleshooting help.</span>
                </a>
                <a 
                  href="mailto:support@eduagentai.com?subject=Feature Request" 
                  className="p-4 rounded-xl border border-white/5 bg-[#14161a] hover:border-cyan-500/30 transition-colors block space-y-1"
                >
                  <span className="text-xs font-bold text-white block">Request Feature</span>
                  <span className="text-[10px] text-slate-500 block">Suggest extensions or abstractions.</span>
                </a>
              </div>

              {/* FAQs */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white">Frequently Asked Questions</h3>
                <div className="divide-y divide-white/5 border border-white/5 rounded-xl bg-[#14161a] px-4">
                  {[
                    { q: "How do I reset my statistics?", a: "To clear analytics metrics, please contact administrators via the support email." },
                    { q: "Can I connect multiple Google accounts?", a: "No, a single profile identity is linked to one Google account at a time." },
                    { q: "How do I upgrade to Pro?", a: "The Pro tier upgrade is currently in prototype mode. Click 'Upgrade' in billing to see options." }
                  ].map((faq) => (
                    <div key={faq.q} className="py-3 text-xs space-y-1">
                      <span className="font-semibold text-slate-300 block">Q: {faq.q}</span>
                      <span className="text-slate-500 block">A: {faq.a}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "about" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Platform Information</h2>
                <p className="text-xs text-slate-500 mt-1">Review deployment details and client release versions.</p>
              </div>

              <div className="p-5 rounded-xl border border-white/5 bg-[#14161a] divide-y divide-white/5 text-xs">
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-500">EduAgent Version</span>
                  <span className="text-white font-bold">v1.1.0-production</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-500">Framework Runtime</span>
                  <span className="text-white font-bold">Next.js 16.2 (Turbopack)</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-500">Database & Auth</span>
                  <span className="text-white font-bold">Supabase PostgreSQL 15</span>
                </div>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-sm font-bold text-white">Recent Release Notes</h3>
                <div className="p-4 rounded-xl border border-white/5 bg-[#14161a]/60 text-xs text-slate-400 space-y-2 leading-relaxed">
                  <p className="font-semibold text-white">July 2026 Updates:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Added onboarding personalization wizard for custom AI prompt tutoring context.</li>
                    <li>Introduced premium client accounts interface with settings, learning targets, and billing.</li>
                    <li>Connected dynamic database metrics aggregates for real-time statistical calculations.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
