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
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [institution, setInstitution] = useState<string>("");
  const [customInstitution, setCustomInstitution] = useState<string>("");
  const [institutionType, setInstitutionType] = useState<string>("University");
  const [department, setDepartment] = useState<string>("");
  const [customDepartment, setCustomDepartment] = useState<string>("");
  const [studyLevel, setStudyLevel] = useState<string>("");
  const [studyGoals, setStudyGoals] = useState<string[]>([]);

  // Search filter
  const filteredInstitutions = INSTITUTIONS.filter(inst =>
    inst.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase client is not available.");

      const selectedInstitution = institution === "Other / Custom School" ? customInstitution : institution;
      const selectedDepartment = department === "Other" ? customDepartment : department;

      const { error } = await supabase
        .from("profiles")
        .update({
          account_type: accountType,
          institution: selectedInstitution,
          institution_type: institutionType,
          department: selectedDepartment,
          study_level: studyLevel,
          study_goals: studyGoals,
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);

      if (error) throw error;

      router.push("/chat");
      router.refresh();
    } catch (err) {
      console.error("[onboarding] Failed to save profile:", err);
      alert("An error occurred while saving your profile. Please try again.");
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
      
      {/* Background gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header Progress bar */}
      <div className="max-w-xl w-full mx-auto space-y-4 relative z-10">
        <div className="flex justify-between items-center text-xs text-slate-500 font-semibold tracking-wider uppercase">
          <span>EduAgent AI personalization</span>
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
                <h1 className="text-3xl font-bold tracking-tight text-white">Welcome to EduAgent AI 👋</h1>
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
                  { value: "University Student", desc: "Attending college, university, or post-grad studies" },
                  { value: "Secondary School Student", desc: "Attending high school, college prep, or equivalents" },
                  { value: "Teacher", desc: "Educator, lecturer, or course facilitator" },
                  { value: "Professional", desc: "Studying for industry certificates or self-improvement" },
                  { value: "Lifelong Learner", desc: "Just checking things out and researching topics" }
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
                <h2 className="text-2xl font-bold text-white">Your Institution</h2>
                <p className="text-slate-400 text-xs">Search or type your current school, college, or workplace.</p>
              </div>

              {/* Institution Type Segment */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-[#141414]/80 rounded-xl border border-white/5 text-[11px] font-semibold tracking-wider text-center text-slate-400">
                {["University", "Secondary School", "Organization"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setInstitutionType(type)}
                    className={`py-2 rounded-lg transition-colors ${
                      institutionType === type 
                        ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/10" 
                        : "hover:text-white"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search standard list..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 h-11 rounded-xl bg-[#1c1f26] border border-white/5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                  />
                </div>

                {searchQuery.trim() !== "" && (
                  <div className="border border-white/5 bg-[#141414]/80 backdrop-blur-md rounded-xl max-h-[160px] overflow-y-auto divide-y divide-white/5 pr-1">
                    {filteredInstitutions.map((inst) => (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => {
                          setInstitution(inst);
                          setSearchQuery("");
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-cyan-500/5 hover:text-white text-xs transition-colors flex items-center gap-2"
                      >
                        {inst.includes("Secondary") ? <School className="h-3.5 w-3.5 text-cyan-400" /> : <GraduationCap className="h-3.5 w-3.5 text-cyan-400" />}
                        <span>{inst}</span>
                      </button>
                    ))}
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
                      onClick={() => setInstitution("")}
                      className="h-7 px-2.5 text-[10px] text-slate-400 hover:text-white border border-white/5 rounded-lg"
                    >
                      Clear
                    </Button>
                  </div>
                )}

                {institution === "Other / Custom School" && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-1.5"
                  >
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Custom School Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Stanford Medical College"
                      value={customInstitution}
                      onChange={(e) => setCustomInstitution(e.target.value)}
                      className="w-full px-4 h-11 rounded-xl bg-[#1c1f26] border border-white/5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
                    />
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step-4" 
              variants={slideVariants} 
              initial="hidden" 
              animate="visible" 
              exit="exit"
              className="w-full space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">Department / Course</h2>
                <p className="text-slate-400 text-xs">Which field or department best maps your studies?</p>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
                {DEPARTMENTS.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setDepartment(dept)}
                    className={`p-3.5 rounded-xl border text-left text-xs font-semibold transition-all ${
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
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Enter field/department</label>
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

          {step === 5 && (
            <motion.div 
              key="step-5" 
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

              <div className="grid grid-cols-2 gap-2">
                {[
                  "100 Level", "200 Level", 
                  "300 Level", "400 Level", 
                  "500 Level", "Masters", 
                  "PhD", "Graduate", 
                  "Other"
                ].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setStudyLevel(level)}
                    className={`p-3.5 rounded-xl border text-center text-xs font-semibold transition-all ${
                      studyLevel === level 
                        ? "border-cyan-500 bg-cyan-500/5 text-white" 
                        : "border-white/5 bg-[#141414]/50 hover:bg-[#1a1a1a]/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 6 && (
            <motion.div 
              key="step-6" 
              variants={slideVariants} 
              initial="hidden" 
              animate="visible" 
              exit="exit"
              className="w-full space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">What are your learning goals?</h2>
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
                  const active = studyGoals.includes(goal);
                  return (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => toggleGoal(goal)}
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
                <h2 className="text-3xl font-bold tracking-tight text-white font-heading">You're all set! 🚀</h2>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
                  Your AI tutor is now personalized and structured around your goals. Let's begin studying!
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
              (step === 3 && !institution) ||
              (step === 4 && !department) ||
              (step === 5 && !studyLevel) ||
              (step === 6 && studyGoals.length === 0)
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
