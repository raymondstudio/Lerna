"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  User as UserIcon, 
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
  MessageSquare,
  Globe,
  Bell,
  Monitor,
  Loader2
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TabId = "profile" | "preferences" | "subscription" | "security" | "stats" | "support" | "about";

export default function AccountPage() {
  const router = useRouter();
  const { user, profile, refreshProfile, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  // Profile Form States
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [institution, setInstitution] = useState("");
  const [department, setDepartment] = useState("");
  const [studyLevel, setStudyLevel] = useState("");
  const [studyGoals, setStudyGoals] = useState<string[]>([]);
  const [isStudent, setIsStudent] = useState(true);
  const [gender, setGender] = useState("");
  const [age, setAge] = useState<number | "">("");

  // Email update
  const [newEmail, setNewEmail] = useState("");
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Preferences States
  const [teachingStyle, setTeachingStyle] = useState("Intermediate");
  const [difficulty, setDifficulty] = useState("Medium");
  const [preferredQuizFormat, setPreferredQuizFormat] = useState("Mixed");
  const [flashcardPreference, setFlashcardPreference] = useState("Standard");
  const [preferredLanguage, setPreferredLanguage] = useState("English");
  const [responseLength, setResponseLength] = useState("Medium");
  const [voicePreference, setVoicePreference] = useState("Default");

  // Notifications
  const [studyReminderEnabled, setStudyReminderEnabled] = useState(true);
  const [marketingUpdatesEnabled, setMarketingUpdatesEnabled] = useState(true);
  const [securityAlertsEnabled, setSecurityAlertsEnabled] = useState(true);
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(15);
  const [preferredTheme, setPreferredTheme] = useState("dark");

  // Security Form States
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Support Tickets States
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState<string | null>(null);

  // Feedback States
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [feedbackType, setFeedbackType] = useState<"general" | "bug" | "feature">("general");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

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
  const [loadingData, setLoadingData] = useState(true);

  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  // Load profile details and stats
  useEffect(() => {
    if (!user || !supabase) return;

    async function loadData() {
      const client = supabase;
      if (!client || !user) return;
      try {
        setLoadingData(true);
        if (profile) {
          setFirstName(profile.first_name || "");
          setLastName(profile.last_name || "");
          setInstitution(profile.institution || "");
          setDepartment(profile.department || "");
          setStudyLevel(profile.study_level || "");
          setStudyGoals(profile.study_goals || []);
          setIsStudent(profile.is_student ?? true);
          setGender(profile.gender || "Prefer not to say");
          setAge(profile.age || "");
          
          setTeachingStyle(profile.teaching_style || "Intermediate");
          setDifficulty(profile.difficulty || "Medium");
          setPreferredQuizFormat(profile.preferred_quiz_format || "Mixed");
          setFlashcardPreference(profile.flashcard_preference || "Standard");
          setPreferredLanguage(profile.preferred_language || "English");
          setResponseLength(profile.response_length || "Medium");
          setVoicePreference(profile.voice_preference || "Default");

          setStudyReminderEnabled(profile.study_reminder_enabled ?? true);
          setMarketingUpdatesEnabled(profile.marketing_updates_enabled ?? true);
          setSecurityAlertsEnabled(profile.security_alerts_enabled ?? true);
          setDailyGoalMinutes(profile.daily_goal_minutes || 15);
          setPreferredTheme(profile.preferred_theme || "dark");

          setStats(prev => ({
            ...prev,
            streak: profile.learning_streak || 0,
            hours: Number(profile.hours_studied) || 0,
          }));
        }

        // Fetch counts for stats
        const [docsRes, sessionsRes, aiRequestsRes, ticketsRes, feedbackRes] = await Promise.all([
          client.from("uploaded_materials").select("*", { count: "exact", head: true }).eq("user_id", user.id).is("deleted_at", null),
          client.from("study_sessions").select("*", { count: "exact", head: true }).eq("user_id", user.id),
          client.from("ai_requests").select("*", { count: "exact", head: true }).eq("user_id", user.id),
          client.from("support_tickets").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
          client.from("feedback").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
        ]);

        setStats(prev => ({
          ...prev,
          documents: docsRes.count || 0,
          sessions: sessionsRes.count || 0,
          questions: aiRequestsRes.count || 0,
        }));

        if (ticketsRes.data) setTickets(ticketsRes.data);
        if (feedbackRes.data) setFeedbacks(feedbackRes.data);
      } catch (err) {
        console.error("[account] Error loading details:", err);
      } finally {
        setLoadingData(false);
      }
    }

    void loadData();
  }, [user, supabase, profile]);

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
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          institution: institution.trim(),
          department: department.trim(),
          study_level: studyLevel,
          study_goals: studyGoals,
          is_student: isStudent,
          gender,
          age: age === "" ? null : Number(age),
          teaching_style: teachingStyle,
          difficulty,
          preferred_quiz_format: preferredQuizFormat,
          flashcard_preference: flashcardPreference,
          preferred_language: preferredLanguage,
          response_length: responseLength,
          voice_preference: voicePreference,
          study_reminder_enabled: studyReminderEnabled,
          marketing_updates_enabled: marketingUpdatesEnabled,
          security_alerts_enabled: securityAlertsEnabled,
          daily_goal_minutes: dailyGoalMinutes,
          preferred_theme: preferredTheme,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);

      if (error) throw error;
      setProfileMessage("Your preferences and account settings have been saved.");
      await refreshProfile();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to save details.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !newEmail.trim()) return;

    try {
      setUpdatingEmail(true);
      setEmailMessage(null);
      setEmailError(null);

      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim()
      });

      if (error) throw error;
      setEmailMessage("Verification link sent. Check both your current and new email address to complete the change.");
      setNewEmail("");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to update email.");
    } finally {
      setUpdatingEmail(false);
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

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) return;

    try {
      setSubmittingTicket(true);
      setTicketSuccess(null);

      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: ticketSubject, message: ticketMessage })
      });
      const json = await res.json();
      if (json.success) {
        setTicketSuccess("Support ticket created. Support team will respond shortly.");
        setTicketSubject("");
        setTicketMessage("");
        setTickets(prev => [json.data, ...prev]);
      } else {
        alert(json.error || "Failed to submit support ticket.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMsg.trim()) return;

    try {
      setSubmittingFeedback(true);
      setFeedbackSuccess(null);

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: feedbackType, message: feedbackMsg, rating: feedbackRating })
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackSuccess("Thank you! Your feedback has been recorded.");
        setFeedbackMsg("");
        setFeedbacks(prev => [json.data, ...prev]);
      } else {
        alert(json.error || "Failed to submit feedback.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const isGoogleConnected = user?.app_metadata?.providers?.includes("google") || false;

  const sidebarTabs = [
    { id: "profile", label: "My Profile", icon: UserIcon },
    { id: "preferences", label: "Learning Settings", icon: Settings },
    { id: "subscription", label: "Billing & Plans", icon: CreditCard },
    { id: "security", label: "Security & Access", icon: Shield },
    { id: "stats", label: "Performance Stats", icon: BarChart3 },
    { id: "support", label: "FAQ & Support", icon: HelpCircle },
    { id: "about", label: "Release Info", icon: Info },
  ] as const;

  // Render browser details
  const getDeviceDetails = () => {
    if (typeof window === "undefined") return { browser: "Server", os: "Unknown", device: "Desktop" };
    const ua = navigator.userAgent;
    let browser = "Unknown Browser";
    let os = "Unknown OS";

    if (ua.includes("Chrome")) browser = "Google Chrome";
    else if (ua.includes("Safari")) browser = "Apple Safari";
    else if (ua.includes("Firefox")) browser = "Mozilla Firefox";

    if (ua.includes("Windows")) os = "Windows OS";
    else if (ua.includes("Mac")) os = "macOS";
    else if (ua.includes("Android")) os = "Android OS";
    else if (ua.includes("iPhone")) os = "iOS";

    const device = ua.includes("Mobi") ? "Mobile Device" : "Desktop PC";

    return { browser, os, device };
  };

  const currentDevice = getDeviceDetails();

  return (
    <DashboardShell>
      <div className="h-full flex flex-col md:flex-row overflow-hidden bg-[#0d0f12]">
        
        {/* Responsive Side Navigation Menu */}
        <div className="w-full md:w-64 shrink-0 bg-[#111317] border-b md:border-b-0 md:border-r border-white/5 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible p-3 gap-1 shrink-0 scrollbar-none">
          <div className="hidden md:block px-3 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">
            SaaS Panel
          </div>
          {sidebarTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all select-none ${
                  active 
                    ? "bg-cyan-500/10 text-cyan-400 font-bold shadow-sm" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#1a1c22]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Panel Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 max-w-4xl scrollbar-thin">
          
          {loadingData ? (
            <div className="h-96 w-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
            </div>
          ) : (
            <>
              {activeTab === "profile" && (
                <form onSubmit={handleSaveProfile} className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">Profile settings</h2>
                    <p className="text-xs text-slate-500 mt-1">Configure your personal and academic metadata fields.</p>
                  </div>

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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">First Name</label>
                      <Input 
                        value={firstName} 
                        onChange={e => setFirstName(e.target.value)} 
                        className="bg-[#14161a] border-white/5 h-11"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Last Name</label>
                      <Input 
                        value={lastName} 
                        onChange={e => setLastName(e.target.value)} 
                        className="bg-[#14161a] border-white/5 h-11"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Age</label>
                      <Input 
                        type="number"
                        value={age} 
                        onChange={e => setAge(e.target.value === "" ? "" : Number(e.target.value))} 
                        className="bg-[#14161a] border-white/5 h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Gender</label>
                      <select
                        value={gender}
                        onChange={e => setGender(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-lg border border-white/5 bg-[#14161a] text-xs font-semibold text-slate-300 focus:outline-none"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-white/5 bg-[#14161a] flex justify-between items-center">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-white block">Student Account status</span>
                      <span className="text-[9px] text-slate-500 block">Flag this to configure custom study courses and levels.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsStudent(!isStudent)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${isStudent ? "bg-cyan-500" : "bg-white/10"}`}
                    >
                      <div className={`absolute top-1 left-1 bg-slate-950 w-4 h-4 rounded-full transition-transform ${isStudent ? "translate-x-5" : ""}`} />
                    </button>
                  </div>

                  {isStudent && (
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-200">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Institution / School</label>
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
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Study Level</label>
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
                    <h2 className="text-xl font-bold text-white">Tutor learning preferences</h2>
                    <p className="text-xs text-slate-500 mt-1">Fine-tune the complexity, size, and style of your AI assistant's responses.</p>
                  </div>

                  {profileMessage && (
                    <div className="flex items-center gap-2 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-300">
                      <Check className="h-4 w-4 shrink-0" /> {profileMessage}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Teaching Style</label>
                        <select value={teachingStyle} onChange={e => setTeachingStyle(e.target.value)} className="w-full h-11 px-3 bg-[#14161a] border border-white/5 rounded-lg text-xs">
                          <option value="Beginner">Beginner (Simpler analogies)</option>
                          <option value="Intermediate">Intermediate (Standard)</option>
                          <option value="Advanced">Advanced (Academic terms)</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Difficulty Threshold</label>
                        <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full h-11 px-3 bg-[#14161a] border border-white/5 rounded-lg text-xs">
                          <option value="Easy">Easy</option>
                          <option value="Medium">Medium</option>
                          <option value="Hard">Hard</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Preferred Quiz format</label>
                        <select value={preferredQuizFormat} onChange={e => setPreferredQuizFormat(e.target.value)} className="w-full h-11 px-3 bg-[#14161a] border border-white/5 rounded-lg text-xs">
                          <option value="Multiple Choice">Multiple Choice</option>
                          <option value="Essay">Essay style</option>
                          <option value="Flashcards">Flashcard style</option>
                          <option value="Mixed">Mixed Questions</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Flashcard style</label>
                        <select value={flashcardPreference} onChange={e => setFlashcardPreference(e.target.value)} className="w-full h-11 px-3 bg-[#14161a] border border-white/5 rounded-lg text-xs">
                          <option value="Standard">Standard Flashcards</option>
                          <option value="Detailed">Detailed explanations</option>
                          <option value="Quick">Quick Summary card</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Preferred Language</label>
                        <select value={preferredLanguage} onChange={e => setPreferredLanguage(e.target.value)} className="w-full h-11 px-3 bg-[#14161a] border border-white/5 rounded-lg text-xs">
                          <option value="English">English</option>
                          <option value="Spanish">Spanish</option>
                          <option value="French">French</option>
                          <option value="German">German</option>
                          <option value="Chinese">Chinese</option>
                          <option value="Japanese">Japanese</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Response Length</label>
                        <select value={responseLength} onChange={e => setResponseLength(e.target.value)} className="w-full h-11 px-3 bg-[#14161a] border border-white/5 rounded-lg text-xs">
                          <option value="Short">Short & Concise</option>
                          <option value="Medium">Medium</option>
                          <option value="Long">Long & Thorough</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Voice preference</label>
                      <select value={voicePreference} onChange={e => setVoicePreference(e.target.value)} className="w-full h-11 px-3 bg-[#14161a] border border-white/5 rounded-lg text-xs">
                        <option value="Default">Default</option>
                        <option value="Female">Female Accent</option>
                        <option value="Male">Male Accent</option>
                      </select>
                    </div>

                    {/* Alert Preference section */}
                    <div className="space-y-3 pt-4 border-t border-white/5">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Bell className="h-4 w-4 text-cyan-400" /> Notifications & alerts
                      </h3>

                      <div className="space-y-2.5">
                        {[
                          { label: "Study Reminders", desc: "Receive email warnings when daily goal is incomplete.", state: studyReminderEnabled, setter: setStudyReminderEnabled },
                          { label: "Marketing & updates", desc: "Periodic platform changelogs and newsletters.", state: marketingUpdatesEnabled, setter: setMarketingUpdatesEnabled },
                          { label: "Security alerts", desc: "Immediate notification on profile email/password mutations.", state: securityAlertsEnabled, setter: setSecurityAlertsEnabled }
                        ].map((reminder, i) => (
                          <div key={i} className="p-3 rounded-lg border border-white/5 bg-[#14161a] flex justify-between items-center text-xs">
                            <div>
                              <span className="font-semibold text-white block">{reminder.label}</span>
                              <span className="text-[10px] text-slate-500 block">{reminder.desc}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => reminder.setter(!reminder.state)}
                              className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${reminder.state ? "bg-cyan-500" : "bg-white/10"}`}
                            >
                              <div className={`absolute top-0.5 left-0.5 bg-slate-950 w-4 h-4 rounded-full transition-transform ${reminder.state ? "translate-x-5" : ""}`} />
                            </button>
                          </div>
                        ))}
                      </div>
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
                    <h2 className="text-xl font-bold text-white">Billing workspace</h2>
                    <p className="text-xs text-slate-500 mt-1">Monitor plan usage storage quotas and upgrades.</p>
                  </div>

                  <div className="p-5 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Plan level</span>
                        <h3 className="text-2xl font-bold text-white capitalize flex items-center gap-2">
                          EduAgent {profile?.plan || "Free"} <span className="text-xs px-2.5 py-0.5 bg-cyan-500/10 text-cyan-400 rounded-full font-semibold border border-cyan-500/10">Active</span>
                        </h3>
                      </div>
                      <span className="text-3xl font-bold text-white">
                        {profile?.plan === "premium" ? "$12" : "$0"} <span className="text-xs text-slate-500 font-normal">/mo</span>
                      </span>
                    </div>

                    <div className="h-[1px] bg-white/5 w-full" />

                    <div className="space-y-3 text-xs">
                      {/* Chats quota limit */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-slate-500 text-[10px]">
                          <span>AI Chat Queries</span>
                          <span className="text-slate-300 font-medium">{stats.questions} / {profile?.plan === "premium" ? "Unlimited" : "50 calls"}</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-cyan-500" 
                            style={{ width: `${profile?.plan === "premium" ? 100 : Math.min((stats.questions / 50) * 100, 100)}%` }} 
                          />
                        </div>
                      </div>

                      {/* Storage quota */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-slate-500 text-[10px]">
                          <span>Uploads capacity</span>
                          <span className="text-slate-300 font-medium">{stats.documents} / {profile?.plan === "premium" ? "200 files" : "10 files"}</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-cyan-500" 
                            style={{ width: `${profile?.plan === "premium" ? Math.min((stats.documents / 200) * 100, 100) : Math.min((stats.documents / 10) * 100, 100)}%` }} 
                          />
                        </div>
                      </div>
                    </div>

                    {profile?.plan !== "premium" && (
                      <Button className="w-full h-11 bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-bold rounded-lg flex items-center justify-center gap-2">
                        <Sparkles className="h-4 w-4" /> Upgrade to Premium Tier ($12/mo)
                      </Button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-white">Invoices & Logs</h3>
                    <div className="p-6 rounded-xl border border-white/5 bg-[#14161a] text-center text-xs text-slate-500">
                      No invoices found. Standard accounts are created with free test plans.
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "security" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">Security & login access</h2>
                    <p className="text-xs text-slate-500 mt-1">Configure passwords, change emails, or sign out active browser devices.</p>
                  </div>

                  {/* Change email form */}
                  <form onSubmit={handleUpdateEmail} className="p-5 rounded-xl border border-white/5 bg-[#14161a] space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Globe className="h-4 w-4 text-cyan-400" /> Change Login Email
                    </h3>

                    {emailMessage && (
                      <div className="flex items-center gap-2 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-300">
                        <Check className="h-4 w-4 shrink-0" /> {emailMessage}
                      </div>
                    )}
                    {emailError && (
                      <div className="flex items-center gap-2 p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-300">
                        <AlertCircle className="h-4 w-4 shrink-0" /> {emailError}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Current Email Address</label>
                      <Input value={user?.email || ""} disabled className="bg-[#0d0f12] border-white/5 text-slate-500 h-11" />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">New Email Address</label>
                      <Input 
                        type="email" 
                        placeholder="e.g. name@university.edu" 
                        value={newEmail} 
                        onChange={e => setNewEmail(e.target.value)} 
                        className="bg-[#0d0f12] border-white/5 h-11" 
                        disabled={updatingEmail}
                        required
                      />
                    </div>

                    <Button type="submit" disabled={updatingEmail} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold h-10 px-5 text-xs">
                      {updatingEmail ? "Sending Links..." : "Change Email Address"}
                    </Button>
                  </form>

                  {/* Password Form */}
                  <form onSubmit={handleChangePassword} className="p-5 rounded-xl border border-white/5 bg-[#14161a] space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Lock className="h-4 w-4 text-cyan-400" /> Create New Password
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
                          disabled={updatingPassword}
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
                          disabled={updatingPassword}
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

                    <Button type="submit" disabled={updatingPassword} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold h-10 px-5 text-xs">
                      {updatingPassword ? "Updating..." : "Update Password"}
                    </Button>
                  </form>

                  {/* Connected Accounts */}
                  <div className="p-5 rounded-xl border border-white/5 bg-[#14161a] space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Monitor className="h-4 w-4 text-cyan-400" /> Active Session Info
                    </h3>

                    <div className="divide-y divide-white/5 text-xs">
                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-500">Authentication Method</span>
                        <span className="text-white font-bold capitalize">{isGoogleConnected ? "Google sign-in" : "Email / Password"}</span>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-500">OS Platform</span>
                        <span className="text-white font-semibold">{currentDevice.os}</span>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-500">Browser</span>
                        <span className="text-white font-semibold">{currentDevice.browser}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleLogoutAllDevices} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold border border-red-500/20 text-xs h-10 rounded-lg">
                        Logout Everywhere
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "stats" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">Performance metrics</h2>
                    <p className="text-xs text-slate-500 mt-1">Review live study statistics and metrics compiled from the database.</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { label: "Learning Streak", value: `${stats.streak} days`, desc: "Consecutive study days" },
                      { label: "Questions Asked", value: stats.questions, desc: "Total chat tutor calls" },
                      { label: "Files Uploaded", value: stats.documents, desc: "Materials indexed in RAG" },
                      { label: "Study Workspaces", value: stats.sessions, desc: "Active workspace logs" },
                      { label: "Hours Studied", value: `${stats.hours.toFixed(1)} hrs`, desc: "Total session elapsed hours" },
                      { label: "Last Active", value: profile?.last_active ? new Date(profile.last_active).toLocaleDateString() : "Today", desc: "Profile metadata update" },
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
                <div className="space-y-8">
                  <div>
                    <h2 className="text-xl font-bold text-white">FAQ, Support & feedback</h2>
                    <p className="text-xs text-slate-500 mt-1">Submit bug reports, register support tickets, and check helpdesk logs.</p>
                  </div>

                  {/* Support Form */}
                  <form onSubmit={handleSubmitTicket} className="p-5 rounded-xl border border-white/5 bg-[#14161a] space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <HelpCircle className="h-4 w-4 text-cyan-400" /> Create Support Ticket
                    </h3>

                    {ticketSuccess && (
                      <div className="flex items-center gap-2 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-300">
                        <Check className="h-4 w-4 shrink-0" /> {ticketSuccess}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Subject</label>
                      <Input
                        placeholder="What problem are you facing?"
                        value={ticketSubject}
                        onChange={e => setTicketSubject(e.target.value)}
                        className="bg-[#0d0f12] border-white/5 h-11"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Message Description</label>
                      <textarea
                        rows={4}
                        placeholder="Detail your request..."
                        value={ticketMessage}
                        onChange={e => setTicketMessage(e.target.value)}
                        className="w-full p-3 rounded-lg border border-white/5 bg-[#0d0f12] text-xs focus:outline-none focus:border-cyan-500/50"
                        required
                      />
                    </div>

                    <Button type="submit" disabled={submittingTicket} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold h-10 px-5 text-xs">
                      {submittingTicket ? "Submitting..." : "Submit Support Ticket"}
                    </Button>
                  </form>

                  {/* Feedback Form */}
                  <form onSubmit={handleSubmitFeedback} className="p-5 rounded-xl border border-white/5 bg-[#14161a] space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <MessageSquare className="h-4 w-4 text-cyan-400" /> Platform Feedback
                    </h3>

                    {feedbackSuccess && (
                      <div className="flex items-center gap-2 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-300">
                        <Check className="h-4 w-4 shrink-0" /> {feedbackSuccess}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Feedback Type</label>
                        <select value={feedbackType} onChange={e => setFeedbackType(e.target.value as any)} className="w-full h-11 px-3 bg-[#0d0f12] border border-white/5 rounded-lg text-xs">
                          <option value="general">General Feedback</option>
                          <option value="bug">Report a Bug</option>
                          <option value="feature">Request a Feature</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Rating (1-5)</label>
                        <select value={feedbackRating} onChange={e => setFeedbackRating(Number(e.target.value))} className="w-full h-11 px-3 bg-[#0d0f12] border border-white/5 rounded-lg text-xs">
                          <option value={5}>⭐⭐⭐⭐⭐ (Excellent)</option>
                          <option value={4}>⭐⭐⭐⭐ (Good)</option>
                          <option value={3}>⭐⭐⭐ (Average)</option>
                          <option value={2}>⭐⭐ (Poor)</option>
                          <option value={1}>⭐ (Terrible)</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Your Comments</label>
                      <textarea
                        rows={3}
                        placeholder="Help us improve EduAgent..."
                        value={feedbackMsg}
                        onChange={e => setFeedbackMsg(e.target.value)}
                        className="w-full p-3 rounded-lg border border-white/5 bg-[#0d0f12] text-xs focus:outline-none focus:border-cyan-500/50"
                        required
                      />
                    </div>

                    <Button type="submit" disabled={submittingFeedback} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold h-10 px-5 text-xs">
                      {submittingFeedback ? "Sending..." : "Submit Feedback"}
                    </Button>
                  </form>

                  {/* Active Support Tickets */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-white">Your Submitted Tickets ({tickets.length})</h3>
                    {tickets.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic">No tickets submitted.</p>
                    ) : (
                      <div className="divide-y divide-white/5 border border-white/5 rounded-xl bg-[#14161a] overflow-hidden">
                        {tickets.map((t: any) => (
                          <div key={t.id} className="p-4 flex justify-between items-start gap-4 text-xs">
                            <div className="space-y-1">
                              <span className="font-semibold text-white block">{t.subject}</span>
                              <p className="text-slate-400 text-[10px]">{t.message}</p>
                              <span className="text-[9px] text-slate-500 block">{new Date(t.created_at).toLocaleDateString()}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold capitalize ${
                              t.status === "resolved" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                              t.status === "pending" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" :
                              "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                            }`}>{t.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "about" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">Version and Changelog</h2>
                    <p className="text-xs text-slate-500 mt-1">Deployment metrics and client release schedules.</p>
                  </div>

                  <div className="p-5 rounded-xl border border-white/5 bg-[#14161a] divide-y divide-white/5 text-xs">
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">EduAgent Client Version</span>
                      <span className="text-white font-bold">v1.2.0-stable</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">SaaS Framework Core</span>
                      <span className="text-white font-semibold">Next.js 16 (Turbopack)</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">Active Database Schema</span>
                      <span className="text-white font-semibold">Supabase PostgreSQL 15</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-white">Changelog Updates</h3>
                    <div className="p-5 rounded-xl border border-white/5 bg-[#14161a]/60 text-xs text-slate-400 space-y-3 leading-relaxed">
                      <div>
                        <span className="font-bold text-white block mb-1">Release v1.2.0 (Stable Edition)</span>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Redesigned account configurations and user profile data fields.</li>
                          <li>Connected support tickets queues and client feedback databases.</li>
                          <li>Enabled live student aggregate telemetry grids.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
