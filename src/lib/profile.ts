export type NormalizedProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl: string;
  onboardingCompleted: boolean;
  accountType: string;
  institution: string;
  institutionId: string;
  institutionType: string;
  faculty: string;
  department: string;
  studyLevel: string;
  occupation: string;
  industry: string;
  field: string;
  bio: string;
  country: string;
  timezone: string;
  studyGoals: string[];
  favoriteSubjects: string[];
  interests: string[];
  accessibilityPreferences: Record<string, any>;
  learningPreferences: Record<string, any>;
  teachingStyle: string;
  difficulty: string;
  preferredLanguage: string;
  preferredQuizFormat: string;
  preferredQuestionType: string;
  flashcardPreference: string;
  responseLength: string;
  voicePreference: string;
  studyReminderEnabled: boolean;
  marketingUpdatesEnabled: boolean;
  securityAlertsEnabled: boolean;
  preferredTheme: string;
  dailyGoalMinutes: number;
  isStudent: boolean;
  gender: string;
  age: number | "";
  isSuspended: boolean;
  isDeleted: boolean;
  tosAcceptedAt?: string | null;
  privacyAcceptedAt?: string | null;
  referralCodeUsed?: string | null;
  institutionInviteCodeUsed?: string | null;
  plan: string;
  subscriptionStatus: string;
  billingCycle: string;
  role: string;
  createdAt?: string;
  updatedAt?: string;
  lastActive?: string;
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

export function normalizeProfile(profile: Record<string, any> | null | undefined, subscription?: Record<string, any> | null, role?: Record<string, any> | null): NormalizedProfile | null {
  if (!profile) {
    return null;
  }

  const firstName = asString(profile.first_name);
  const lastName = asString(profile.last_name);
  const displayName = asString(profile.display_name, `${firstName} ${lastName}`.trim() || "User");

  const normalized = {
    id: profile.id,
    email: asString(profile.email),
    firstName,
    lastName,
    displayName,
    avatarUrl: asString(profile.avatar_url),
    onboardingCompleted: Boolean(profile.onboarding_completed),
    accountType: asString(profile.account_type, "Student"),
    institution: asString(profile.institution),
    institutionId: asString(profile.institution_id),
    institutionType: asString(profile.institution_type),
    faculty: asString(profile.faculty),
    department: asString(profile.department),
    studyLevel: asString(profile.study_level, "Undergraduate"),
    occupation: asString(profile.occupation),
    industry: asString(profile.industry),
    field: asString(profile.field),
    bio: asString(profile.bio),
    country: asString(profile.country),
    timezone: asString(profile.timezone),
    studyGoals: asStringArray(profile.study_goals),
    favoriteSubjects: asStringArray(profile.favorite_subjects),
    interests: asStringArray(profile.interests),
    accessibilityPreferences: asObject(profile.accessibility_preferences),
    learningPreferences: asObject(profile.learning_preferences),
    teachingStyle: asString(profile.teaching_style, "Intermediate"),
    difficulty: asString(profile.difficulty, "Medium"),
    preferredLanguage: asString(profile.preferred_language, "English"),
    preferredQuizFormat: asString(profile.preferred_quiz_format, "Mixed"),
    preferredQuestionType: asString(profile.preferred_question_type, "Mixed"),
    flashcardPreference: asString(profile.flashcard_preference, "Standard"),
    responseLength: asString(profile.response_length, "Medium"),
    voicePreference: asString(profile.voice_preference, "Default"),
    studyReminderEnabled: profile.study_reminder_enabled ?? true,
    marketingUpdatesEnabled: profile.marketing_updates_enabled ?? true,
    securityAlertsEnabled: profile.security_alerts_enabled ?? true,
    preferredTheme: asString(profile.preferred_theme, "dark"),
    dailyGoalMinutes: Number(profile.daily_goal_minutes ?? 15),
    isStudent: profile.is_student ?? true,
    gender: asString(profile.gender),
    age: profile.age ?? "",
    isSuspended: Boolean(profile.is_suspended),
    isDeleted: Boolean(profile.is_deleted),
    tosAcceptedAt: profile.tos_accepted_at ?? null,
    privacyAcceptedAt: profile.privacy_accepted_at ?? null,
    referralCodeUsed: profile.referral_code_used ?? null,
    institutionInviteCodeUsed: profile.institution_invite_code_used ?? null,
    plan: asString(subscription?.plan, "free"),
    subscriptionStatus: asString(subscription?.subscription_status || subscription?.status, "active"),
    billingCycle: asString(subscription?.billing_cycle, "monthly"),
    role: asString(role?.role, "user"),
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
    lastActive: profile.last_active,
  };

  return {
    ...normalized,
    first_name: normalized.firstName,
    last_name: normalized.lastName,
    display_name: normalized.displayName,
    avatar_url: normalized.avatarUrl,
    onboarding_completed: normalized.onboardingCompleted,
    account_type: normalized.accountType,
    institution_id: normalized.institutionId,
    institution_type: normalized.institutionType,
    study_level: normalized.studyLevel,
    study_goals: normalized.studyGoals,
    favorite_subjects: normalized.favoriteSubjects,
    accessibility_preferences: normalized.accessibilityPreferences,
    learning_preferences: normalized.learningPreferences,
    teaching_style: normalized.teachingStyle,
    preferred_language: normalized.preferredLanguage,
    preferred_quiz_format: normalized.preferredQuizFormat,
    preferred_question_type: normalized.preferredQuestionType,
    flashcard_preference: normalized.flashcardPreference,
    response_length: normalized.responseLength,
    voice_preference: normalized.voicePreference,
    study_reminder_enabled: normalized.studyReminderEnabled,
    marketing_updates_enabled: normalized.marketingUpdatesEnabled,
    security_alerts_enabled: normalized.securityAlertsEnabled,
    preferred_theme: normalized.preferredTheme,
    daily_goal_minutes: normalized.dailyGoalMinutes,
    is_student: normalized.isStudent,
    is_suspended: normalized.isSuspended,
    is_deleted: normalized.isDeleted,
    tos_accepted_at: normalized.tosAcceptedAt,
    privacy_accepted_at: normalized.privacyAcceptedAt,
    referral_code_used: normalized.referralCodeUsed,
    institution_invite_code_used: normalized.institutionInviteCodeUsed,
    subscription_status: normalized.subscriptionStatus,
    billing_cycle: normalized.billingCycle,
  } as NormalizedProfile & Record<string, any>;
}

