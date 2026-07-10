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

    const { accountType, institution, institutionId, institutionType, department, customDepartment, studyLevel, studyGoals } = await req.json();

    // 1. Server-side validation with descriptive messages
    if (!accountType || accountType.trim() === "") {
      return NextResponse.json({ success: false, error: "Validation Error: Please select who you are (e.g., Student, Teacher) to customize your workspace.", field: "accountType" }, { status: 400 });
    }

    if (!institution || institution.trim() === "") {
      return NextResponse.json({ success: false, error: "Validation Error: Institution is required. Please search or add your school manually.", field: "institution" }, { status: 400 });
    }

    const selectedDepartment = department === "Other" ? customDepartment : department;
    if (!selectedDepartment || selectedDepartment.trim() === "") {
      return NextResponse.json({ success: false, error: "Validation Error: Please specify your study department, major, or field of study.", field: "department" }, { status: 400 });
    }

    if (!studyLevel || studyLevel.trim() === "") {
      return NextResponse.json({ success: false, error: "Validation Error: Please specify your academic study level to let the AI calibrate explanation depth.", field: "studyLevel" }, { status: 400 });
    }

    if (!Array.isArray(studyGoals) || studyGoals.length === 0) {
      return NextResponse.json({ success: false, error: "Validation Error: Please select at least one learning goal to focus your tutoring session.", field: "studyGoals" }, { status: 400 });
    }

    // 2. Perform transactional onboarding update in DB via RPC
    const { data, error } = await supabase.rpc("complete_onboarding", {
      target_user_id: user.id,
      profile_data: {
        account_type: accountType.trim(),
        institution: institution.trim(),
        institution_id: institutionId || null,
        institution_type: institutionType || "University",
        department: selectedDepartment.trim(),
        study_level: studyLevel.trim(),
        onboarding_completed: true
      },
      pref_data: {
        learning_goals: studyGoals
      }
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
