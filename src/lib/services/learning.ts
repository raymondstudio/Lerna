import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getUserPreferences(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("teaching_style,difficulty,preferred_language,preferred_quiz_format,flashcard_preference,response_length,voice_preference,study_goals")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return {
      teachingStyle: "Intermediate",
      difficulty: "Medium",
      preferredLanguage: "English",
      preferredQuizFormat: "Mixed",
      flashcardPreference: "Standard",
      responseLength: "Medium",
      voicePreference: "Default",
      learningGoals: [],
    };
  }

  return {
    teachingStyle: data.teaching_style,
    difficulty: data.difficulty,
    preferredLanguage: data.preferred_language,
    preferredQuizFormat: data.preferred_quiz_format,
    flashcardPreference: data.flashcard_preference,
    responseLength: data.response_length,
    voicePreference: data.voice_preference,
    learningGoals: data.study_goals || [],
  };
}
