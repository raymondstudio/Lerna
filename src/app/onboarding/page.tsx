"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Compass,
  GraduationCap,
  Loader2,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  ONBOARDING_ACCOUNT_TYPES,
  onboardingDraftSchema,
  type OnboardingAccountType,
} from "@/lib/onboarding";

type InstitutionResult = {
  id: string;
  name: string;
  short_name: string | null;
  country: string;
  state: string | null;
  city: string | null;
  institution_type: string;
  is_verified: boolean;
};

type FormState = {
  accountType: OnboardingAccountType | "";
  institution: string;
  institutionId: string;
  institutionType: string;
  faculty: string;
  department: string;
  studyLevel: string;
  company: string;
  occupation: string;
  industry: string;
  field: string;
  studyGoals: string[];
  interests: string[];
};

const INITIAL_FORM: FormState = {
  accountType: "",
  institution: "",
  institutionId: "",
  institutionType: "University",
  faculty: "",
  department: "",
  studyLevel: "",
  company: "",
  occupation: "",
  industry: "",
  field: "",
  studyGoals: [],
  interests: [],
};

const GOALS = [
  "Prepare for Exams",
  "Complete Assignments",
  "Understand Difficult Topics",
  "Research",
  "Daily Learning",
  "Professional Skills",
];

const FACULTIES = [
  "Science",
  "Engineering",
  "Computing",
  "Arts",
  "Business",
  "Law",
  "Medicine",
  "Education",
  "Social Sciences",
];

const DEPARTMENTS = [
  "Computer Science",
  "Software Engineering",
  "Medicine & Healthcare",
  "Engineering & Technology",
  "Law & Legal Studies",
  "Accounting & Finance",
  "Architecture & Design",
  "Business Administration & Economics",
  "Biological & Chemical Sciences",
  "Humanities & Arts",
];

const ROLE_COPY: Record<OnboardingAccountType, { label: string; description: string }> = {
  Student: {
    label: "Student",
    description: "School, university, postgraduate, or independent coursework",
  },
  Teacher: {
    label: "Teacher / Educator",
    description: "Teacher, lecturer, tutor, trainer, or course facilitator",
  },
  Professional: {
    label: "Professional",
    description: "Career development, certifications, or workplace learning",
  },
  Researcher: {
    label: "Researcher",
    description: "Academic, industry, or independent research",
  },
  Other: {
    label: "Other / Independent learner",
    description: "Exploring a subject outside the roles above",
  },
};

