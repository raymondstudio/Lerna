export type FeatureName =
  | "ai_chat"
  | "advanced_quizzes"
  | "puzzle_generation"
  | "flashcards"
  | "ocr"
  | "voice_tutor"
  | "unlimited_uploads"
  | "analytics"
  | "premium_support"
  | "team_workspace";

export const PLAN_FEATURES: Record<string, FeatureName[]> = {
  free: [
    "ai_chat",
    "flashcards"
  ],
  student: [
    "ai_chat",
    "advanced_quizzes",
    "flashcards",
    "ocr",
    "voice_tutor"
  ],
  pro: [
    "ai_chat",
    "advanced_quizzes",
    "puzzle_generation",
    "flashcards",
    "ocr",
    "voice_tutor",
    "analytics",
    "premium_support"
  ],
  premium: [
    "ai_chat",
    "advanced_quizzes",
    "puzzle_generation",
    "flashcards",
    "ocr",
    "voice_tutor",
    "analytics",
    "premium_support"
  ],
  team: [
    "ai_chat",
    "advanced_quizzes",
    "puzzle_generation",
    "flashcards",
    "ocr",
    "voice_tutor",
    "unlimited_uploads",
    "analytics",
    "premium_support",
    "team_workspace"
  ],
  enterprise: [
    "ai_chat",
    "advanced_quizzes",
    "puzzle_generation",
    "flashcards",
    "ocr",
    "voice_tutor",
    "unlimited_uploads",
    "analytics",
    "premium_support",
    "team_workspace"
  ]
};

/**
 * Checks if a plan has entitlement for a specific feature flag.
 */
export function planHasFeature(plan: string, feature: FeatureName): boolean {
  const normPlan = (plan || "free").toLowerCase().trim();
  const features = PLAN_FEATURES[normPlan] || PLAN_FEATURES.free;
  return features.includes(feature);
}
