import { z } from "zod";

export const ONBOARDING_ACCOUNT_TYPES = [
  "Student",
  "Teacher",
  "Professional",
  "Researcher",
  "Other",
] as const;

export type OnboardingAccountType = (typeof ONBOARDING_ACCOUNT_TYPES)[number];

const optionalText = (maxLength = 200) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() || undefined : value),
    z.string().max(maxLength).optional(),
  );

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() || undefined : value),
  z.string().uuid().optional(),
);

const optionalStringList = z.preprocess(
  (value) => {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
  },
  z.array(z.string().max(120)).max(20),
);

export const onboardingSubmissionSchema = z.object({
  accountType: z.enum(ONBOARDING_ACCOUNT_TYPES),
  institution: optionalText(240),
  institutionId: optionalUuid,
  institutionType: optionalText(80),
  faculty: optionalText(160),
  department: optionalText(160),
  studyLevel: optionalText(120),
  company: optionalText(200),
  occupation: optionalText(160),
  industry: optionalText(160),
  field: optionalText(240),
  studyGoals: optionalStringList,
  interests: optionalStringList,
});

export const onboardingDraftSchema = onboardingSubmissionSchema.partial().extend({
  step: z.number().int().min(1).max(6).optional(),
});

export type OnboardingSubmission = z.infer<typeof onboardingSubmissionSchema>;
export type OnboardingDraft = z.infer<typeof onboardingDraftSchema>;

export function buildOnboardingProfileData(data: OnboardingSubmission) {
  return {
    account_type: data.accountType,
    institution: data.institution ?? null,
    institution_id: data.institutionId ?? null,
    institution_type: data.institutionType ?? null,
    faculty: data.faculty ?? null,
    department: data.department ?? null,
    study_level: data.studyLevel ?? null,
    company: data.company ?? null,
    occupation: data.occupation ?? null,
    industry: data.industry ?? null,
    field: data.field ?? null,
    study_goals: data.studyGoals,
    interests: data.interests,
    is_student: data.accountType === "Student",
    onboarding_completed: true,
  };
}
