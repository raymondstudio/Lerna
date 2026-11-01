"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { 
  User as UserIcon, 
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
  GraduationCap,
  Copy,
  LogOut,
  X,
  Palette,
  Heart,
  Zap,
  Building,
  Briefcase,
  ChevronRight,
  CheckCircle2,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { PaymentModal } from "@/components/payments/PaymentModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ONBOARDING_ACCOUNT_TYPES, type OnboardingAccountType } from "@/lib/onboarding";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SettingsTabId = 
  | "account" 
  | "billing" 
  | "appearance" 
  | "preferences" 
  | "capabilities" 
  | "notifications" 
  | "security" 
  | "wellbeing" 
  | "stats" 
  | "support" 
  | "about";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
}

export function SettingsModal({ isOpen, onClose, initialTab }: SettingsModalProps) {
  const router = useRouter();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  const [activeTab, setActiveTab] = useState<SettingsTabId>(
    (initialTab as SettingsTabId) || "account"
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Sync tab if initialTab changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab as SettingsTabId);
    }
  }, [initialTab]);

  // Profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accountType, setAccountType] = useState<OnboardingAccountType>("Student");
  const [institution, setInstitution] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [institutionType, setInstitutionType] = useState("University");
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const [studyLevel, setStudyLevel] = useState("");
  const [studyGoals, setStudyGoals] = useState<string[]>([]);
  const [company, setCompany] = useState("");
  const [occupation, setOccupation] = useState("");
  const [industry, setIndustry] = useState("");
  const [field, setField] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [gender, setGender] = useState("");
  const [age, setAge] = useState<number | "">("");

  // Search & custom school
  const [schoolSearchQuery, setSchoolSearchQuery] = useState("");
  const [schoolSearchResults, setSchoolSearchResults] = useState<any[]>([]);
  const [isSearchingSchool, setIsSearchingSchool] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState("University");
  const [customState, setCustomState] = useState("");
  const [customCountry, setCustomCountry] = useState("Nigeria");
  const [customSubmitting, setCustomSubmitting] = useState(false);

  // Email update
  const [newEmail, setNewEmail] = useState("");
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Password update
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Learning preferences
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

  // Telemetry & stats
  const [stats, setStats] = useState({
    streak: 0,
    questions: 0,
    documents: 0,
    sessions: 0,
    hours: 0,
    lastActive: null as string | null,
  });

  // Billing & quotas
  const [quotaUsage, setQuotaUsage] = useState<any>(null);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [redeemingCoupon, setRedeemingCoupon] = useState(false);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Payment modal
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<"pro" | "premium">("pro");

  // Support & tickets
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState<string | null>(null);

  // Feedback
  const [feedbackType, setFeedbackType] = useState<"general" | "bug" | "feature">("general");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // UX Feedback states
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Trap body scroll & handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Load initial user data into form
  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.first_name || "");
    setLastName(profile.last_name || "");
    setDisplayName(profile.display_name || (profile.first_name ? `${profile.first_name} ${profile.last_name}`.trim() : ""));
    const savedType = ONBOARDING_ACCOUNT_TYPES.find(
      (type) => type.toLowerCase() === String(profile.account_type || "").toLowerCase()
    );
    setAccountType(savedType || (profile.is_student ? "Student" : "Other"));
    setInstitution(profile.institution || "");
    setInstitutionId(profile.institution_id || "");
    setInstitutionType(profile.institution_type || "University");
    setFaculty(profile.faculty || "");
    setDepartment(profile.department || "");
    setStudyLevel(profile.study_level || "");
    setStudyGoals(profile.study_goals || []);
    setCompany(profile.company || "");
    setOccupation(profile.occupation || "");
    setIndustry(profile.industry || "");
    setField(profile.field || "");
    setInterests(profile.interests || []);
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
  }, [profile]);

  // Load async telemetry, tickets, billing and stats via endpoints
  useEffect(() => {
    if (!isOpen || !user) return;

    let cancelled = false;
    async function fetchDetails() {
      try {
        setLoadingData(true);
        const [statsRes, billingRes, invoicesRes, ticketsRes] = await Promise.all([
          fetch("/api/account/stats").then((r) => r.json()).catch(() => null),
          fetch("/api/account/billing").then((r) => r.json()).catch(() => null),
          fetch("/api/account/invoices").then((r) => r.json()).catch(() => null),
          fetch("/api/tickets").then((r) => r.json()).catch(() => null),
        ]);

        if (cancelled) return;

        if (statsRes?.success && statsRes.data) {
          setStats(statsRes.data);
        }
        if (billingRes?.success) {
          setQuotaUsage(billingRes.quota);
          setBillingHistory(billingRes.history || []);
        } else {
          // Fallback to usage
          const usageRes = await fetch("/api/account/usage").then((r) => r.json()).catch(() => null);
          if (usageRes && !cancelled) setQuotaUsage(usageRes);
        }
        if (invoicesRes?.success && invoicesRes.invoices) {
          setInvoices(invoicesRes.invoices);
        }
        if (ticketsRes?.success && ticketsRes.data) {
          setTickets(ticketsRes.data);
        }
      } catch (err) {
        console.error("[SettingsModal] Error loading secondary data:", err);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }

    void fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [isOpen, user]);

  // School search debounce
  useEffect(() => {
    if (!schoolSearchQuery.trim()) {
      setSchoolSearchResults([]);
      return;
    }

    const typeFilter = institutionType === "Organization" ? "Other" : institutionType;
    const timeout = setTimeout(async () => {
      try {
        setIsSearchingSchool(true);
        const res = await fetch(`/api/institutions/search?query=${encodeURIComponent(schoolSearchQuery)}&type=${encodeURIComponent(typeFilter)}`);
        const json = await res.json();
        if (json.success && json.data) {
          setSchoolSearchResults(json.data);
        }
      } catch (err) {
        console.error("Failed to search institutions:", err);
      } finally {
        setIsSearchingSchool(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [schoolSearchQuery, institutionType]);

  const handleSelectInstitution = (inst: any) => {
    setInstitution(inst.name);
    setInstitutionId(inst.id);
    setInstitutionType(inst.institution_type);
    setSchoolSearchQuery("");
    setSchoolSearchResults([]);
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
          country: customCountry,
        }),
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
    } finally {
      setCustomSubmitting(false);
    }
  };

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSavingProfile(true);
      setProfileMessage(null);
      setProfileError(null);

      const payload = {
        firstName,
        lastName,
        displayName: displayName || `${firstName} ${lastName}`.trim(),
        avatarUrl: profile?.avatarUrl,
        accountType,
        institution,
        institutionId,
        institutionType,
        faculty,
        department,
        studyLevel,
        studyGoals: studyGoals.filter(Boolean),
        company,
        occupation,
        industry,
        field,
        interests,
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
        isStudent: accountType === "Student",
      };

      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save settings");
      }

      setProfileMessage("Saved successfully");
      await refreshProfile();
      setTimeout(() => setProfileMessage(null), 3500);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCopyUserId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

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
        await refreshProfile();
      } else {
        setCouponError(data.error || "Failed to apply coupon.");
      }
    } catch (err) {
      setCouponError("Network error applying coupon.");
    } finally {
      setRedeemingCoupon(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    try {
      setUpdatingEmail(true);
      setEmailMessage(null);
      setEmailError(null);

      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error("Client connection unavailable");
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;

      setEmailMessage("Verification link sent. Please check your new email inbox.");
      setNewEmail("");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to update email.");
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    try {
      setUpdatingPassword(true);
      setPasswordError(null);
      setPasswordSuccess(null);

      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error("Client connection unavailable");
      const { error } = await supabase.auth.updateUser({ password: newPassword.trim() });
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
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    try {
      await supabase.auth.signOut({ scope: "global" });
      onClose();
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
        body: JSON.stringify({ subject: ticketSubject, message: ticketMessage }),
      });
      const json = await res.json();
      if (json.success) {
        setTicketSuccess("Support ticket created. Our team will review it shortly.");
        setTicketSubject("");
        setTicketMessage("");
        setTickets((prev) => [json.data, ...prev]);
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
        body: JSON.stringify({ type: feedbackType, message: feedbackMsg, rating: feedbackRating }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackSuccess("Thank you! Your feedback has been received.");
        setFeedbackMsg("");
      } else {
        alert(json.error || "Failed to submit feedback.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Device detection for sessions
  const getDeviceDetails = () => {
    if (typeof window === "undefined") return { browser: "Google Chrome", os: "macOS" };
    const ua = navigator.userAgent;
    let browser = "Google Chrome";
    let os = "macOS";
    if (ua.includes("Firefox")) browser = "Mozilla Firefox";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
    else if (ua.includes("Edg")) browser = "Microsoft Edge";

    if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("Linux")) os = "Linux";
    return { browser, os };
  };

  const currentDevice = getDeviceDetails();

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Navigation tabs matching the Claude layout
  const allTabs = useMemo(() => [
    {
      group: "main",
      items: [
        { id: "account", label: "Account", icon: UserIcon, keywords: "profile account name photo role school id session device user avatar" },
        { id: "billing", label: "Billing", icon: CreditCard, keywords: "billing subscription plan pro premium payment coupon invoice quota limits storage" },
      ],
    },
    {
      group: "preferences",
      items: [
        { id: "appearance", label: "Appearance", icon: Palette, keywords: "appearance theme dark light mode contrast density" },
        { id: "preferences", label: "Your Lerna", icon: Sparkles, keywords: "tutor learning style difficulty quiz flashcard voice language tone preferences" },
        { id: "capabilities", label: "Capabilities", icon: Zap, keywords: "capabilities model gemini rag textbook ground step by step formulas katex" },
        { id: "notifications", label: "Notifications", icon: Bell, keywords: "notifications reminder email alerts updates marketing" },
        { id: "security", label: "Privacy & Security", icon: Shield, keywords: "privacy security password email passkey login google auth devices" },
        { id: "wellbeing", label: "Wellbeing & Goals", icon: Heart, keywords: "wellbeing daily goal streak time minutes focus" },
      ],
    },
    {
      group: "footer",
      items: [
        { id: "stats", label: "Performance Stats", icon: BarChart3, keywords: "stats analytics streak hours questions uploads telemetry metrics" },
        { id: "support", label: "Support & Feedback", icon: HelpCircle, keywords: "support help faq ticket bug feature rating contact" },
        { id: "about", label: "Release Info", icon: Info, keywords: "about release version changelog deployment nextjs supabase" },
      ],
    },
  ], []);

  // Filter tabs based on search query
  const filteredTabGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allTabs;

    return allTabs
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.keywords.toLowerCase().includes(q)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [allTabs, searchQuery]);

  const usesInstitution = accountType === "Student" || accountType === "Teacher" || accountType === "Researcher";
  const userInitials = (displayName || firstName || user?.email || "U")
    .slice(0, 2)
    .toUpperCase();

  if (!mounted) return null;

  const portal = createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Modal Container */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", duration: 0.3, bounce: 0 }}
            className="relative flex h-[90vh] max-h-[740px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl md:rounded-3xl border border-white/10 bg-[#141414] shadow-2xl"
          >
            {/* Modal Header */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 bg-[#141414] px-5 sm:px-6">
              <h2 id={titleId} className="font-heading text-base font-semibold text-white tracking-tight">
                Settings
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close settings"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body: Two Columns */}
            <div className="flex min-h-0 flex-1 flex-col md:flex-row overflow-hidden">
              {/* Left Sidebar */}
              <div className="flex w-full md:w-56 lg:w-60 shrink-0 flex-col border-b md:border-b-0 md:border-r border-white/5 bg-[#141414] p-3 space-y-3">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-11 w-full rounded-lg bg-[#1f1f23] pl-10 pr-9 text-base text-slate-200 placeholder:text-slate-500 border border-white/5 focus:border-cyan-500/40 focus:outline-none transition-colors md:h-8 md:pl-9 md:pr-7 md:text-xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-slate-500 hover:text-slate-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Navigation Items (Scrollable if many) */}
                <div className="flex-1 overflow-x-auto md:overflow-y-auto space-y-2 py-1 scrollbar-none flex md:flex-col">
                  {filteredTabGroups.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-slate-500">
                      No matching settings
                    </div>
                  ) : (
                    filteredTabGroups.map((group, gIdx) => (
                      <div key={gIdx} className="space-y-0.5 flex md:flex-col gap-1 md:gap-0">
                        {gIdx > 0 && <div className="hidden md:block my-2 h-px bg-white/5" />}
                        {group.items.map((tab) => {
                          const Icon = tab.icon;
                          const active = activeTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setActiveTab(tab.id as SettingsTabId)}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left whitespace-nowrap shrink-0 md:w-full ${
                                active
                                  ? "bg-[#252528] text-white font-semibold shadow-sm"
                                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                              }`}
                            >
                              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-cyan-400" : "text-slate-400"}`} />
                              <span>{tab.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Content Area */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-7 md:p-8 space-y-6 scrollbar-thin bg-[#111215]">
                {/* ACCOUNT TAB */}
                {activeTab === "account" && (
                  <div className="space-y-6 max-w-2xl animate-in fade-in duration-150">
                    <div>
                      <h3 className="text-base font-semibold text-white tracking-tight">Profile</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Manage your identity, academic context, and active sessions.</p>
                    </div>

                    {profileMessage && (
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                        <Check className="h-4 w-4 shrink-0" /> {profileMessage}
                      </div>
                    )}
                    {profileError && (
                      <div className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-300">
                        <AlertCircle className="h-4 w-4 shrink-0" /> {profileError}
                      </div>
                    )}

                    {/* Profile Photo */}
                    <div className="flex items-center justify-between py-3 border-b border-white/5">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-white block">Profile photo</span>
                        <span className="text-[11px] text-slate-500 block">PNG, JPEG, or WebP, up to 10MB.</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-600 to-cyan-400 font-bold text-white text-sm shadow-md">
                          {userInitials}
                        </div>
                      </div>
                    </div>

                    {/* Full Name */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300">First name</label>
                        <Input
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="e.g. Sara"
                          className="bg-[#18191d] border-white/10 h-10 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300">Last name</label>
                        <Input
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="e.g. Connor"
                          className="bg-[#18191d] border-white/10 h-10 text-xs"
                        />
                      </div>
                    </div>

                    {/* What should Lerna call you? */}
                    <div className="space-y-1.5 py-1">
                      <label className="text-xs font-medium text-slate-300">What should Lerna call you?</label>
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Preferred name or nickname"
                        className="bg-[#18191d] border-white/10 h-10 text-xs"
                      />
                    </div>

                    {/* What best describes your work? */}
                    <div className="space-y-1.5 py-1">
                      <label className="text-xs font-medium text-slate-300">What best describes your work?</label>
                      <select
                        value={accountType}
                        onChange={(e) => setAccountType(e.target.value as OnboardingAccountType)}
                        className="w-full h-10 px-3 rounded-lg border border-white/10 bg-[#18191d] text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-500/50"
                      >
                        {ONBOARDING_ACCOUNT_TYPES.map((type) => (
                          <option key={type} value={type} className="bg-[#18191d]">
                            {type === "Teacher" ? "Teacher / Educator" : type}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Institution Selector for Students/Teachers/Researchers */}
                    {usesInstitution && (
                      <div className="space-y-3 rounded-xl border border-white/5 bg-[#141518] p-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300">Institution / School</label>
                          {institution ? (
                            <div className="flex items-center justify-between p-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 text-xs">
                              <div className="flex items-center gap-2.5 truncate">
                                <GraduationCap className="h-4 w-4 text-cyan-400 shrink-0" />
                                <div className="truncate">
                                  <span className="font-semibold text-white block truncate">{institution}</span>
                                  <span className="text-[10px] text-slate-500">{institutionType}</span>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                  setInstitution("");
                                  setInstitutionId("");
                                }}
                                className="h-7 px-2.5 text-[11px] text-slate-400 hover:text-white"
                              >
                                Change
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                                <Input
                                  value={schoolSearchQuery}
                                  onChange={(e) => setSchoolSearchQuery(e.target.value)}
                                  placeholder={`Search universities or schools...`}
                                  className="bg-[#18191d] border-white/10 h-10 pl-9 pr-4 text-xs"
                                />
                              </div>
                              {isSearchingSchool && (
                                <div className="py-2 text-center text-xs text-slate-500">Searching institutions...</div>
                              )}
                              {!isSearchingSchool && schoolSearchResults.length > 0 && (
                                <div className="max-h-40 overflow-y-auto divide-y divide-white/5 rounded-lg border border-white/10 bg-[#18191d]">
                                  {schoolSearchResults.map((inst) => (
                                    <button
                                      key={inst.id}
                                      type="button"
                                      onClick={() => handleSelectInstitution(inst)}
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-cyan-500/10 text-slate-200 transition-colors flex items-center justify-between"
                                    >
                                      <span className="truncate">{inst.name}</span>
                                      <span className="text-[10px] text-slate-500">{inst.institution_type}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Department / Major</label>
                            <Input
                              value={department}
                              onChange={(e) => setDepartment(e.target.value)}
                              placeholder="e.g. Computer Science"
                              className="bg-[#18191d] border-white/10 h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Study Level</label>
                            <Input
                              value={studyLevel}
                              onChange={(e) => setStudyLevel(e.target.value)}
                              placeholder="e.g. Undergraduate"
                              className="bg-[#18191d] border-white/10 h-9 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Professional fields */}
                    {accountType === "Professional" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-white/5 bg-[#141518] p-4">
                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-400">Company</label>
                          <Input
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            placeholder="e.g. Acme Corp"
                            className="bg-[#18191d] border-white/10 h-9 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-400">Role / Title</label>
                          <Input
                            value={occupation}
                            onChange={(e) => setOccupation(e.target.value)}
                            placeholder="e.g. Product Designer"
                            className="bg-[#18191d] border-white/10 h-9 text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {/* Account ID / Organization ID */}
                    <div className="flex items-center justify-between py-3 border-y border-white/5">
                      <span className="text-xs font-medium text-slate-300">Account ID</span>
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-[#1a1c22] px-2 py-1 font-mono text-[11px] text-slate-400 border border-white/5">
                          {user?.id || "N/A"}
                        </code>
                        <button
                          type="button"
                          onClick={handleCopyUserId}
                          title="Copy Account ID"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                        >
                          {copiedId ? <Check className="h-3.5 w-3.5 text-cyan-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Where you're logged in */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">Where you're logged in</span>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleLogoutAllDevices}
                          className="h-8 px-3 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
                        >
                          Log out of all devices
                        </Button>
                      </div>

                      <div className="rounded-xl border border-white/5 bg-[#16171b] overflow-hidden text-xs">
                        <div className="flex items-center justify-between p-3.5">
                          <div className="flex items-center gap-3">
                            <Monitor className="h-4 w-4 text-cyan-400 shrink-0" />
                            <div>
                              <div className="flex items-center gap-2 font-medium text-white">
                                <span>{currentDevice.browser} ({currentDevice.os})</span>
                                <span className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[9px] font-bold text-cyan-400">
                                  Current
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-500">
                                {profile?.country ? `${profile.country}` : "Active Session"}
                              </span>
                            </div>
                          </div>
                          <div className="text-right text-[11px] text-slate-400">
                            <div>Signed in: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "Active"}</div>
                            <div className="text-slate-500">Last active: Just now</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Save Changes Button */}
                    <div className="pt-4 flex justify-end">
                      <Button
                        type="button"
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                        className="h-10 px-6 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-glow transition-all"
                      >
                        {savingProfile ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Saving…
                          </>
                        ) : (
                          "Save changes"
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* BILLING TAB */}
                {activeTab === "billing" && (
                  <div className="space-y-6 max-w-2xl animate-in fade-in duration-150">
                    <div>
                      <h3 className="text-base font-semibold text-white tracking-tight">Billing & Plans</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Manage your current subscription, quotas, and invoices.</p>
                    </div>

                    {/* Current Plan Card */}
                    <div className="p-5 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-transparent space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Current plan</span>
                          <h4 className="text-xl font-bold text-white capitalize mt-0.5 flex items-center gap-2">
                            Lerna {profile?.plan || quotaUsage?.plan || "Free"}
                            <span className="text-[10px] px-2 py-0.5 bg-cyan-500/15 text-cyan-400 rounded-full font-bold border border-cyan-500/20">
                              Active
                            </span>
                          </h4>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-white">
                            {quotaUsage?.plan === "premium" ? "₦9,900" :
                             quotaUsage?.plan === "pro" ? "₦5,200" : "₦0"}
                          </span>
                          <span className="text-xs text-slate-500 font-normal">/month</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs text-slate-400 pt-3 border-t border-white/5">
                        <div>Billing Cycle: <strong className="text-white capitalize">{quotaUsage?.subscription?.billingCycle || "Monthly"}</strong></div>
                        <div>Status: <strong className="text-white capitalize">{quotaUsage?.subscription?.subscriptionStatus || "Active"}</strong></div>
                      </div>

                      {profile?.plan !== "pro" && profile?.plan !== "premium" && (
                        <Button
                          onClick={() => { setPaymentPlan("pro"); setPaymentOpen(true); }}
                          className="w-full h-10 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg flex items-center justify-center gap-2"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Upgrade to Pro Tier (₦5,200/mo)
                        </Button>
                      )}
                    </div>

                    {/* Usage Progress Bars */}
                    <div className="space-y-3">
                      <span className="text-xs font-semibold text-white block">Resource Usage & Quotas</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { label: "AI Requests", used: quotaUsage?.usage?.aiRequests || 0, limit: quotaUsage?.limits?.aiRequests || 100 },
                          { label: "Quiz Generations", used: quotaUsage?.usage?.quizzes || 0, limit: quotaUsage?.limits?.quizzes || 20 },
                          { label: "Flashcards Created", used: quotaUsage?.usage?.flashcards || 0, limit: quotaUsage?.limits?.flashcards || 50 },
                          { label: "Document Storage", used: formatBytes(quotaUsage?.usage?.storageBytes || 0), limit: formatBytes(quotaUsage?.limits?.storage || 52428800) },
                        ].map((item, idx) => (
                          <div key={idx} className="p-3.5 rounded-xl border border-white/5 bg-[#16171b] space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400 font-medium">{item.label}</span>
                              <span className="text-slate-500 text-[11px]">{item.used} / {item.limit}</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-cyan-400 transition-all duration-300" style={{ width: `35%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Coupon Redemption */}
                    <div className="p-4 rounded-xl border border-white/5 bg-[#16171b] space-y-3">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-white block">Redeem promotional coupon</span>
                        <span className="text-[11px] text-slate-500 block">Apply access vouchers or student grants.</span>
                      </div>
                      {couponMessage && <div className="text-xs text-emerald-400">{couponMessage}</div>}
                      {couponError && <div className="text-xs text-red-400">{couponError}</div>}
                      <form onSubmit={handleRedeemCoupon} className="flex gap-2">
                        <Input
                          placeholder="ENTER CODE"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          className="bg-[#121316] border-white/10 uppercase text-xs h-9"
                        />
                        <Button type="submit" disabled={redeemingCoupon} className="h-9 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs">
                          {redeemingCoupon ? "Applying…" : "Apply"}
                        </Button>
                      </form>
                    </div>

                    {/* Invoices */}
                    <div className="space-y-2.5">
                      <span className="text-xs font-semibold text-white block">Recent Invoices</span>
                      {invoices.length === 0 ? (
                        <div className="p-4 rounded-xl border border-white/5 bg-[#16171b] text-center text-xs text-slate-500 italic">
                          No invoices generated yet.
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5 rounded-xl border border-white/5 bg-[#16171b] overflow-hidden text-xs">
                          {invoices.map((inv) => (
                            <div key={inv.id} className="p-3 flex justify-between items-center">
                              <div>
                                <span className="font-mono text-white block">{inv.invoice_number}</span>
                                <span className="text-[10px] text-slate-500">{new Date(inv.issued_at).toLocaleDateString()}</span>
                              </div>
                              <span className="font-semibold text-cyan-400">{inv.amount} {inv.currency}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* APPEARANCE TAB */}
                {activeTab === "appearance" && (
                  <div className="space-y-6 max-w-2xl animate-in fade-in duration-150">
                    <div>
                      <h3 className="text-base font-semibold text-white tracking-tight">Appearance</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Customize theme, interface density, and visual accessibility.</p>
                    </div>

                    <div className="space-y-3">
                      <span className="text-xs font-medium text-slate-300 block">Theme selection</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { id: "dark", label: "Dark (Default)", desc: "Deep charcoal with cyan accents" },
                          { id: "midnight", label: "Midnight", desc: "Pure OLED black theme" },
                          { id: "system", label: "System Sync", desc: "Match operating system mode" },
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setPreferredTheme(t.id)}
                            className={`p-3.5 rounded-xl text-left border transition-all ${
                              preferredTheme === t.id
                                ? "border-cyan-500/50 bg-cyan-500/10 shadow-sm"
                                : "border-white/5 bg-[#16171b] hover:border-white/20"
                            }`}
                          >
                            <span className={`text-xs font-bold block ${preferredTheme === t.id ? "text-cyan-400" : "text-white"}`}>
                              {t.label}
                            </span>
                            <span className="text-[10px] text-slate-500 mt-0.5 block">{t.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="button"
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                        className="h-10 px-6 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                      >
                        {savingProfile ? "Saving…" : "Save Appearance"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* LEARNING / YOUR LERNA PREFERENCES */}
                {activeTab === "preferences" && (
                  <div className="space-y-6 max-w-2xl animate-in fade-in duration-150">
                    <div>
                      <h3 className="text-base font-semibold text-white tracking-tight">Your Lerna</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Control how your AI tutor formats lessons, explanations, and quizzes.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300">Teaching Style</label>
                          <select
                            value={teachingStyle}
                            onChange={(e) => setTeachingStyle(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-white/10 bg-[#18191d] text-xs text-slate-200"
                          >
                            <option value="Beginner">Beginner (Simpler analogies)</option>
                            <option value="Intermediate">Intermediate (Standard)</option>
                            <option value="Advanced">Advanced (Academic rigor)</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300">Difficulty Threshold</label>
                          <select
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-white/10 bg-[#18191d] text-xs text-slate-200"
                          >
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300">Preferred Quiz Format</label>
                          <select
                            value={preferredQuizFormat}
                            onChange={(e) => setPreferredQuizFormat(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-white/10 bg-[#18191d] text-xs text-slate-200"
                          >
                            <option value="Mixed">Mixed Questions</option>
                            <option value="Multiple Choice">Multiple Choice Only</option>
                            <option value="Essay">Essay style</option>
                            <option value="Flashcards">Flashcard style</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300">Response Detail Length</label>
                          <select
                            value={responseLength}
                            onChange={(e) => setResponseLength(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-white/10 bg-[#18191d] text-xs text-slate-200"
                          >
                            <option value="Short">Concise & Bulleted</option>
                            <option value="Medium">Medium & Balanced</option>
                            <option value="Long">Thorough & Comprehensive</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300">Preferred Language</label>
                          <select
                            value={preferredLanguage}
                            onChange={(e) => setPreferredLanguage(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-white/10 bg-[#18191d] text-xs text-slate-200"
                          >
                            <option value="English">English</option>
                            <option value="French">French</option>
                            <option value="Spanish">Spanish</option>
                            <option value="German">German</option>
                            <option value="Chinese">Chinese</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300">Voice Synthesis Accent</label>
                          <select
                            value={voicePreference}
                            onChange={(e) => setVoicePreference(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-white/10 bg-[#18191d] text-xs text-slate-200"
                          >
                            <option value="Default">Default Warm Accent</option>
                            <option value="Female">Clear Female Accent</option>
                            <option value="Male">Deep Male Accent</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="button"
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                        className="h-10 px-6 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                      >
                        {savingProfile ? "Saving…" : "Save Learning Settings"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* CAPABILITIES TAB */}
                {activeTab === "capabilities" && (
                  <div className="space-y-6 max-w-2xl animate-in fade-in duration-150">
                    <div>
                      <h3 className="text-base font-semibold text-white tracking-tight">AI Capabilities</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Underlying intelligence models and context grounding engines.</p>
                    </div>

                    <div className="space-y-3">
                      {[
                        { title: "Gemini 3.8 Flash (High)", desc: "High-reasoning multimodal engine optimized for rapid conversational tutoring.", active: true },
                        { title: "RAG Document Grounding", desc: "Embeds lecture notes and textbooks to give verbatim course-specific citations.", active: true },
                        { title: "KaTeX Mathematical Rendering", desc: "Renders formulas, integrals, and scientific notation in real time.", active: true },
                        { title: "Optical Character Recognition (OCR)", desc: "Transcribes mathematical worksheets and handwritten questions automatically.", active: true },
                      ].map((cap, i) => (
                        <div key={i} className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-[#16171b]">
                          <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-white block">{cap.title}</span>
                            <span className="text-[11px] text-slate-500 block">{cap.desc}</span>
                          </div>
                          <span className="text-xs font-bold text-cyan-400 flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4" /> Enabled
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* NOTIFICATIONS TAB */}
                {activeTab === "notifications" && (
                  <div className="space-y-6 max-w-2xl animate-in fade-in duration-150">
                    <div>
                      <h3 className="text-base font-semibold text-white tracking-tight">Notifications</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Configure study reminders and security alert emails.</p>
                    </div>

                    <div className="space-y-3">
                      {[
                        {
                          label: "Daily Study Reminders",
                          desc: "Receive an email reminder when you haven't reached your daily study goal.",
                          state: studyReminderEnabled,
                          setter: setStudyReminderEnabled,
                        },
                        {
                          label: "Product & Learning Updates",
                          desc: "Periodic platform changelogs, new study tools, and feature spotlights.",
                          state: marketingUpdatesEnabled,
                          setter: setMarketingUpdatesEnabled,
                        },
                        {
                          label: "Security & Login Alerts",
                          desc: "Instant notifications whenever your password or active browser changes.",
                          state: securityAlertsEnabled,
                          setter: setSecurityAlertsEnabled,
                        },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-[#16171b]">
                          <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-white block">{item.label}</span>
                            <span className="text-[11px] text-slate-500 block">{item.desc}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => item.setter(!item.state)}
                            className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${
                              item.state ? "bg-cyan-500" : "bg-white/10"
                            }`}
                          >
                            <div
                              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-slate-950 transition-transform ${
                                item.state ? "translate-x-5" : ""
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2">
                      <Button
                        type="button"
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                        className="h-10 px-6 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                      >
                        {savingProfile ? "Saving…" : "Save Notification Preferences"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* SECURITY & PRIVACY TAB */}
                {activeTab === "security" && (
                  <div className="space-y-6 max-w-2xl animate-in fade-in duration-150">
                    <div>
                      <h3 className="text-base font-semibold text-white tracking-tight">Privacy & Security</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Manage authentication credentials, change email, and secure sessions.</p>
                    </div>

                    {/* Change Email */}
                    <form onSubmit={handleUpdateEmail} className="p-4 rounded-xl border border-white/5 bg-[#16171b] space-y-3">
                      <span className="text-xs font-semibold text-white block">Change Login Email</span>
                      {emailMessage && <div className="text-xs text-emerald-400">{emailMessage}</div>}
                      {emailError && <div className="text-xs text-red-400">{emailError}</div>}
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-400">Current email: {user?.email}</label>
                        <Input
                          type="email"
                          placeholder="New email address"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          className="bg-[#121316] border-white/10 text-xs h-9"
                          required
                        />
                      </div>
                      <Button type="submit" disabled={updatingEmail} className="h-8 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs">
                        {updatingEmail ? "Sending link…" : "Update Email"}
                      </Button>
                    </form>

                    {/* Change Password */}
                    <form onSubmit={handleChangePassword} className="p-4 rounded-xl border border-white/5 bg-[#16171b] space-y-3">
                      <span className="text-xs font-semibold text-white block">Update Password</span>
                      {passwordSuccess && <div className="text-xs text-emerald-400">{passwordSuccess}</div>}
                      {passwordError && <div className="text-xs text-red-400">{passwordError}</div>}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-400">New password</label>
                          <div className="relative">
                            <Input
                              type={showNewPassword ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="bg-[#121316] border-white/10 text-xs h-9 pr-8"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                              {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-400">Confirm password</label>
                          <div className="relative">
                            <Input
                              type={showConfirmPassword ? "text" : "password"}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="bg-[#121316] border-white/10 text-xs h-9 pr-8"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                              {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                      <Button type="submit" disabled={updatingPassword} className="h-8 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs">
                        {updatingPassword ? "Updating…" : "Change Password"}
                      </Button>
                    </form>
                  </div>
                )}

                {/* WELLBEING & GOALS TAB */}
                {activeTab === "wellbeing" && (
                  <div className="space-y-6 max-w-2xl animate-in fade-in duration-150">
                    <div>
                      <h3 className="text-base font-semibold text-white tracking-tight">Wellbeing & Study Goals</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Set realistic study goals and build a healthy, consistent learning routine.</p>
                    </div>

                    <div className="p-4 rounded-xl border border-white/5 bg-[#16171b] space-y-3">
                      <span className="text-xs font-semibold text-white block">Daily Study Target</span>
                      <p className="text-[11px] text-slate-400">Target minutes of active study per day to maintain your streak.</p>
                      <div className="grid grid-cols-4 gap-2">
                        {[15, 30, 45, 60].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => setDailyGoalMinutes(mins)}
                            className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                              dailyGoalMinutes === mins
                                ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                                : "bg-[#121316] border-white/5 text-slate-300 hover:text-white"
                            }`}
                          >
                            {mins} mins
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="button"
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                        className="h-10 px-6 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                      >
                        {savingProfile ? "Saving…" : "Save Study Goals"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* PERFORMANCE STATS TAB */}
                {activeTab === "stats" && (
                  <div className="space-y-6 max-w-2xl animate-in fade-in duration-150">
                    <div>
                      <h3 className="text-base font-semibold text-white tracking-tight">Performance Stats</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Aggregated learning telemetry and active workspace milestones.</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { label: "Learning Streak", value: `${stats.streak} days`, desc: "Active study streak" },
                        { label: "Questions Asked", value: stats.questions, desc: "Total chat queries" },
                        { label: "Materials Uploaded", value: stats.documents, desc: "Indexed in library" },
                        { label: "Study Workspaces", value: stats.sessions, desc: "Created conversations" },
                        { label: "Hours Studied", value: `${stats.hours.toFixed(1)} hrs`, desc: "Total study duration" },
                        { label: "Last Active", value: stats.lastActive ? new Date(stats.lastActive).toLocaleDateString() : "Today", desc: "Recent activity" },
                      ].map((s, i) => (
                        <div key={i} className="p-4 rounded-xl border border-white/5 bg-[#16171b] space-y-1">
                          <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">{s.label}</span>
                          <span className="text-xl font-bold text-white block">{s.value}</span>
                          <span className="text-[10px] text-slate-500 block">{s.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SUPPORT & FAQ TAB */}
                {activeTab === "support" && (
                  <div className="space-y-6 max-w-2xl animate-in fade-in duration-150">
                    <div>
                      <h3 className="text-base font-semibold text-white tracking-tight">Support & Feedback</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Have questions or want to request a feature? Get in touch directly.</p>
                    </div>

                    {/* Support Ticket */}
                    <form onSubmit={handleSubmitTicket} className="p-4 rounded-xl border border-white/5 bg-[#16171b] space-y-3">
                      <span className="text-xs font-semibold text-white block">Submit Support Ticket</span>
                      {ticketSuccess && <div className="text-xs text-emerald-400">{ticketSuccess}</div>}
                      <Input
                        placeholder="Subject (e.g. Issue uploading PDF material)"
                        value={ticketSubject}
                        onChange={(e) => setTicketSubject(e.target.value)}
                        className="bg-[#121316] border-white/10 text-xs h-9"
                        required
                      />
                      <textarea
                        rows={3}
                        placeholder="Describe the issue in detail..."
                        value={ticketMessage}
                        onChange={(e) => setTicketMessage(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-white/10 bg-[#121316] text-xs text-white placeholder:text-slate-500 focus:outline-none"
                        required
                      />
                      <Button type="submit" disabled={submittingTicket} className="h-8 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs">
                        {submittingTicket ? "Submitting…" : "Send Ticket"}
                      </Button>
                    </form>

                    {/* Platform Feedback */}
                    <form onSubmit={handleSubmitFeedback} className="p-4 rounded-xl border border-white/5 bg-[#16171b] space-y-3">
                      <span className="text-xs font-semibold text-white block">Send Feedback</span>
                      {feedbackSuccess && <div className="text-xs text-emerald-400">{feedbackSuccess}</div>}
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={feedbackType}
                          onChange={(e) => setFeedbackType(e.target.value as any)}
                          className="h-9 px-2.5 rounded-lg border border-white/10 bg-[#121316] text-xs text-slate-300"
                        >
                          <option value="general">General</option>
                          <option value="bug">Report a Bug</option>
                          <option value="feature">Request a Feature</option>
                        </select>
                        <select
                          value={feedbackRating}
                          onChange={(e) => setFeedbackRating(Number(e.target.value))}
                          className="h-9 px-2.5 rounded-lg border border-white/10 bg-[#121316] text-xs text-slate-300"
                        >
                          <option value={5}>⭐⭐⭐⭐⭐ (5/5)</option>
                          <option value={4}>⭐⭐⭐⭐ (4/5)</option>
                          <option value={3}>⭐⭐⭐ (3/5)</option>
                          <option value={2}>⭐⭐ (2/5)</option>
                          <option value={1}>⭐ (1/5)</option>
                        </select>
                      </div>
                      <textarea
                        rows={2}
                        placeholder="Share your thoughts or recommendations..."
                        value={feedbackMsg}
                        onChange={(e) => setFeedbackMsg(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-white/10 bg-[#121316] text-xs text-white placeholder:text-slate-500 focus:outline-none"
                        required
                      />
                      <Button type="submit" disabled={submittingFeedback} className="h-8 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs">
                        {submittingFeedback ? "Submitting…" : "Submit Feedback"}
                      </Button>
                    </form>
                  </div>
                )}

                {/* RELEASE / ABOUT TAB */}
                {activeTab === "about" && (
                  <div className="space-y-6 max-w-2xl animate-in fade-in duration-150">
                    <div>
                      <h3 className="text-base font-semibold text-white tracking-tight">Release & About</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Software build versions and system configuration details.</p>
                    </div>

                    <div className="p-4 rounded-xl border border-white/5 bg-[#16171b] divide-y divide-white/5 text-xs">
                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-400">Application Version</span>
                        <span className="font-semibold text-white">v1.2.0-stable</span>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-400">Framework Core</span>
                        <span className="font-semibold text-white">Next.js 16 (Turbopack)</span>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-400">Database Layer</span>
                        <span className="font-semibold text-white">Supabase PostgreSQL 15</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-white/5 bg-[#16171b] space-y-2 text-xs">
                      <span className="font-semibold text-white block">Recent Updates</span>
                      <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                        <li>Unified Claude-style modal settings center for instant access anywhere in the app.</li>
                        <li>Dynamic telemetry integration and realtime quota tracking meters.</li>
                        <li>Academic institution verification and localized course indexing.</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );

  // Render the PaymentModal outside the portal so it stacks correctly
  // We return a fragment with both the settings portal and the payment modal
  return (
    <>
      {portal}
      <PaymentModal
        isOpen={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        defaultPlan={paymentPlan}
      />
    </>
  );
}