export function buildProfileUpdatePayload(data: Record<string, any>) {
  const firstName = asString(data.firstName ?? data.first_name).trim();
  const lastName = asString(data.lastName ?? data.last_name).trim();
  const displayName = asString(data.displayName ?? data.display_name).trim() || `${firstName} ${lastName}`.trim();

  return {
    first_name: firstName,
    last_name: lastName,
    display_name: displayName || null,
    avatar_url: asString(data.avatarUrl ?? data.avatar_url).trim() || null,
    account_type: asString(data.accountType ?? data.account_type).trim() || null,
    institution: asString(data.institution).trim() || null,
    institution_id: data.institutionId || data.institution_id || null,
    institution_type: asString(data.institutionType ?? data.institution_type).trim() || null,
    faculty: asString(data.faculty).trim() || null,
    department: asString(data.department).trim() || null,
    study_level: asString(data.studyLevel ?? data.study_level).trim() || null,
    occupation: asString(data.occupation).trim() || null,
    industry: asString(data.industry).trim() || null,
    field: asString(data.field).trim() || null,
    bio: asString(data.bio).trim() || null,
    country: asString(data.country).trim() || null,
    timezone: asString(data.timezone).trim() || null,
    study_goals: asStringArray(data.studyGoals ?? data.study_goals),
    favorite_subjects: asStringArray(data.favoriteSubjects ?? data.favorite_subjects),
    interests: asStringArray(data.interests),
    accessibility_preferences: asObject(data.accessibilityPreferences ?? data.accessibility_preferences),
    learning_preferences: asObject(data.learningPreferences ?? data.learning_preferences),
    teaching_style: asString(data.teachingStyle ?? data.teaching_style).trim() || null,
    difficulty: asString(data.difficulty).trim() || null,
    preferred_language: asString(data.preferredLanguage ?? data.preferred_language).trim() || null,
    preferred_quiz_format: asString(data.preferredQuizFormat ?? data.preferred_quiz_format).trim() || null,
    preferred_question_type: asString(data.preferredQuestionType ?? data.preferred_question_type).trim() || null,
    flashcard_preference: asString(data.flashcardPreference ?? data.flashcard_preference).trim() || null,
    response_length: asString(data.responseLength ?? data.response_length).trim() || null,
    voice_preference: asString(data.voicePreference ?? data.voice_preference).trim() || null,
    study_reminder_enabled: data.studyReminderEnabled ?? data.study_reminder_enabled,
    marketing_updates_enabled: data.marketingUpdatesEnabled ?? data.marketing_updates_enabled,
    security_alerts_enabled: data.securityAlertsEnabled ?? data.security_alerts_enabled,
    preferred_theme: asString(data.preferredTheme ?? data.preferred_theme).trim() || null,
    daily_goal_minutes: data.dailyGoalMinutes ?? data.daily_goal_minutes ?? null,
    is_student: data.isStudent ?? data.is_student,
    gender: asString(data.gender).trim() || null,
    age: data.age === "" || data.age === undefined ? null : Number(data.age),
    onboarding_completed: data.onboardingCompleted ?? data.onboarding_completed,
    updated_at: data.updatedAt ?? data.updated_at ?? new Date().toISOString(),
  };
}

export function stripUndefined<T extends Record<string, any>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}