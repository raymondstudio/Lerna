"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Search, 
  GraduationCap, 
  BookOpen, 
  Award, 
  Compass, 
  Target, 
  CheckCircle2, 
  Building,
  School
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const INSTITUTIONS = [
  "Federal University of Technology Minna (FUTMinna)",
  "Federal University of Technology Akure (FUTA)",
  "University of Lagos (UNILAG)",
  "University of Ibadan (UI)",
  "University of Benin (UNIBEN)",
  "University of Nigeria, Nsukka (UNN)",
  "Harvard University",
  "Stanford University",
  "Massachusetts Institute of Technology (MIT)",
  "University of Oxford",
  "University of Cambridge",
  "California Institute of Technology (Caltech)",
  "Princeton University",
  "Yale University",
  "University of California, Berkeley",
  "University of Chicago",
  "Columbia University",
  "Imperial College London",
  "ETH Zurich",
  "National University of Singapore (NUS)",
  "Nanyang Technological University (NTU)",
  "University of Toronto",
  "McGill University",
  "Tsinghua University",
  "Peking University",
  "University of Tokyo",
  "Other / Custom School"
];

const DEPARTMENTS = [
  "Computer Science",
  "Medicine & Healthcare",
  "Engineering & Technology",
  "Law & Legal Studies",
  "Accounting & Finance",
  "Architecture & Design",
  "Business Administration & Economics",
  "Biological & Chemical Sciences",
  "Humanities & Arts",
  "Other"
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form states
  const [accountType, setAccountType] = useState<string>("");
  const [faculty, setFaculty] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [institution, setInstitution] = useState<string>("");
  const [institutionId, setInstitutionId] = useState<string>("");
  const [institutionType, setInstitutionType] = useState<string>("University");
  const [department, setDepartment] = useState<string>("");
  const [customDepartment, setCustomDepartment] = useState<string>("");
  const [studyLevel, setStudyLevel] = useState<string>("");
  const [studyGoals, setStudyGoals] = useState<string[]>([]);
  const [company, setCompany] = useState<string>("");
  const [industry, setIndustry] = useState<string>("");
  const [jobTitle, setJobTitle] = useState<string>("");
  const [occupation, setOccupation] = useState<string>("");
  const [areaOfInterest, setAreaOfInterest] = useState<string>("");
  const [professionalGoals, setProfessionalGoals] = useState<string[]>([]);

  // Search and custom school integration states
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showCustomForm, setShowCustomForm] = useState<boolean>(false);

  // States for the custom institution creation form
  const [customName, setCustomName] = useState<string>("");
  const [customType, setCustomType] = useState<string>("University");
  const [customState, setCustomState] = useState<string>("");
  const [customCountry, setCustomCountry] = useState<string>("Nigeria");
  const [customSubmitting, setCustomSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Debounced search query
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

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  const toggleGoal = (goal: string) => {
    setStudyGoals(prev => 
      prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal]
    );
  };

  const accountPath = (() => {
    const normalized = accountType.toLowerCase();
    if (normalized.includes("teacher")) return "teacher";
    if (normalized.includes("professional")) return "professional";
    if (normalized.includes("learner") || normalized.includes("other")) return "other";
    return "student";
  })();

  const activeGoals = accountPath === "professional" ? professionalGoals : studyGoals;
  const isStudentPath = accountPath === "student";
  const isTeacherPath = accountPath === "teacher";
  const isProfessionalPath = accountPath === "professional";
  const isOtherPath = accountPath === "other";

  const handleNext = () => {
    if (step < 7) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleFinish = async () => {
    if (!user) return;
    try {
      setSaving(true);
      setErrorMsg(null);

      const res = await fetch("/api/account/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType,
          faculty,
          institution,
          institutionId,
          institutionType,
          department,
          customDepartment,
          studyLevel,
          company,
          industry,
          jobTitle,
          occupation,
          areaOfInterest,
          studyGoals: isProfessionalPath ? professionalGoals : studyGoals,
          learningGoals: isProfessionalPath ? professionalGoals : studyGoals,
          field: isOtherPath ? areaOfInterest : undefined,
          goals: isOtherPath ? professionalGoals : undefined,
        })
      });

      const json = await res.json();
      if (json.success) {
        sessionStorage.removeItem("onboarding_skipped");
        router.push("/chat");
        router.refresh();
      } else {
        setErrorMsg(json.error || "Failed to finalize onboarding parameters.");
      }
    } catch (err) {
      console.error("[onboarding] Failed to save profile:", err);
      setErrorMsg("Connection error: Unable to save your profile parameters. Please verify your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
      </div>
    );
  }

  // Animation variants
  const slideVariants = {
    hidden: { opacity: 0, x: 50 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, x: -50, transition: { duration: 0.2 } }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200 flex flex-col justify-between py-12 px-4 md:px-6 relative overflow-hidden font-body selection:bg-cyan-500/30">
      
      {/* Complete later action */}
      <div className="absolute top-4 right-4 z-20">
        <Button
          variant="ghost"
          onClick={() => {
            sessionStorage.setItem("onboarding_skipped", "true");
            router.push("/chat");
          }}
          className="text-xs text-slate-400 hover:text-white border border-white/5 bg-[#141414]/50 rounded-full h-8"
        >
          Complete later
        </Button>
      </div>

      {/* Background gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header Progress bar */}
      <div className="max-w-xl w-full mx-auto space-y-4 relative z-10">
        <div className="flex justify-between items-center text-xs text-slate-500 font-semibold tracking-wider uppercase">
          <span>Lerna AI personalization</span>
          <span>Step {step} of 7</span>
        </div>
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-cyan-500 to-violet-500"
            initial={{ width: "0%" }}
            animate={{ width: `${(step / 7) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/25 text-red-300 text-xs text-center flex items-center justify-between gap-3 animate-in fade-in duration-200 mt-2">
            <span className="font-semibold">{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg(null)} className="hover:text-white font-bold text-sm select-none p-1">×</button>
          </div>
        )}
      </div>

      {/* Main Form container */}
      <div className="max-w-xl w-full mx-auto my-auto py-8 relative z-10 flex flex-col items-center">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step-1" 
              variants={slideVariants} 
              initial="hidden" 
              animate="visible" 
              exit="exit"
              className="w-full text-center space-y-6"
            >
              <div className="mx-auto h-16 w-16 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <Compass className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-white">Welcome to Lerna AI</h1>
                <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
                  We'll customize your smart AI tutoring dashboard and space in less than 30 seconds.
                </p>
              </div>
              <Button 
                onClick={handleNext} 
                className="w-full max-w-xs h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]"
              >
                Let's get started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step-2" 
              variants={slideVariants} 
              initial="hidden" 
              animate="visible" 
              exit="exit"
              className="w-full space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">Who are you?</h2>
                <p className="text-slate-400 text-xs">Select your current academic profile role.</p>
              </div>

              <div className="grid gap-3">
                {[
                  { value: "Student", desc: "Attending school, college, university, or post-grad studies" },
                  { value: "Teacher", desc: "Educator, lecturer, or course facilitator" },
                  { value: "Professional", desc: "Studying for industry certificates or self-improvement" },
                  { value: "Other", desc: "Learning independently or exploring a new field" }
                ].map((role) => (
                  <button
                    key={role.value}
                    onClick={() => setAccountType(role.value)}
                    className={`p-4 rounded-xl border text-left flex justify-between items-center transition-all bg-[#141414]/50 backdrop-blur-sm ${
                      accountType === role.value 
                        ? "border-cyan-500 bg-cyan-500/5 text-white" 
                        : "border-white/5 hover:border-white/10 hover:bg-[#1a1a1a]/60 text-slate-300"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="font-semibold text-sm block">{role.value}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{role.desc}</span>
                    </div>
                    {accountType === role.value && (
                      <div className="h-5 w-5 rounded-full bg-cyan-500 flex items-center justify-center text-slate-950">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step-3" 
              variants={slideVariants} 
              initial="hidden" 
              animate="visible" 
              exit="exit"
              className="w-full space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">
                  {isProfessionalPath ? "Your Company" : isTeacherPath ? "Your Institution" : isOtherPath ? "Your Learning Context" : "Your Institution"}
                </h2>
                <p className="text-slate-400 text-xs">
                  {isProfessionalPath
                    ? "Tell us where you work so we can tailor examples to your context."
                    : isTeacherPath
                      ? "Search or type the institution where you teach."
                      : isOtherPath
                        ? "Tell us a little about what you do and what you want to learn."
                        : "Search or type your current school, college, or workplace."}
                </p>
              </div>

              {isProfessionalPath ? (
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Company or organization"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-4 h-11 rounded-xl bg-[#1c1f26] border border-white/5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                  />
                  <input
                    type="text"
                    placeholder="Industry"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full px-4 h-11 rounded-xl bg-[#1c1f26] border border-white/5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                  />
                  <input
                    type="text"
                    placeholder="Job title"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="w-full px-4 h-11 rounded-xl bg-[#1c1f26] border border-white/5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              ) : isOtherPath ? (
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Occupation"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    className="w-full px-4 h-11 rounded-xl bg-[#1c1f26] border border-white/5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                  />
                  <input
                    type="text"
                    placeholder="Area of interest"
                    value={areaOfInterest}
                    onChange={(e) => setAreaOfInterest(e.target.value)}
                    className="w-full px-4 h-11 rounded-xl bg-[#1c1f26] border border-white/5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              ) : !showCustomForm ? (
                <>
                  {/* Institution Type Segment */}
                  <div className="grid grid-cols-4 gap-1 p-1 bg-[#141414]/80 rounded-xl border border-white/5 text-[10px] font-semibold tracking-wider text-center text-slate-400">
                    {["University", "Polytechnic", "College of Education", "Secondary School"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setInstitutionType(type);
                          setSearchQuery("");
                          setSearchResults([]);
                        }}
                        className={`py-2 px-1 rounded-lg transition-colors truncate ${
                          institutionType === type 
                            ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/10" 
                            : "hover:text-white"
                        }`}
                      >
                        {type === "College of Education" ? "COE" : type}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder={`Search ${institutionType.toLowerCase()}s... (e.g. futa, lagos)`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 h-11 rounded-xl bg-[#1c1f26] border border-white/5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                      />
                    </div>

                    {isSearching && (
                      <div className="flex items-center justify-center py-6">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent"></div>
                      </div>
                    )}

                    {!isSearching && searchQuery.trim() !== "" && (
                      <div className="border border-white/5 bg-[#141414]/80 backdrop-blur-md rounded-xl max-h-[200px] overflow-y-auto divide-y divide-white/5 pr-1">
                        {searchResults.length > 0 ? (
                          searchResults.map((inst) => (
                            <button
                              key={inst.id}
                              type="button"
                              onClick={() => handleSelectInstitution(inst)}
                              className="w-full text-left px-4 py-3 hover:bg-cyan-500/5 hover:text-white text-xs transition-colors flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {inst.institution_type === "Secondary School" ? (
                                  <School className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                                ) : (
                                  <GraduationCap className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                                )}
                                <div className="truncate">
                                  <span className="font-semibold text-slate-200">
                                    {inst.name}
                                    {inst.short_name ? ` (${inst.short_name})` : ""}
                                  </span>
                                  <span className="text-[10px] text-slate-500 block">
                                    {inst.city ? `${inst.city}, ` : ""}{inst.state ? `${inst.state}, ` : ""}{inst.country}
                                  </span>
                                </div>
                              </div>
                              {inst.is_verified && (
                                <span className="text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">Verified</span>
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="p-4 text-center space-y-3">
                            <p className="text-xs text-slate-500">Can't find your school?</p>
                            <Button
                              type="button"
                              onClick={() => {
                                setCustomName(searchQuery);
                                setCustomType(institutionType);
                                setShowCustomForm(true);
                              }}
                              className="h-9 px-4 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-xs font-semibold"
                            >
                              + Add my institution
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {searchQuery.trim() === "" && !institution && (
                      <div className="p-4 text-center border border-dashed border-white/5 rounded-xl">
                        <p className="text-[11px] text-slate-500">Type above to search our official database or add your own school manually.</p>
                      </div>
                    )}

                    {/* Selection status */}
                    {institution && (
                      <div className="p-3.5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-cyan-400" />
                          <div>
                            <span className="text-slate-500 block font-semibold uppercase text-[9px] tracking-wider">Selected Institution</span>
                            <span className="text-white font-bold">{institution}</span>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          onClick={() => {
                            setInstitution("");
                            setInstitutionId("");
                          }}
                          className="h-7 px-2.5 text-[10px] text-slate-400 hover:text-white border border-white/5 rounded-lg"
                        >
                          Clear
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <motion.form 
                  onSubmit={handleAddCustomInstitution}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-5 rounded-2xl border border-white/5 bg-[#14161a] space-y-4 text-left"
                >
                  <h3 className="text-sm font-semibold text-white">Add Custom Institution</h3>
                  
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Institution Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Lagos City Academy"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full px-4 h-10 rounded-xl bg-[#1c1f26] border border-white/5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Type</label>
                      <select
                        value={customType}
                        onChange={(e) => setCustomType(e.target.value)}
                        className="w-full px-3 h-10 rounded-xl bg-[#1c1f26] border border-white/5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
                      >
                        {["University", "Polytechnic", "College of Education", "Secondary School", "Primary School", "Other"].map(t => (
                          <option key={t} value={t} className="bg-slate-950">{t}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">State / Region</label>
                      <input
                        type="text"
                        placeholder="e.g. Lagos"
                        value={customState}
                        onChange={(e) => setCustomState(e.target.value)}
                        className="w-full px-4 h-10 rounded-xl bg-[#1c1f26] border border-white/5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Country</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Nigeria"
                      value={customCountry}
                      onChange={(e) => setCustomCountry(e.target.value)}
                      className="w-full px-4 h-10 rounded-xl bg-[#1c1f26] border border-white/5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>

                  <div className="flex gap-2.5 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowCustomForm(false)}
                      className="flex-1 h-10 text-xs rounded-xl border border-white/5 text-slate-400 hover:text-white"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={customSubmitting}
                      className="flex-1 h-10 text-xs rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                    >
                      {customSubmitting ? "Saving..." : "Add & Select"}
                    </Button>
                  </div>
                </motion.form>
              )}
            </motion.div>
          )}

          {step === 4 && isStudentPath && (
            <motion.div 
              key="step-4" 
              variants={slideVariants} 
              initial="hidden" 
              animate="visible" 
              exit="exit"
              className="w-full space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">Faculty</h2>
                <p className="text-slate-400 text-xs">Which faculty or school best maps your studies?</p>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
                {["Science", "Engineering", "Arts", "Business", "Law", "Medicine", "Education", "Social Sciences", "Other"].map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setFaculty(dept)}
                    className={`p-3.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                      faculty === dept 
                        ? "border-cyan-500 bg-cyan-500/5 text-white" 
                        : "border-white/5 bg-[#141414]/50 hover:bg-[#1a1a1a]/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>

              {faculty === "Other" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-1.5"
                >
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Enter faculty / school</label>
                  <input
                    type="text"
                    placeholder="e.g. Faculty of Computing"
                    value={customDepartment}
                    onChange={(e) => setCustomDepartment(e.target.value)}
                    className="w-full px-4 h-11 rounded-xl bg-[#1c1f26] border border-white/5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
                  />
                </motion.div>
              )}
            </motion.div>
          )}

          {step === 5 && isStudentPath && (
            <motion.div 
              key="step-5" 
              variants={slideVariants} 
              initial="hidden" 
              animate="visible" 
              exit="exit"
              className="w-full space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">Department / Course</h2>
                <p className="text-slate-400 text-xs">Which department best reflects your studies?</p>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
                {DEPARTMENTS.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setDepartment(dept)}
                    className={`p-3.5 rounded-xl border text-center text-xs font-semibold transition-all ${
                      department === dept 
                        ? "border-cyan-500 bg-cyan-500/5 text-white" 
                        : "border-white/5 bg-[#141414]/50 hover:bg-[#1a1a1a]/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>

              {department === "Other" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-1.5"
                >
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Enter field / department</label>
                  <input
                    type="text"
                    placeholder="e.g. Political Science"
                    value={customDepartment}
                    onChange={(e) => setCustomDepartment(e.target.value)}
                    className="w-full px-4 h-11 rounded-xl bg-[#1c1f26] border border-white/5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
                  />
                </motion.div>
              )}
            </motion.div>
          )}

          {step === 6 && isStudentPath && (
            <motion.div 
              key="step-6" 
              variants={slideVariants} 
              initial="hidden" 
              animate="visible" 
              exit="exit"
              className="w-full space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">Current study level</h2>
                <p className="text-slate-400 text-xs">Choose the level that best reflects your profile.</p>
              </div>

              <div className="grid gap-2">
                {[
                  "100 Level", "200 Level",
                  "300 Level", "400 Level",
                  "500 Level", "Masters",
                  "PhD", "Graduate",
                  "Other"
                ].map((level) => {
                  const active = studyLevel === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setStudyLevel(level)}
                      className={`p-4 rounded-xl border text-left flex justify-between items-center transition-all ${
                        active 
                          ? "border-cyan-500 bg-cyan-500/5 text-white" 
                          : "border-white/5 bg-[#141414]/50 hover:bg-[#1a1a1a]/60 text-slate-400"
                      }`}
                    >
                      <span className="text-xs font-semibold">{level}</span>
                      {active ? (
                        <div className="h-5 w-5 rounded-full bg-cyan-500 flex items-center justify-center text-slate-950">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-full border border-white/10" />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 4 && isTeacherPath && (
            <motion.div
              key="step-4-teacher"
              variants={slideVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">Institution and role</h2>
                <p className="text-slate-400 text-xs">Tell us where you teach and what your role is.</p>
              </div>

              <input type="text" placeholder="Institution" value={institution} onChange={(e) => setInstitution(e.target.value)} className="w-full px-4 h-11 rounded-xl bg-[#1c1f26] border border-white/5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50" />
              <input type="text" placeholder="Department" value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full px-4 h-11 rounded-xl bg-[#1c1f26] border border-white/5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50" />
              <input type="text" placeholder="Role" value={occupation} onChange={(e) => setOccupation(e.target.value)} className="w-full px-4 h-11 rounded-xl bg-[#1c1f26] border border-white/5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50" />
            </motion.div>
          )}

          {step === 4 && isProfessionalPath && (
            <motion.div
              key="step-4-professional"
              variants={slideVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">Your goals</h2>
                <p className="text-slate-400 text-xs">Add the professional goals you want the AI to focus on.</p>
              </div>

              <textarea value={areaOfInterest} onChange={(e) => setAreaOfInterest(e.target.value)} placeholder="Area of interest" className="w-full min-h-[110px] px-4 py-3 rounded-xl bg-[#1c1f26] border border-white/5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50" />
              <textarea value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Job title or role" className="w-full min-h-[110px] px-4 py-3 rounded-xl bg-[#1c1f26] border border-white/5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50" />
            </motion.div>
          )}

          {step === 4 && isOtherPath && (
            <motion.div
              key="step-4-other"
              variants={slideVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">Your goals</h2>
                <p className="text-slate-400 text-xs">Tell us what you want to learn and why.</p>
              </div>

              <textarea value={areaOfInterest} onChange={(e) => setAreaOfInterest(e.target.value)} placeholder="Area of interest" className="w-full min-h-[110px] px-4 py-3 rounded-xl bg-[#1c1f26] border border-white/5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50" />
              <textarea value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="Occupation" className="w-full min-h-[110px] px-4 py-3 rounded-xl bg-[#1c1f26] border border-white/5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50" />
            </motion.div>
          )}

          {step === 5 && (isTeacherPath || isProfessionalPath || isOtherPath) && (
            <motion.div
              key="step-5-role-goals"
              variants={slideVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">Learning goals</h2>
                <p className="text-slate-400 text-xs">Select one or more targets (you can edit later).</p>
              </div>

              <div className="grid gap-2">
                {[
                  "Prepare for Exams",
                  "Complete Assignments",
                  "Understand Difficult Topics",
                  "Research",
                  "Daily Learning",
                  "Professional Skills"
                ].map((goal) => {
                  const active = activeGoals.includes(goal);
                  return (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => accountPath === "professional" ? setProfessionalGoals(prev => prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal]) : toggleGoal(goal)}
                      className={`p-4 rounded-xl border text-left flex justify-between items-center transition-all ${
                        active
                          ? "border-cyan-500 bg-cyan-500/5 text-white"
                          : "border-white/5 bg-[#141414]/50 hover:bg-[#1a1a1a]/60 text-slate-400"
                      }`}
                    >
                      <span className="text-xs font-semibold">{goal}</span>
                      {active ? (
                        <div className="h-5 w-5 rounded-full bg-cyan-500 flex items-center justify-center text-slate-950">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-full border border-white/10" />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 6 && (isTeacherPath || isProfessionalPath || isOtherPath) && (
            <motion.div
              key="step-6-role-summary"
              variants={slideVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">Current focus</h2>
                <p className="text-slate-400 text-xs">Tell us the level or focus you want the tutor to assume.</p>
              </div>

              <textarea value={studyLevel} onChange={(e) => setStudyLevel(e.target.value)} placeholder={isTeacherPath ? "Teaching level or class" : isProfessionalPath ? "Current skill level" : "Current learning stage"} className="w-full min-h-[120px] px-4 py-3 rounded-xl bg-[#1c1f26] border border-white/5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50" />
            </motion.div>
          )}

          {step === 7 && (
            <motion.div 
              key="step-7" 
              variants={slideVariants} 
              initial="hidden" 
              animate="visible" 
              exit="exit"
              className="w-full text-center space-y-6"
            >
              <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="h-8 w-8 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-white font-heading">You're all set!</h2>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
                  Your AI tutor is now personalized and structured around your profile. Let's begin studying!
                </p>
              </div>
              <Button 
                onClick={handleFinish} 
                disabled={saving}
                className="w-full max-w-xs h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]"
              >
                {saving ? "Configuring..." : "Proceed to Chat"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Navigation panel */}
      {step > 1 && step < 7 && (
        <div className="max-w-xl w-full mx-auto flex gap-3 justify-between items-center relative z-10">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white border border-white/5 px-4 h-10 rounded-full"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>

          <Button
            onClick={handleNext}
            disabled={
              (step === 2 && !accountType) ||
              (step === 3 && isStudentPath && !institution) ||
              (step === 3 && isTeacherPath && !company && !institution) ||
              (step === 3 && isProfessionalPath && !company) ||
              (step === 3 && isOtherPath && !occupation) ||
              (step === 4 && isStudentPath && !faculty) ||
              (step === 4 && isTeacherPath && !occupation) ||
              (step === 4 && (isProfessionalPath || isOtherPath) && !areaOfInterest) ||
              (step === 5 && (isTeacherPath || isProfessionalPath || isOtherPath) && activeGoals.length === 0) ||
              (step === 6 && (isTeacherPath || isProfessionalPath || isOtherPath) && !studyLevel) ||
              (step === 4 && isStudentPath && !department) ||
              (step === 5 && isStudentPath && !studyLevel) ||
              (step === 6 && isStudentPath && !studyLevel)
            }
            className="flex items-center gap-1.5 text-xs text-slate-950 font-bold bg-cyan-500 hover:bg-cyan-400 px-6 h-10 rounded-full disabled:opacity-30"
          >
            Next <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
