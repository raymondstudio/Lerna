"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { 
  Eye, 
  EyeOff, 
  Check, 
  AlertCircle, 
  Mail, 
  RefreshCw, 
  ArrowLeft, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const PASSWORD_REQUIREMENTS = [
  { id: "length", label: "At least 8 characters", test: (pw: string) => pw.length >= 8 },
  { id: "upper", label: "One uppercase letter (A-Z)", test: (pw: string) => /[A-Z]/.test(pw) },
  { id: "lower", label: "One lowercase letter (a-z)", test: (pw: string) => /[a-z]/.test(pw) },
  { id: "number", label: "One number (0-9)", test: (pw: string) => /[0-9]/.test(pw) },
  { id: "special", label: "One special character", test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
];

export function SignupForm({
  redirectTo = "/chat",
  initialErrorMessage,
  onSwitchToLogin
}: {
  redirectTo?: string;
  initialErrorMessage?: string;
  onSwitchToLogin?: () => void;
}) {
  const router = useRouter();
  const { signUp, ready, error: authError, signInWithProvider } = useAuth();
  
  // Form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Compliance & Referral states
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [showPromoFields, setShowPromoFields] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  
  // Status states
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [duplicateEmail, setDuplicateEmail] = useState(false);
  const [error, setError] = useState<string | null>(initialErrorMessage ?? null);
  const [viewState, setViewState] = useState<"form" | "verification-sent" | "success">("form");
  
  // Verification states
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [resendMessage, setResendMessage] = useState("");

  // Track password strength
  const requirementsMetCount = PASSWORD_REQUIREMENTS.filter(req => req.test(password)).length;
  const isPasswordValid = requirementsMetCount === PASSWORD_REQUIREMENTS.length;
  
  // Resend Countdown Timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const interval = setInterval(() => {
      setResendCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCountdown]);

  // Handle email unique validation on blur
  async function handleEmailBlur() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setDuplicateEmail(false);
      return;
    }
    try {
      setCheckingEmail(true);
      const checkRes = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const checkData = await checkRes.json();
      if (checkData.exists) {
        setDuplicateEmail(true);
        setError("This email address is already registered. Try logging in instead.");
      } else {
        setDuplicateEmail(false);
        if (error === "This email address is already registered. Try logging in instead.") {
          setError(null);
        }
      }
    } catch (err) {
      console.warn("Failed to check email uniqueness:", err);
    } finally {
      setCheckingEmail(false);
    }
  }

  // Handle Form Submission
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      setError("First Name and Last Name are required.");
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!isPasswordValid) {
      setError("Please meet all password requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!acceptTerms || !acceptPrivacy) {
      setError("You must accept both the Terms of Service and Privacy Policy.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Final uniqueness verification
      const checkRes = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const checkData = await checkRes.json();
      if (checkData.exists) {
        setDuplicateEmail(true);
        setError("This email address is already registered. Try logging in instead.");
        setLoading(false);
        return;
      }

      // Execute Signup
      const result = await signUp({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        referralCode: referralCode.trim() || undefined,
        institutionInviteCode: inviteCode.trim() || undefined,
        acceptedTos: acceptTerms,
        acceptedPrivacy: acceptPrivacy,
      });

      if (result.needsEmailConfirmation) {
        setViewState("verification-sent");
      } else {
        setViewState("success");
        setTimeout(() => {
          router.push(redirectTo);
          router.refresh();
        }, 2000);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to sign up right now.");
    } finally {
      setLoading(false);
    }
  }

  // Handle resend verification link
  async function handleResendVerification() {
    if (resendCountdown > 0) return;
    try {
      setResendStatus("sending");
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }
      
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin + "/auth/callback",
        },
      });

      if (resendError) {
        throw resendError;
      }

      setResendStatus("success");
      setResendMessage("Verification email resent successfully!");
      setResendCountdown(60);
    } catch (err) {
      setResendStatus("error");
      setResendMessage(err instanceof Error ? err.message : "Failed to resend. Please try again later.");
    }
  }

  // Return to Form from Verification Screen
  function handleChangeEmail() {
    setViewState("form");
    setError(null);
  }

  // 1. SUCCESS VIEW STATE
  if (viewState === "success") {
    return (
      <div className="space-y-6 py-8 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
          <Check className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">Account Created!</h2>
          <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
            Welcome to EduAgent AI. Redirecting you to your personalization companion...
          </p>
        </div>
      </div>
    );
  }

  // 2. VERIFICATION SENT VIEW STATE
  if (viewState === "verification-sent") {
    return (
      <div className="space-y-6 py-4 animate-in fade-in slide-in-from-bottom duration-300">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 relative shadow-[0_0_15px_rgba(6,182,212,0.1)]">
            <Mail className="h-6 w-6 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Verify your email</h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
              We've sent a verification link to <span className="text-slate-200 font-semibold">{email}</span>. Click the link to complete account setup.
            </p>
          </div>
        </div>

        <div className="pt-2 space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 justify-center bg-[#1c1f26] border-white/5 text-slate-200 hover:bg-[#252a33] hover:text-white hover:border-white/10 transition-colors gap-2"
            disabled={resendCountdown > 0 || resendStatus === "sending"}
            onClick={handleResendVerification}
          >
            {resendStatus === "sending" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Resending...
              </>
            ) : resendCountdown > 0 ? (
              `Resend in ${resendCountdown}s`
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Resend Verification Email
              </>
            )}
          </Button>

          {resendMessage && (
            <p className={`text-center text-xs font-medium ${resendStatus === "success" ? "text-emerald-400 animate-in fade-in" : "text-red-400 animate-in shake"}`}>
              {resendMessage}
            </p>
          )}

          <div className="flex items-center justify-center gap-4 text-xs font-medium pt-3">
            <button
              onClick={handleChangeEmail}
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 py-2"
            >
              <ArrowLeft className="h-3 w-3" />
              Change email address
            </button>
            <span className="text-slate-700">|</span>
            <button
              onClick={onSwitchToLogin}
              className="text-slate-400 hover:text-white transition-colors py-2"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. REGISTRATION FORM VIEW STATE
  const isFormValid = 
    firstName.trim().length > 0 && 
    lastName.trim().length > 0 && 
    email.trim().length > 0 && 
    isPasswordValid && 
    password === confirmPassword && 
    acceptTerms && 
    acceptPrivacy &&
    !duplicateEmail;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white tracking-tight">Create your account</h2>
        <p className="text-slate-400 text-xs mt-1">Accelerate your study workflow in seconds.</p>
      </div>

      {/* Google Signup Button */}
      <div className="space-y-3">
        <Button
          variant="outline"
          className="w-full justify-center bg-[#1c1f26] border-white/5 text-slate-200 hover:bg-[#252a33] hover:text-white hover:border-white/10 transition-colors h-11 text-sm font-semibold"
          disabled={loading || !ready}
          onClick={async () => {
            try {
              setLoading(true);
              await signInWithProvider?.("google", redirectTo);
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
              setLoading(false);
            }
          }}
        >
          <svg className="mr-2.5 h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
          Continue with Google
        </Button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-semibold">
          <span className="bg-[#0f1115] px-2 text-slate-500">Or use email</span>
        </div>
      </div>

      {/* Main Registration Form */}
      <form className="space-y-4" onSubmit={handleSubmit}>
        
        {/* Name Fields Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Input
              id="firstName"
              type="text"
              placeholder="First Name"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="bg-[#1c1f26] border-white/5 h-10 focus-visible:ring-cyan-500/50 text-sm rounded-lg"
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-1">
            <Input
              id="lastName"
              type="text"
              placeholder="Last Name"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="bg-[#1c1f26] border-white/5 h-10 focus-visible:ring-cyan-500/50 text-sm rounded-lg"
              autoComplete="family-name"
            />
          </div>
        </div>

        {/* Email Field */}
        <div className="space-y-1 relative">
          <div className="relative">
            <Input
              id="email"
              type="email"
              placeholder="Email address"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setDuplicateEmail(false);
              }}
              onBlur={handleEmailBlur}
              className={`bg-[#1c1f26] border-white/5 h-10 focus-visible:ring-cyan-500/50 text-sm rounded-lg pr-9 ${duplicateEmail ? "border-red-500/30 focus-visible:ring-red-500/30" : ""}`}
              autoComplete="email"
            />
            {checkingEmail && (
              <div className="absolute right-3 top-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              </div>
            )}
          </div>
        </div>

        {/* Password Input */}
        <div className="space-y-1">
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#1c1f26] border-white/5 h-10 pr-9 focus-visible:ring-cyan-500/50 text-sm rounded-lg"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          
          {/* Password Strength Meter & Checklist */}
          {password && (
            <div className="pt-1.5 space-y-2 animate-in fade-in duration-200">
              {/* Strength Bar */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold">
                  <span>Password Strength</span>
                  <span className={
                    requirementsMetCount <= 1 ? "text-red-400" :
                    requirementsMetCount <= 3 ? "text-amber-400" : "text-cyan-400"
                  }>
                    {requirementsMetCount <= 1 ? "Weak" :
                     requirementsMetCount <= 3 ? "Medium" : "Strong"}
                  </span>
                </div>
                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`h-full flex-1 transition-colors duration-300 ${
                        level <= requirementsMetCount
                          ? requirementsMetCount <= 1 ? "bg-red-500" :
                            requirementsMetCount <= 3 ? "bg-amber-500" : "bg-cyan-500"
                          : "bg-slate-800"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Requirements Checklist */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] text-slate-400 font-medium">
                {PASSWORD_REQUIREMENTS.map((req) => {
                  const met = req.test(password);
                  return (
                    <div key={req.id} className="flex items-center gap-1.5 transition-colors duration-200">
                      <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full shrink-0 border transition-all duration-200 ${
                        met ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" : "border-slate-800 text-slate-600"
                      }`}>
                        <Check className="h-2 w-2" />
                      </span>
                      <span className={met ? "text-slate-300" : "text-slate-500"}>{req.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password Input */}
        <div className="space-y-1">
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm Password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-[#1c1f26] border-white/5 h-10 pr-9 focus-visible:ring-cyan-500/50 text-sm rounded-lg"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {confirmPassword && password !== confirmPassword && (
            <p className="text-[10px] text-red-400 font-medium pt-1 animate-in fade-in">Passwords do not match.</p>
          )}
        </div>

        {/* Optional Code Expandable Section */}
        <div className="border border-white/5 bg-[#14171d]/30 rounded-xl overflow-hidden transition-all duration-200">
          <button
            type="button"
            onClick={() => setShowPromoFields(!showPromoFields)}
            className="flex items-center justify-between w-full px-4 py-2.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <span className="font-semibold flex items-center gap-1.5">
              Have a referral or invite code?
            </span>
            {showPromoFields ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          
          <AnimatePresence initial={false}>
            {showPromoFields && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 pt-1 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-white/5">
                  <div className="space-y-1">
                    <label htmlFor="referralCode" className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Referral Code</label>
                    <Input
                      id="referralCode"
                      type="text"
                      placeholder="e.g. REF-123"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value)}
                      className="bg-[#1c1f26] border-white/5 h-9 text-xs focus-visible:ring-cyan-500/50 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="inviteCode" className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Institution Invite Code</label>
                    <Input
                      id="inviteCode"
                      type="text"
                      placeholder="e.g. SCH-987"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      className="bg-[#1c1f26] border-white/5 h-9 text-xs focus-visible:ring-cyan-500/50 rounded-lg"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Consent Checkboxes */}
        <div className="space-y-2 pt-1">
          <label className="flex items-start gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-cyan-500/50 transition-colors"
            />
            <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors font-medium">
              I agree to the{" "}
              <a href="#" className="text-white hover:text-cyan-400 transition-colors font-semibold" onClick={(e) => e.preventDefault()}>
                Terms of Service
              </a>
            </span>
          </label>
          <label className="flex items-start gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={acceptPrivacy}
              onChange={(e) => setAcceptPrivacy(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-cyan-500/50 transition-colors"
            />
            <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors font-medium">
              I agree to the{" "}
              <a href="#" className="text-white hover:text-cyan-400 transition-colors font-semibold" onClick={(e) => e.preventDefault()}>
                Privacy Policy
              </a>
            </span>
          </label>
        </div>

        {/* Global Error Display */}
        {((error || authError) && !checkingEmail) ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200 flex items-start gap-2.5 animate-in shake">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <p className="leading-normal font-medium">{error ?? authError}</p>
          </div>
        ) : null}

        {/* Submit Button */}
        {!ready ? (
          <p className="text-xs text-slate-400 text-center animate-pulse">Initializing auth client...</p>
        ) : (
          <Button
            className="w-full h-11 bg-white text-slate-950 hover:bg-slate-200 font-bold text-sm transition-all duration-200 rounded-xl gap-2 mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
            type="submit"
            disabled={loading || !isFormValid}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        )}

        <p className="text-center text-xs text-slate-500 pt-3">
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-white font-semibold hover:text-cyan-400 transition-colors"
          >
            Log in
          </button>
        </p>
      </form>
    </div>
  );
}
