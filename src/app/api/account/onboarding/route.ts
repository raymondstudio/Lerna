import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthenticated. Please sign in to save your profile." }, { status: 401 });
    }

    const body = await req.json();
    const {
      accountType,
      institution,
      institutionId,
      institutionType,
      department,
      customDepartment,
      studyLevel,
      studyGoals,
      learningGoals,
      company,
      industry,
      jobTitle,
      occupation,
      areaOfInterest,
      field,
      goals,
    } = body;

    // ── 1. Universal validation ────────────────────────────────────────────────
    if (!accountType || accountType.trim() === "") {
      return NextResponse.json({
        success: false,
        error: "Validation Error: Please select who you are (e.g., Student, Teacher) to customize your workspace.",
        field: "accountType",
      }, { status: 400 });
    }

    // Determine which path the user is on (mirrors client-side accountPath logic)
    const normalized = accountType.toLowerCase();
    const isStudent = !normalized.includes("teacher") && !normalized.includes("professional") && !normalized.includes("learner") && !normalized.includes("other");
    const isTeacher = normalized.includes("teacher");
    const isProfessional = normalized.includes("professional");
    // isOther covers "Other" and "learner"

    // ── 2. Path-specific validation ───────────────────────────────────────────

    if (isStudent) {
      // Students must have institution, department, and studyLevel
      if (!institution || institution.trim() === "") {
        return NextResponse.json({
          success: false,
          error: "Validation Error: Please search or add your school so we can tailor your study experience.",
          field: "institution",
        }, { status: 400 });
      }

      const selectedDepartment = department === "Other" ? customDepartment : department;
      if (!selectedDepartment || selectedDepartment.trim() === "") {
        return NextResponse.json({
          success: false,
          error: "Validation Error: Please specify your study department, major, or field of study.",
          field: "department",
        }, { status: 400 });
      }

      if (!studyLevel || studyLevel.trim() === "") {
        return NextResponse.json({
          success: false,
          error: "Validation Error: Please specify your academic study level so the AI can calibrate explanation depth.",
          field: "studyLevel",
        }, { status: 400 });
      }

      const goals = Array.isArray(studyGoals) ? studyGoals : (Array.isArray(learningGoals) ? learningGoals : []);
      if (goals.length === 0) {
        return NextResponse.json({
          success: false,
          error: "Validation Error: Please select at least one learning goal to focus your tutoring session.",
          field: "studyGoals",
        }, { status: 400 });
      }
    }

    if (isTeacher) {
      // Teachers just need institution or company — at least one context field
      const hasContext = (institution && institution.trim()) || (company && company.trim());
      if (!hasContext) {
        return NextResponse.json({
          success: false,
          error: "Validation Error: Please tell us where you teach so we can personalize your workspace.",
          field: "institution",
        }, { status: 400 });
      }
    }

    if (isProfessional) {
      // Professionals must have company — institution is optional
      if (!company || company.trim() === "") {
        return NextResponse.json({
          success: false,
          error: "Validation Error: Please tell us where you work so we can tailor examples to your context.",
          field: "company",
        }, { status: 400 });
      }
    }

    // ── 3. Build the profile_data payload conditionally ───────────────────────
    const selectedDepartment = department === "Other" ? customDepartment : department;
    const resolvedGoals: string[] = Array.isArray(studyGoals)
      ? studyGoals
      : Array.isArray(learningGoals)
      ? learningGoals
      : Array.isArray(goals)
      ? goals
      : [];

    const profileData: Record<string, unknown> = {
      account_type: accountType.trim(),
      onboarding_completed: true,
    };

    if (isStudent) {
      profileData.institution = institution?.trim() ?? null;
      profileData.institution_id = institutionId || null;
      profileData.institution_type = institutionType || "University";
      profileData.department = selectedDepartment?.trim() ?? null;
      profileData.study_level = studyLevel?.trim() ?? null;
    } else if (isTeacher) {
      profileData.institution = (institution || company || "").trim() || null;
      profileData.institution_type = institutionType || "University";
      profileData.department = department?.trim() || null;
      profileData.occupation = occupation?.trim() || null;
    } else if (isProfessional) {
      profileData.company = company?.trim() || null;
      profileData.industry = industry?.trim() || null;
      profileData.job_title = jobTitle?.trim() || null;
      profileData.area_of_interest = areaOfInterest?.trim() || null;
      // institution left null — not required for professionals
      profileData.institution = null;
      profileData.institution_id = null;
    } else {
      // "Other" / independent learner
      profileData.occupation = occupation?.trim() || null;
      profileData.area_of_interest = areaOfInterest?.trim() || null;
      profileData.field = field?.trim() || null;
      // institution left null — not required for others
      profileData.institution = null;
      profileData.institution_id = null;
    }

    // ── 4. Perform transactional onboarding update in DB via RPC ──────────────
    const { data, error } = await supabase.rpc("complete_onboarding", {
      target_user_id: user.id,
      profile_data: profileData,
      pref_data: {
        learning_goals: resolvedGoals,
      },
    });

    if (error) {
      console.error("[api:account:onboarding] RPC transaction failed:", error);
      return NextResponse.json({ success: false, error: `Database Transaction Failed: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[api:account:onboarding] Unexpected server exception:", err);
    return NextResponse.json({ success: false, error: `Internal Server Error: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
