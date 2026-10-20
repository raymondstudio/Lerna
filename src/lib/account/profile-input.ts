import { z } from "zod";
import { buildProfileUpdatePayload } from "@/lib/profile";
import { ONBOARDING_ACCOUNT_TYPES } from "@/lib/onboarding";

const text = z.string().trim().max(240);
const list = z.array(z.string().trim().max(120)).max(40);
const editableFields = {
  firstName: "first_name", lastName: "last_name", accountType: "account_type", institution: "institution",
  institutionId: "institution_id", institutionType: "institution_type", faculty: "faculty", department: "department",
  studyLevel: "study_level", studyGoals: "study_goals", company: "company", occupation: "occupation", industry: "industry",
  field: "field", interests: "interests", gender: "gender", age: "age", teachingStyle: "teaching_style", difficulty: "difficulty",
  preferredQuizFormat: "preferred_quiz_format", preferredLanguage: "preferred_language", flashcardPreference: "flashcard_preference",
  responseLength: "response_length", voicePreference: "voice_preference", studyReminderEnabled: "study_reminder_enabled",
  marketingUpdatesEnabled: "marketing_updates_enabled", securityAlertsEnabled: "security_alerts_enabled",
  dailyGoalMinutes: "daily_goal_minutes", preferredTheme: "preferred_theme",
} as const;
const inputSchema = z.object({
  firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().max(100), accountType: z.enum(ONBOARDING_ACCOUNT_TYPES),
  institution: text.optional(), institutionId: z.union([z.string().uuid(), z.literal("")]).optional(), institutionType: text.optional(),
  faculty: text.optional(), department: text.optional(), studyLevel: text.optional(), studyGoals: list.optional(),
  company: text.optional(), occupation: text.optional(), industry: text.optional(), field: text.optional(), interests: list.optional(),
  gender: text.optional(), age: z.union([z.number().int().min(0).max(120), z.literal("")]).optional(),
  teachingStyle: text.optional(), difficulty: text.optional(), preferredQuizFormat: text.optional(), preferredLanguage: text.optional(),
  flashcardPreference: text.optional(), responseLength: text.optional(), voicePreference: text.optional(),
  studyReminderEnabled: z.boolean().optional(), marketingUpdatesEnabled: z.boolean().optional(), securityAlertsEnabled: z.boolean().optional(),
  dailyGoalMinutes: z.number().int().min(1).max(1440).optional(), preferredTheme: z.enum(["dark", "light", "system"]).optional(),
}).strict();

/** Map only present, editable keys. Helper defaults must never clear omitted profile fields. */
export function accountProfileUpdate(input: unknown): Record<string, unknown> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new Error("Check your profile fields. Names, preferences, and institution details must use the supported formats.");
  const built: Record<string, unknown> = buildProfileUpdatePayload(parsed.data);
  const result: Record<string, unknown> = { display_name: built.display_name, is_student: parsed.data.accountType === "Student", updated_at: new Date().toISOString() };
  for (const [key, column] of Object.entries(editableFields)) {
    if (Object.hasOwn(parsed.data, key)) result[column] = built[column];
  }
  return result;
}
