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
  Loader2,
  Search,
  School,
  GraduationCap
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildProfileUpdatePayload, stripUndefined } from "@/lib/profile";

type TabId = "profile" | "preferences" | "subscription" | "security" | "stats" | "support" | "about";

export default function AccountPage() {
  const router = useRouter();
  const { user, profile, refreshProfile, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  // Profile Form States
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [institution, setInstitution] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [institutionType, setInstitutionType] = useState("University");
  const [department, setDepartment] = useState("");
  const [studyLevel, setStudyLevel] = useState("");
  const [studyGoals, setStudyGoals] = useState<string[]>([]);
  const [isStudent, setIsStudent] = useState(true);
  const [gender, setGender] = useState("");
  const [age, setAge] = useState<number | "">("");

  // Search and custom school integration states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);

  // States for custom institution creation inside settings
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState("University");
  const [customState, setCustomState] = useState("");
  const [customCountry, setCustomCountry] = useState("Nigeria");
  const [customSubmitting, setCustomSubmitting] = useState(false);

  // Debounced search query for account settings
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const typeFilter = institutionType === "Organization" ? "Other" : institutionType;
    const delayDebounceFn = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await fetch(`/api/institutions/search?query=${encodeURIComponent(searchQuery)}&type=${encodeURIComponent(typeFilter)}`);
        const json = await res.json();
        if (json.success && json.data) {
          setSearchResults(json.data);
        }
      } catch (err) {
        console.error("Failed to search institutions:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, institutionType]);

  const handleSelectInstitution = (inst: any) => {
    setInstitution(inst.name);
    setInstitutionId(inst.id);
    setInstitutionType(inst.institution_type);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleAddCustomInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    try {
      setCustomSubmitting(true);
      const res = await fetch("/api/institutions/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customName,
          institution_type: customType,
          state: customState,
          country: customCountry
        })
      });
      const json = await res.json();
      if (json.success && json.data) {
        setInstitution(json.data.name);
        setInstitutionId(json.data.id);
        setInstitutionType(json.data.institution_type);
        setShowCustomForm(false);
        setCustomName("");
        setCustomState("");
      } else {
        alert(json.error || "Failed to create custom institution");
      }
    } catch (err) {
      console.error("Error creating custom institution:", err);
      alert("An error occurred. Please try again.");
    } finally {
      setCustomSubmitting(false);
    }
  };

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
  const [quotaUsage, setQuotaUsage] = useState<any>(null);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [redeemingCoupon, setRedeemingCoupon] = useState(false);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

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
          setInstitutionId(profile.institution_id || "");
          setInstitutionType(profile.institution_type || "University");
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

        // Fetch dynamic quota usage and history
        const billingRes = await fetch("/api/account/billing").then(res => res.json()).catch(() => null);
        if (billingRes && billingRes.success) {
          setQuotaUsage(billingRes.quota);
          setBillingHistory(billingRes.history || []);
        } else {
          // fallback to usage endpoint
          const usageRes = await fetch("/api/account/usage").then(res => res.json()).catch(() => null);
          if (usageRes) {
            setQuotaUsage(usageRes);
          }
        }

        // Fetch invoices
        const invoicesRes = await fetch("/api/account/invoices").then(res => res.json()).catch(() => null);
        if (invoicesRes && invoicesRes.success) {
          setInvoices(invoicesRes.invoices || []);
        }
      } catch (err) {
        console.error("[account] Error loading details:", err);
      } finally {
        setLoadingData(false);
      }
    }

    void loadData();
  }, [user, supabase, profile]);

  const handleRedeemCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    try {
      setRedeemingCoupon(true);
      setCouponMessage(null);
      setCouponError(null);

      const res = await fetch("/api/account/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode }),
      });
      const data = await res.json();
      if (data.success) {
        setCouponMessage(data.message || "Coupon successfully applied!");
        setCouponCode("");
        // Reload details
        const usageRes = await fetch("/api/account/usage").then(r => r.json()).catch(() => null);
        if (usageRes) {
          setQuotaUsage(usageRes);
        }
        window.location.reload();
      } else {
        setCouponError(data.error || "Failed to apply coupon.");
      }
    } catch (err) {
      setCouponError("Network error applying coupon.");
    } finally {
      setRedeemingCoupon(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !supabase) return;

    try {
      setProfileSaving(true);
      setProfileMessage(null);
      setProfileError(null);

      const profilePayload = stripUndefined(buildProfileUpdatePayload({
        firstName,
        lastName,
        avatarUrl: profile?.avatarUrl,
        institution,
        institutionId,
        institutionType,
        department,
        studyLevel,
        studyGoals,
        isStudent,
        gender,
        age,
        teachingStyle,
        difficulty,
        preferredQuizFormat,
        preferredLanguage,
        flashcardPreference,
        responseLength,
        voicePreference,
        studyReminderEnabled,
        marketingUpdatesEnabled,
        securityAlertsEnabled,
        dailyGoalMinutes,
        preferredTheme,
        accountType: isStudent ? "Student" : profile?.accountType || "Professional",
        country: profile?.country,
        timezone: profile?.timezone,
        faculty: profile?.faculty,
        occupation: profile?.occupation,
        industry: profile?.industry,
        field: profile?.field,
        bio: profile?.bio,
        favoriteSubjects: profile?.favoriteSubjects,
        interests: profile?.interests,
        accessibilityPreferences: profile?.accessibilityPreferences,
        learningPreferences: profile?.learningPreferences,
      }));

      const { error: profileErr } = await supabase
        .from("profiles")
        .update(profilePayload)
        .eq("id", user.id);

      if (profileErr) throw profileErr;

      // Log event
      await supabase.from("events").insert({
        user_id: user.id,
        event_type: "profile_updated",
        properties: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        }
      });

      setProfileMessage("Your preferences and account settings have been saved.");
      await refreshProfile();

      // Refresh quota usage after save
      const usageRes = await fetch("/api/account/usage").then(res => res.json()).catch(() => null);
      if (usageRes) {
        setQuotaUsage(usageRes);
      }
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
      <div className="h-full flex flex-col overflow-hidden bg-[#0d0f12]">
        
        {/* Premium Top Sub-Navigation Header */}
        <div className="bg-[#111317] border-b border-white/5 px-6 md:px-8 py-3.5 shrink-0 sticky top-0 z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-full py-0.5">
              {sidebarTabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all select-none ${
                      active 
                        ? "bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/20 shadow-sm" 
                        : "text-slate-400 hover:text-slate-200 hover:bg-[#1a1c22]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <div className="hidden lg:block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Account Center
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 scrollbar-thin">
          <div className="max-w-2xl mx-auto md:py-4">
          
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
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5 relative">
                          <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Institution / School</label>
                          {!showCustomForm ? (
                            <>
                              {/* Selection badge */}
                              {institution ? (
                                <div className="p-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 flex items-center justify-between text-xs h-11">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <GraduationCap className="h-4 w-4 text-cyan-400 shrink-0" />
                                    <div className="truncate">
                                      <span className="text-white font-bold text-xs block truncate">{institution}</span>
                                      <span className="text-[9px] text-slate-500 font-medium block uppercase tracking-wider">{institutionType}</span>
                                    </div>
                                  </div>
                                  <Button 
                                    type="button"
                                    variant="ghost" 
                                    onClick={() => {
                                      setInstitution("");
                                      setInstitutionId("");
                                    }}
                                    className="h-7 px-2 text-[10px] text-slate-400 hover:text-white border border-white/5 rounded-lg shrink-0"
                                  >
                                    Clear
                                  </Button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {/* Filter Tabs */}
                                  <div className="grid grid-cols-4 gap-1 p-0.5 bg-[#0a0a0a]/50 rounded-lg border border-white/5 text-[9px] font-semibold text-center text-slate-400">
                                    {["University", "Polytechnic", "College of Education", "Secondary School"].map((t) => (
                                      <button
                                        key={t}
                                        type="button"
                                        onClick={() => {
                                          setInstitutionType(t);
                                          setSearchQuery("");
                                          setSearchResults([]);
                                        }}
                                        className={`py-1 rounded transition-colors truncate ${
                                          institutionType === t 
                                            ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/10 font-bold" 
                                            : "hover:text-white"
                                        }`}
                                      >
                                        {t === "College of Education" ? "COE" : t}
                                      </button>
                                    ))}
                                  </div>

                                  <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                                    <Input 
                                      value={searchQuery} 
                                      onChange={e => setSearchQuery(e.target.value)} 
                                      placeholder={`Search ${institutionType.toLowerCase()}s...`}
                                      className="bg-[#14161a] border-white/5 h-11 pl-9 pr-4 placeholder:text-slate-600 text-xs"
                                    />
                                  </div>

                                  {isSearching && (
                                    <div className="flex items-center justify-center py-4 bg-[#14161a]/30 rounded-xl border border-white/5">
                                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent"></div>
                                    </div>
                                  )}

                                  {!isSearching && searchQuery.trim() !== "" && (
                                    <div className="border border-white/5 bg-[#14161a] rounded-xl max-h-[160px] overflow-y-auto divide-y divide-white/5 absolute left-0 right-0 z-20 shadow-xl pr-1">
                                      {searchResults.length > 0 ? (
                                        searchResults.map((inst) => (
                                          <button
                                            key={inst.id}
                                            type="button"
                                            onClick={() => handleSelectInstitution(inst)}
                                            className="w-full text-left px-3 py-2.5 hover:bg-cyan-500/5 hover:text-white text-xs transition-colors flex items-center justify-between gap-2"
                                          >
                                            <div className="flex items-center gap-2 min-w-0">
                                              {inst.institution_type === "Secondary School" ? (
                                                <School className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                                              ) : (
                                                <GraduationCap className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                                              )}
                                              <div className="truncate">
                                                <span className="font-semibold text-slate-200 text-xs block truncate">
                                                  {inst.name}
                                                  {inst.short_name ? ` (${inst.short_name})` : ""}
                                                </span>
                                                <span className="text-[9px] text-slate-500 block">
                                                  {inst.city ? `${inst.city}, ` : ""}{inst.state ? `${inst.state}, ` : ""}{inst.country}
                                                </span>
                                              </div>
                                            </div>
                                          </button>
                                        ))
                                      ) : (
                                        <div className="p-3 text-center space-y-2">
                                          <p className="text-[10px] text-slate-500">Can't find your school?</p>
                                          <Button
                                            type="button"
                                            onClick={() => {
                                              setCustomName(searchQuery);
                                              setCustomType(institutionType);
                                              setShowCustomForm(true);
                                            }}
                                            className="h-8 px-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-[10px] font-semibold"
                                          >
                                            + Add my institution
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="p-4 rounded-xl border border-white/5 bg-[#1a1c22] space-y-3 text-left">
                              <span className="text-xs font-semibold text-white block">Add Custom Institution</span>
                              
                              <div className="space-y-1">
                                <label className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Institution Name</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. Lagos City Academy"
                                  value={customName}
                                  onChange={(e) => setCustomName(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg bg-[#14161a] border border-white/5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Type</label>
                                  <select
                                    value={customType}
                                    onChange={(e) => setCustomType(e.target.value)}
                                    className="w-full px-2 py-1.5 rounded-lg bg-[#14161a] border border-white/5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
                                  >
                                    {["University", "Polytechnic", "College of Education", "Secondary School", "Primary School", "Other"].map(t => (
                                      <option key={t} value={t} className="bg-slate-950">{t}</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">State</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Lagos"
                                    value={customState}
                                    onChange={(e) => setCustomState(e.target.value)}
                                    className="w-full px-3 py-1.5 rounded-lg bg-[#14161a] border border-white/5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Country</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. Nigeria"
                                  value={customCountry}
                                  onChange={(e) => setCustomCountry(e.target.value)}
                                  className="w-full px-3 py-1.5 rounded-lg bg-[#14161a] border border-white/5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                                />
                              </div>

                              <div className="flex gap-2 pt-1.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => setShowCustomForm(false)}
                                  className="flex-1 h-8 text-[10px] rounded-lg border border-white/5 text-slate-400 hover:text-white"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  disabled={customSubmitting}
                                  onClick={handleAddCustomInstitution}
                                  className="flex-1 h-8 text-[10px] rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                                >
                                  {customSubmitting ? "Saving..." : "Add & Select"}
                                </Button>
                              </div>
                            </div>
                          )}
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
                    <h2 className="text-xl font-bold text-white">Billing & API Quotas</h2>
                    <p className="text-xs text-slate-500 mt-1">Monitor plan quotas, monthly API limits, and storage usage.</p>
                  </div>

                  {/* Coupon Alerts */}
                  {couponMessage && (
                    <div className="flex items-center gap-2 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-300">
                      <Check className="h-4 w-4 shrink-0" /> {couponMessage}
                    </div>
                  )}
                  {couponError && (
                    <div className="flex items-center gap-2 p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-300">
                      <AlertCircle className="h-4 w-4 shrink-0" /> {couponError}
                    </div>
                  )}

                  {/* Plan Card */}
                  <div className="p-5 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Plan level</span>
                        <h3 className="text-2xl font-bold text-white capitalize flex items-center gap-2">
                          Lerna {profile?.plan || quotaUsage?.plan || "Free"} <span className="text-xs px-2.5 py-0.5 bg-cyan-500/10 text-cyan-400 rounded-full font-semibold border border-cyan-500/10">Active</span>
                        </h3>
                      </div>
                      <span className="text-3xl font-bold text-white">
                        {quotaUsage?.plan === "premium" ? "₦9,900" :
                         quotaUsage?.plan === "pro" ? "₦5,200" :
                         quotaUsage?.plan === "team" ? "₦9,900" :
                         quotaUsage?.plan === "enterprise" ? "₦9,900" : "₦0"} <span className="text-xs text-slate-500 font-normal">/month</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-[10px] text-slate-400 pt-2 border-t border-white/5">
                      <div>Status: <strong className="text-white capitalize">{quotaUsage?.subscription?.subscriptionStatus || "Active"}</strong></div>
                      <div>Cycle: <strong className="text-white capitalize">{quotaUsage?.subscription?.billingCycle || "Monthly"}</strong></div>
                      <div>Period Start: <strong className="text-white">{quotaUsage?.subscription?.currentPeriodStart ? new Date(quotaUsage.subscription.currentPeriodStart).toLocaleDateString() : new Date().toLocaleDateString()}</strong></div>
                      <div>Renewal Date: <strong className="text-white">{quotaUsage?.subscription?.renewalDate ? new Date(quotaUsage.subscription.renewalDate).toLocaleDateString() : quotaUsage?.subscription?.currentPeriodEnd ? new Date(quotaUsage.subscription.currentPeriodEnd).toLocaleDateString() : "N/A"}</strong></div>
                    </div>

                    <div className="h-[1px] bg-white/5 w-full" />

                    {/* Features checklist */}
                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Included Features</span>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300">
                        {[
                          { key: "ai_chat", label: "AI Tutor Chat" },
                          { key: "advanced_quizzes", label: "Advanced Quizzes" },
                          { key: "puzzle_generation", label: "Puzzle Challenges" },
                          { key: "flashcards", label: "Recall Flashcards" },
                          { key: "ocr", label: "OCR Scan Scanning" },
                          { key: "voice_tutor", label: "Voice Tutor Sessions" },
                          { key: "unlimited_uploads", label: "Unlimited Uploads" },
                          { key: "analytics", label: "Advanced Analytics" },
                        ].map((feat) => {
                          const hasFeat = quotaUsage?.plan ? 
                            (quotaUsage.plan.toLowerCase() === "student" && ["ai_chat", "advanced_quizzes", "flashcards", "ocr", "voice_tutor"].includes(feat.key)) ||
                            (["pro", "premium", "team", "enterprise"].includes(quotaUsage.plan.toLowerCase()))
                            : ["ai_chat", "flashcards"].includes(feat.key);

                          return (
                            <div key={feat.key} className="flex items-center gap-1.5">
                              <span className={hasFeat ? "text-cyan-400 font-bold" : "text-slate-600"}>
                                {hasFeat ? "✓" : "✕"}
                              </span>
                              <span className={hasFeat ? "text-slate-200" : "text-slate-500 line-through"}>
                                {feat.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="h-[1px] bg-white/5 w-full" />

                    {/* Quota totals */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Remaining Limits</span>
                      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                        <div className="p-2 rounded bg-white/5">
                          <span className="text-slate-500 block">AI Requests</span>
                          <strong className="text-white">{quotaUsage?.remaining?.aiRequests ?? 0} left</strong>
                        </div>
                        <div className="p-2 rounded bg-white/5">
                          <span className="text-slate-500 block">OCR Pages</span>
                          <strong className="text-white">{quotaUsage?.remaining?.ocrPages ?? 0} left</strong>
                        </div>
                        <div className="p-2 rounded bg-white/5">
                          <span className="text-slate-500 block">Quizzes</span>
                          <strong className="text-white">{quotaUsage?.remaining?.quizzes ?? 0} left</strong>
                        </div>
                      </div>
                    </div>

                    {(profile?.plan !== "premium" && profile?.plan !== "pro" && profile?.plan !== "team" && profile?.plan !== "enterprise") && (
                      <Button className="w-full h-11 bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-bold rounded-lg flex items-center justify-center gap-2">
                        <Sparkles className="h-4 w-4" /> Upgrade to Premium Tier (₦9,900/month)
                      </Button>
                    )}
                  </div>

                  {/* Progress bars */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { 
                        label: "Monthly AI Requests", 
                        used: quotaUsage?.usage?.aiRequests || 0, 
                        limit: quotaUsage?.limits?.aiRequests || 100 
                      },
                      { 
                        label: "Daily AI Limit", 
                        used: quotaUsage?.usage?.dailyAiRequests || 0, 
                        limit: quotaUsage?.limits?.dailyRequests || 20 
                      },
                      { 
                        label: "Quiz Generations", 
                        used: quotaUsage?.usage?.quizzes || 0, 
                        limit: quotaUsage?.limits?.quizzes || 20 
                      },
                      { 
                        label: "Flashcard Generations", 
                        used: quotaUsage?.usage?.flashcards || 0, 
                        limit: quotaUsage?.limits?.flashcards || 50 
                      },
                      { 
                        label: "OCR Pages Limit", 
                        used: quotaUsage?.usage?.ocrPages || 0, 
                        limit: quotaUsage?.limits?.ocrPages || 5 
                      },
                      { 
                        label: "Voice Usage Minutes", 
                        used: Math.ceil((quotaUsage?.usage?.voiceSeconds || 0) / 60), 
                        limit: Math.ceil((quotaUsage?.limits?.voiceSeconds || 120) / 60),
                        percentage: Math.min(((quotaUsage?.usage?.voiceSeconds || 0) / (quotaUsage?.limits?.voiceSeconds || 120)) * 100, 100)
                      },
                      { 
                        label: "Storage Usage", 
                        used: formatBytes(quotaUsage?.usage?.storageBytes || 0), 
                        limit: formatBytes(quotaUsage?.limits?.storage || 52428800), 
                        percentage: Math.min(((quotaUsage?.usage?.storageBytes || 0) / (quotaUsage?.limits?.storage || 52428800)) * 100, 100) 
                      }
                    ].map((item, idx) => {
                      const isStorage = item.label === "Storage Usage";
                      const isVoice = item.label === "Voice Usage Minutes";
                      const pct = isStorage || isVoice 
                        ? (item as any).percentage 
                        : Math.min(((item.used as number) / (item.limit as number)) * 100, 100);

                      return (
                        <div key={idx} className="p-4 rounded-xl border border-white/5 bg-[#14161a] space-y-2">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">{item.label}</span>
                          <div className="flex justify-between items-baseline">
                            <span className="text-lg font-bold text-white">{item.used}</span>
                            <span className="text-[10px] text-slate-500">limit: {item.limit}</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Redeem Coupon */}
                  <div className="p-5 rounded-xl border border-white/5 bg-[#14161a] space-y-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      🎟 Redeem Promo Coupon
                    </h3>
                    <p className="text-[10px] text-slate-500">Enter a gift coupon code or promotional voucher to activate premium features.</p>
                    
                    <form onSubmit={handleRedeemCoupon} className="flex gap-2">
                      <Input
                        placeholder="ENTER COUPON CODE"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className="bg-[#0d0f12] border-white/5 uppercase font-semibold text-xs tracking-wider"
                        disabled={redeemingCoupon}
                      />
                      <Button
                        type="submit"
                        disabled={redeemingCoupon}
                        className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs h-10 px-5"
                      >
                        {redeemingCoupon ? "Applying..." : "Redeem"}
                      </Button>
                    </form>
                  </div>

                  {/* Empty States for Billing History & Invoices */}
                  <div className="space-y-4">
                    <div className="space-y-2.5">
                      <h3 className="text-sm font-bold text-white">Billing History & Transactions</h3>
                      {billingHistory.length === 0 ? (
                        <div className="p-5 rounded-xl border border-white/5 bg-[#14161a] text-center text-xs text-slate-500 italic">
                          No transactions found. Standard accounts are created with free test plans.
                        </div>
                      ) : (
                        <div className="border border-white/5 bg-[#14161a] rounded-xl overflow-hidden text-[11px]">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-white/5 text-slate-400 bg-white/[0.02]">
                                <th className="p-3 font-semibold">Date</th>
                                <th className="p-3 font-semibold">Reference</th>
                                <th className="p-3 font-semibold">Amount</th>
                                <th className="p-3 font-semibold">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {billingHistory.map((t) => (
                                <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.01]">
                                  <td className="p-3">{new Date(t.created_at).toLocaleDateString()}</td>
                                  <td className="p-3 font-mono">{t.reference}</td>
                                  <td className="p-3">{t.amount} {t.currency}</td>
                                  <td className="p-3 capitalize text-cyan-400 font-semibold">{t.status}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      <h3 className="text-sm font-bold text-white">Invoices</h3>
                      {invoices.length === 0 ? (
                        <div className="p-5 rounded-xl border border-white/5 bg-[#14161a] text-center text-xs text-slate-500 italic">
                          No invoices generated yet.
                        </div>
                      ) : (
                        <div className="border border-white/5 bg-[#14161a] rounded-xl overflow-hidden text-[11px]">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-white/5 text-slate-400 bg-white/[0.02]">
                                <th className="p-3 font-semibold">Invoice #</th>
                                <th className="p-3 font-semibold">Issued Date</th>
                                <th className="p-3 font-semibold">Amount</th>
                                <th className="p-3 font-semibold">Status</th>
                                <th className="p-3 font-semibold">Receipt</th>
                              </tr>
                            </thead>
                            <tbody>
                              {invoices.map((inv) => (
                                <tr key={inv.id} className="border-b border-white/5 hover:bg-white/[0.01]">
                                  <td className="p-3 font-mono">{inv.invoice_number}</td>
                                  <td className="p-3">{new Date(inv.issued_at).toLocaleDateString()}</td>
                                  <td className="p-3">{inv.amount} {inv.currency}</td>
                                  <td className="p-3 capitalize">{inv.status}</td>
                                  <td className="p-3">
                                    {inv.pdf_url ? (
                                      <a href={inv.pdf_url} target="_blank" rel="noreferrer" className="text-cyan-400 underline">Download</a>
                                    ) : (
                                      <span className="text-slate-500">Not Available</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
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
                        placeholder="Help us improve Lerna..."
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
                      <span className="text-slate-500">Lerna Client Version</span>
                      <span className="text-white font-bold">v1.2.0-stable</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500"> Framework Core</span>
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
      </div>
    </DashboardShell>
  );
}
