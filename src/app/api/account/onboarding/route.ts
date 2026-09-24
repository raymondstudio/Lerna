import { NextResponse } from "next/server";
import {
  ONBOARDING_ACCOUNT_TYPES,
  buildOnboardingProfileData,
  onboardingSubmissionSchema,
  type OnboardingAccountType,
} from "@/lib/onboarding";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function normalizeAccountType(value: unknown): OnboardingAccountType | "" {
  if (typeof value !== "string" || !value.trim()) return "";
  const exact = ONBOARDING_ACCOUNT_TYPES.find((type) => type.toLowerCase() === value.trim().toLowerCase());
  if (exact) return exact;
  if (value.toLowerCase().includes("educat")) return "Teacher";
  if (value.toLowerCase().includes("learn")) return "Other";
  return "Other";
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Please sign in again to load your profile.", requestId },
        { status: 401 },
      );
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("account_type,institution,institution_id,institution_type,faculty,department,study_level,company,occupation,industry,field,study_goals,interests")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[api:account:onboarding] Profile load failed", {
        requestId,
        userId: user.id,
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { success: false, error: "We could not load your saved profile.", requestId },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      requestId,
      data: profile
        ? {
            accountType: normalizeAccountType(profile.account_type),
            institution: profile.institution ?? "",
            institutionId: profile.institution_id ?? "",
            institutionType: profile.institution_type ?? "University",
            faculty: profile.faculty ?? "",
            department: profile.department ?? "",
            studyLevel: profile.study_level ?? "",
            company: profile.company ?? "",
            occupation: profile.occupation ?? "",
            industry: profile.industry ?? "",
            field: profile.field ?? "",
            studyGoals: stringList(profile.study_goals),
            interests: stringList(profile.interests),
          }
        : {},
    });
  } catch (error) {
    console.error("[api:account:onboarding] Unexpected profile load error", { requestId, error });
    return NextResponse.json(
      { success: false, error: "We could not load your saved profile.", requestId },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Please sign in again to save your profile.", requestId },
        { status: 401 },
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "The onboarding information could not be read.", requestId },
        { status: 400 },
      );
    }

    const parsed = onboardingSubmissionSchema.safeParse(rawBody);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      console.warn("[api:account:onboarding] Invalid payload", {
        requestId,
        userId: user.id,
        fields: parsed.error.issues.map((issue) => issue.path.join(".")),
      });
      return NextResponse.json(
        {
          success: false,
          error: firstIssue?.path[0] === "accountType"
            ? "Choose the option that best describes you before continuing."
            : "Please review the information you entered and try again.",
          field: firstIssue?.path.join(".") || undefined,
          requestId,
        },
        { status: 400 },
      );
    }

    const profileData = buildOnboardingProfileData(parsed.data);
    const { data, error } = await supabase.rpc("complete_onboarding", {
      target_user_id: user.id,
      profile_data: profileData,
      pref_data: {},
    });

    if (error) {
      console.error("[api:account:onboarding] Profile transaction failed", {
        requestId,
        userId: user.id,
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return NextResponse.json(
        {
          success: false,
          error: "We could not save your profile. Your progress is still available on this device, so please try again.",
          requestId,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data, requestId });
  } catch (error) {
    console.error("[api:account:onboarding] Unexpected error", { requestId, error });
    return NextResponse.json(
      { success: false, error: "Something went wrong while saving your profile. Please try again.", requestId },
      { status: 500 },
    );
  }
}