function splitList(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function optionalLabel(label: string) {
  return (
    <>
      {label} <span className="normal-case tracking-normal text-slate-600">(optional)</span>
    </>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InstitutionResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const storageKey = user ? `lerna:onboarding-draft:${user.id}` : null;
  const accountType = form.accountType;
  const isInstitutionRole =
    accountType === "Student" || accountType === "Teacher" || accountType === "Researcher";

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, router, user]);

  useEffect(() => {
    if (!user || !storageKey) return;

    let cancelled = false;
    void (async () => {
      let serverDraft: Partial<FormState> = {};
      try {
        const response = await fetch("/api/account/onboarding", { cache: "no-store" });
        const payload: unknown = await response.json();
        if (
          response.ok &&
          payload &&
          typeof payload === "object" &&
          "data" in payload &&
          payload.data &&
          typeof payload.data === "object"
        ) {
          serverDraft = payload.data as Partial<FormState>;
        }
      } catch (error) {
        console.warn("[onboarding] Unable to load saved profile", error);
      }

      let localDraft: Record<string, unknown> = {};
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored) {
          const parsed = onboardingDraftSchema.safeParse(JSON.parse(stored));
          if (parsed.success) {
            localDraft = Object.fromEntries(
              Object.entries(parsed.data).filter(([, value]) => value !== undefined),
            );
          }
        }
      } catch (error) {
        console.warn("[onboarding] Ignoring invalid local draft", error);
      }

      if (cancelled) return;
      const merged = { ...INITIAL_FORM, ...serverDraft, ...localDraft } as FormState;
      setForm(merged);
      if (typeof localDraft.step === "number") setStep(localDraft.step);
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [storageKey, user]);

  useEffect(() => {
    if (!hydrated || !storageKey) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ ...form, step }));
  }, [form, hydrated, step, storageKey]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!isInstitutionRole || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const params = new URLSearchParams({
          query: searchQuery.trim(),
          limit: "20",
        });
        const response = await fetch(`/api/institutions/search?${params}`, {
          signal: controller.signal,
        });
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error("Search request failed");
        if (
          payload &&
          typeof payload === "object" &&
          "data" in payload &&
          Array.isArray(payload.data)
        ) {
          setSearchResults(payload.data as InstitutionResult[]);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[onboarding] Institution search failed", error);
          setSearchError("Institution search is unavailable. You can still use the name you typed.");
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [isInstitutionRole, searchQuery]);

  const canContinue = step !== 2 || Boolean(accountType);

  const summary = useMemo(() => {
    const details = [
      form.institution,
      form.company,
      form.faculty,
      form.department,
      form.field,
      form.occupation,
      form.industry,
      form.studyLevel,
    ].filter(Boolean);
    return details;
  }, [form]);

  function toggleGoal(goal: string) {
    setForm((current) => ({
      ...current,
      studyGoals: current.studyGoals.includes(goal)
        ? current.studyGoals.filter((item) => item !== goal)
        : [...current.studyGoals, goal],
    }));
  }

  function selectInstitution(institution: InstitutionResult) {
    setForm((current) => ({
      ...current,
      institution: institution.name,
      institutionId: institution.id,
      institutionType: institution.institution_type,
    }));
    setSearchQuery("");
    setSearchResults([]);
  }

  function useTypedInstitution() {
    const value = searchQuery.trim();
    if (!value) return;
    setForm((current) => ({
      ...current,
      institution: value,
      institutionId: "",
      institutionType: "Other",
    }));
    setSearchQuery("");
    setSearchResults([]);
  }

  async function handleFinish() {
    if (!user || !accountType || saving) return;
    setSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/account/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload: { success?: boolean; error?: string } = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "We could not save your profile. Please try again.");
      }

      if (storageKey) window.localStorage.removeItem(storageKey);
      window.sessionStorage.removeItem("onboarding_skipped");
      await refreshProfile();
      router.replace("/chat");
      router.refresh();
    } catch (error) {
      console.error("[onboarding] Save failed", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not save your profile. Your progress is still available, so please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user || !hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" aria-label="Loading onboarding" />
      </div>
    );
  }

  const slideVariants = {
    hidden: { opacity: 0, x: 24 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.22 } },
    exit: { opacity: 0, x: -24, transition: { duration: 0.16 } },
  };

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0a0a0a] px-4 py-8 text-slate-200 selection:bg-cyan-500/30 md:px-6 md:py-10">
      <div className="pointer-events-none absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-violet-500/5 blur-[120px]" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-xl flex-col">
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Lerna AI personalization</span>
            <span>Step {step} of 6</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 to-violet-500"
              animate={{ width: `${(step / 6) * 100}%` }}
              transition={{ duration: 0.25 }}
            />
          </div>
          {errorMessage ? (
            <div
              role="alert"
              className="rounded-xl border border-red-500/25 bg-red-950/40 p-3.5 text-sm text-red-200"
            >
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 items-center py-4">
          <AnimatePresence mode="wait">
            <motion.section
              key={step}
              variants={slideVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full"
              aria-labelledby="onboarding-heading"
            >
              {step === 1 ? (
                <div className="space-y-6 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400">
                    <Compass className="h-8 w-8" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <h1
                      id="onboarding-heading"
                      ref={headingRef}
                      tabIndex={-1}
                      className="text-3xl font-bold tracking-tight text-white outline-none"
                    >
                      Welcome to Lerna AI
                    </h1>
                    <p className="mx-auto max-w-sm text-sm leading-relaxed text-slate-400">
                      Tell us only what you are comfortable sharing. Everything except your role is optional and editable later.
                    </p>
                  </div>
                  <Button
                    onClick={() => setStep(2)}
                    className="h-12 w-full max-w-xs rounded-full bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400"
                  >
                    Get started <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-6">
                  <div className="space-y-2 text-center">
                    <h1
                      id="onboarding-heading"
                      ref={headingRef}
                      tabIndex={-1}
                      className="text-2xl font-bold text-white outline-none"
                    >
                      What best describes you?
                    </h1>
                    <p className="text-xs text-slate-400">This is the only required personalization choice.</p>
                  </div>
                  <div className="grid gap-3">
                    {ONBOARDING_ACCOUNT_TYPES.map((role) => {
                      const active = accountType === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setField("accountType", role)}
                          className={`flex min-h-16 items-center justify-between rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                            active
                              ? "border-cyan-500 bg-cyan-500/5 text-white"
                              : "border-white/5 bg-[#141414]/60 text-slate-300 hover:border-white/15"
                          }`}
                        >
                          <span>
                            <span className="block text-sm font-semibold">{ROLE_COPY[role].label}</span>
                            <span className="mt-0.5 block text-xs text-slate-500">{ROLE_COPY[role].description}</span>
                          </span>
                          {active ? (
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-slate-950">
                              <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-6">
                  <div className="space-y-2 text-center">
                    <h1
                      id="onboarding-heading"
                      ref={headingRef}
                      tabIndex={-1}
                      className="text-2xl font-bold text-white outline-none"
                    >
                      {isInstitutionRole ? "Your institution" : accountType === "Professional" ? "Your work context" : "Your learning context"}
                    </h1>
                    <p className="text-xs text-slate-400">Skip anything you prefer not to share.</p>
                  </div>

                  {isInstitutionRole ? (
                    <div className="space-y-4">
                      <label className="block space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {optionalLabel("Institution")}
                        </span>
                        <span className="relative block">
                          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                          <input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search or type any institution"
                            className="h-11 w-full rounded-xl border border-white/5 bg-[#1c1f26] pl-10 pr-4 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                          />
                        </span>
                      </label>

                      {isSearching ? (
                        <div className="flex justify-center py-5"><Loader2 className="h-5 w-5 animate-spin text-cyan-400" /></div>
                      ) : null}

                      {searchQuery.trim().length >= 2 && !isSearching ? (
                        <div className="max-h-[min(18rem,40dvh)] overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-[#141414]">
                          {searchResults.map((institution) => (
                            <button
                              key={institution.id}
                              type="button"
                              onClick={() => selectInstitution(institution)}
                              className="flex w-full items-start gap-3 border-b border-white/5 px-4 py-3 text-left last:border-b-0 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400"
                            >
                              <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-white">
                                  {institution.name}{institution.short_name ? ` (${institution.short_name})` : ""}
                                </span>
                                <span className="block text-xs text-slate-500">
                                  {[institution.city, institution.state, institution.country].filter(Boolean).join(", ")}
                                </span>
                              </span>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={useTypedInstitution}
                            className="w-full px-4 py-3 text-left text-sm font-semibold text-cyan-400 hover:bg-cyan-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400"
                          >
                            Use “{searchQuery.trim()}” as entered
                          </button>
                        </div>
                      ) : null}

                      {searchError ? <p className="text-xs text-amber-300" role="status">{searchError}</p> : null}

                      {form.institution ? (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3.5">
                          <div className="min-w-0">
                            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">Selected institution</span>
                            <span className="block truncate text-sm font-bold text-white">{form.institution}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setForm((current) => ({ ...current, institution: "", institutionId: "" }))}
                            className="h-9 shrink-0 border border-white/5 text-xs"
                          >
                            Clear
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : accountType === "Professional" ? (
                    <div className="grid gap-4">
                      <TextField label="Company or organization" value={form.company} onChange={(value) => setField("company", value)} />
                      <TextField label="Industry" value={form.industry} onChange={(value) => setField("industry", value)} />
                      <TextField label="Role or occupation" value={form.occupation} onChange={(value) => setField("occupation", value)} />
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      <TextField label="Occupation or current role" value={form.occupation} onChange={(value) => setField("occupation", value)} />
                      <TextField label="Area of interest" value={form.field} onChange={(value) => setField("field", value)} />
                    </div>
                  )}
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-6">
                  <div className="space-y-2 text-center">
                    <h1
                      id="onboarding-heading"
                      ref={headingRef}
                      tabIndex={-1}
                      className="text-2xl font-bold text-white outline-none"
                    >
                      {accountType === "Student"
                        ? "Your course of study"
                        : accountType === "Teacher"
                          ? "Your teaching context"
                          : accountType === "Researcher"
                            ? "Your research context"
                            : "Your current focus"}
                    </h1>
                    <p className="text-xs text-slate-400">These details are optional and help tune examples and difficulty.</p>
                  </div>

                  {accountType === "Student" ? (
                    <div className="space-y-5">
                      <ChoiceField
                        label="Faculty or school"
                        options={FACULTIES}
                        value={form.faculty}
                        onChange={(value) => setField("faculty", value)}
                        placeholder="e.g. School of Computing"
                      />
                      <ChoiceField
                        label="Department or program"
                        options={DEPARTMENTS}
                        value={form.department}
                        onChange={(value) => setField("department", value)}
                        placeholder="e.g. Software Engineering"
                      />
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      <TextField
                        label={accountType === "Teacher" ? "Subject or discipline" : accountType === "Researcher" ? "Research field" : "Learning focus"}
                        value={form.field}
                        onChange={(value) => setField("field", value)}
                      />
                      {accountType === "Teacher" ? (
                        <TextField label="Role" value={form.occupation} onChange={(value) => setField("occupation", value)} />
                      ) : null}
                      <TextField
                        label={accountType === "Teacher" ? "Teaching level" : accountType === "Researcher" ? "Research stage" : "Current skill level"}
                        value={form.studyLevel}
                        onChange={(value) => setField("studyLevel", value)}
                      />
                      {accountType === "Researcher" ? (
                        <TextField
                          label="Research interests (comma separated)"
                          value={form.interests.join(", ")}
                          onChange={(value) => setField("interests", splitList(value))}
                        />
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}

              {step === 5 ? (
                <div className="space-y-6">
                  <div className="space-y-2 text-center">
                    <h1
                      id="onboarding-heading"
                      ref={headingRef}
                      tabIndex={-1}
                      className="text-2xl font-bold text-white outline-none"
                    >
                      Learning goals
                    </h1>
                    <p className="text-xs text-slate-400">Choose any that help. You can also leave this blank.</p>
                  </div>

                  {accountType === "Student" ? (
                    <TextField label="Study level" value={form.studyLevel} onChange={(value) => setField("studyLevel", value)} />
                  ) : null}

                  <div className="grid gap-2 sm:grid-cols-2">
                    {GOALS.map((goal) => {
                      const active = form.studyGoals.includes(goal);
                      return (
                        <button
                          key={goal}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleGoal(goal)}
                          className={`flex min-h-12 items-center justify-between rounded-xl border p-3 text-left text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                            active
                              ? "border-cyan-500 bg-cyan-500/5 text-white"
                              : "border-white/5 bg-[#141414]/60 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {goal}
                          {active ? <Check className="h-4 w-4 text-cyan-400" aria-hidden="true" /> : null}
                        </button>
                      );
                    })}
                  </div>
                  <TextField
                    label="Other goals (comma separated)"
                    value={form.studyGoals.filter((goal) => !GOALS.includes(goal)).join(", ")}
                    onChange={(value) => {
                      const selectedDefaults = form.studyGoals.filter((goal) => GOALS.includes(goal));
                      setField("studyGoals", [...selectedDefaults, ...splitList(value)]);
                    }}
                  />
                </div>
              ) : null}

              {step === 6 ? (
                <div className="space-y-6 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                    <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <h1
                      id="onboarding-heading"
                      ref={headingRef}
                      tabIndex={-1}
                      className="text-3xl font-bold tracking-tight text-white outline-none"
                    >
                      Ready to save
                    </h1>
                    <p className="mx-auto max-w-sm text-sm leading-relaxed text-slate-400">
                      Your role is <span className="font-semibold text-slate-200">{accountType ? ROLE_COPY[accountType].label : ""}</span>.
                      {summary.length > 0 ? ` We’ll also use ${summary.length} optional profile detail${summary.length === 1 ? "" : "s"}.` : " No optional details will be stored."}
                    </p>
                  </div>
                  <Button
                    onClick={() => void handleFinish()}
                    disabled={saving}
                    className="h-12 w-full max-w-xs rounded-full bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400"
                  >
                    {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving profile…</> : "Save and continue"}
                  </Button>
                </div>
              ) : null}
            </motion.section>
          </AnimatePresence>
        </div>

        {step > 1 && step < 6 ? (
          <div className="mt-8 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => setStep((current) => Math.max(1, current - 1))}
              className="h-11 rounded-full border border-white/5 px-4 text-xs text-slate-400 hover:text-white"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
            </Button>
            <div className="flex items-center gap-2">
              {step > 2 ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    window.sessionStorage.setItem("onboarding_skipped", "true");
                    router.push("/chat");
                  }}
                  className="h-11 rounded-full px-4 text-xs text-slate-500 hover:text-white"
                >
                  Complete later
                </Button>
              ) : null}
              <Button
                onClick={() => setStep((current) => Math.min(6, current + 1))}
                disabled={!canContinue}
                className="h-11 rounded-full bg-cyan-500 px-6 text-xs font-bold text-slate-950 hover:bg-cyan-400"
              >
                Next <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{optionalLabel(label)}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-white/5 bg-[#1c1f26] px-4 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
      />
    </label>
  );
}

function ChoiceField({
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{optionalLabel(label)}</legend>
      <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto pr-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(value === option ? "" : option)}
            className={`rounded-full border px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              value === option
                ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                : "border-white/10 bg-[#141414] text-slate-400 hover:text-white"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-white/5 bg-[#1c1f26] px-4 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
      />
    </fieldset>
  );
}
