import { generateText } from "@/lib/gemini/client";
import type { ChatMessage, ChatSource } from "./types";
import { formatRagContext, retrieveMaterialContext } from "@/lib/materials/retrieval";
import { normalizeProfile } from "@/lib/profile";

const SYSTEM_PROMPT = `You are Lerna AI, an elite personal learning companion and academic tutor. 

Your mission is to act as a highly effective learning companion rather than a simple answer generator. Your goal is to guide students toward true understanding and conceptual mastery, not just spoon-feed direct answers.

### CORE PRINCIPLES OF TUTORING:
1. **Act as a Learning Companion**: Maintain a natural, conversational, patient, and highly encouraging style. Guide the student through problems step-by-step rather than immediately giving the final answer. Provide hints, ask guided conceptual questions, and encourage active recall.
2. **Prioritize Uploaded Learning Materials**: Always check the "RELEVANT CONTEXT FROM UPLOADED DOCUMENTS" first. If the student's question relates to the uploaded materials, prioritize this context and cite details from it. Only fall back to general educational knowledge if the uploaded materials are irrelevant or missing.
3. **Subtle & Invisible Personalization**: You will receive the student's profile context (institution, department, academic level, learning preferences). Use this stored memory *subtly* to adapt your explanation depth, vocabulary, terminology, and complexity level. 
   - **CRITICAL CONSTRAINT**: Never over-personalize or make awkward, explicit references to the student's profile details (e.g., do NOT start responses with "Since you are a student at [Institution]" or "As a [Level] computer science major..."). Only mention their profile details if it is directly and genuinely relevant to answering their question (e.g., if they ask about campus policies or specific courses).
4. **Adapt Explanations to Academic Level**: If the student is at a "100 Level" or "Secondary School", use simplified analogies and step-by-step breakdowns. If they are a "Graduate", "Masters", or "PhD" student, use advanced terminology, rigorous mathematical/scientific explanations, and deep theoretical context.
5. **Encourage Understanding (No Rote Answers)**: Use analogies, visualize steps with text/markdown, and show worked examples. When explaining a complex concept, break it down into core logical steps.
6. **Institution-Appropriate Assessments**: If the student asks for a practice quiz, test, or essay question, generate questions and assessments that align with their university level, department, and preferences.
7. **Handle Insufficient Context**: If a student's prompt is too brief, ambiguous, or lacks context, do not make wild assumptions. Ask brief, polite, clarifying questions to target their specific learning needs.`;

async function callGeminiAPI(prompt: string, userId?: string): Promise<{ text: string; usage: any }> {
  try {
    const promptWithSystem = `${SYSTEM_PROMPT}\n\n${prompt}`;
    const result = await generateText(promptWithSystem, { userId, requestType: "chat" });
    const text = (result?.text ?? "").toString().trim();

    if (!text) {
      console.error("[chat] Gemini returned empty payload", { raw: result?.raw });
      return {
        text: "Sorry, the tutoring service did not return a response. Please try again.",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, modelUsed: "gemini-2.5-flash", estimatedCost: 0 }
      };
    }

    const raw: any = result?.raw;
    const promptTokens = raw?.usageMetadata?.promptTokenCount || Math.ceil(promptWithSystem.length / 4);
    const completionTokens = raw?.usageMetadata?.candidatesTokenCount || Math.ceil(text.length / 4);
    const modelUsed = "gemini-2.5-flash";

    return {
      text,
      usage: {
        modelUsed,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimatedCost: (promptTokens * 0.000000075) + (completionTokens * 0.00000030)
      }
    };
  } catch (err) {
    const errorDetails = err instanceof Error ? err.message : String(err);
    console.error("[chat] callGeminiAPI error", {
      error: errorDetails,
      timestamp: new Date().toISOString(),
    });
    return {
      text: `Sorry, the tutoring service encountered an error: ${errorDetails}. Please check your API key and try again.`,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, modelUsed: "gemini-2.5-flash", estimatedCost: 0 }
    };
  }
}

export async function getAIResponse(
  messages: ChatMessage[],
  sessionId?: string,
  userId?: string,
  documentIds?: string[]
): Promise<ChatMessage> {
  // Keep recent context compact for predictable latency and token usage.
  const recentMessages = messages.slice(-8);
  const transcript = recentMessages
    .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
    .join("\n\n");

  let contextText = "";
  let sources: ChatSource[] = [];

  if (sessionId && userId) {
    const lastUserMessage = [...recentMessages].reverse().find((m) => m.role === "user");
    if (lastUserMessage) {
      try {
        const ragResult = await retrieveMaterialContext({
          userId,
          sessionId,
          query: lastUserMessage.content,
          documentIds,
        });
        if (ragResult.chunks.length > 0) {
          contextText = "\n\n=== RELEVANT CONTEXT FROM UPLOADED DOCUMENTS ===\n" + formatRagContext(ragResult.chunks);
          sources = ragResult.sources;
        }
      } catch (e) {
        console.error("[chat] RAG retrieval error:", e);
      }
    }
  }
  let profileContext = "";
  if (userId) {
    try {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();
      const [profileResult, subscriptionResult, roleResult] = await Promise.all([
        supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single(),
        supabase.from("subscriptions").select("plan, status, billing_cycle, subscription_status").eq("user_id", userId).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      ]);

      const profile = normalizeProfile(profileResult.data, subscriptionResult.data, roleResult.data);

      if (profile?.onboardingCompleted) {
        const goals = profile.studyGoals || [];
        const preferenceSummary = [
          profile.teachingStyle,
          profile.preferredQuizFormat,
          profile.preferredLanguage,
          profile.preferredQuestionType,
        ].filter(Boolean).join(", ");

        profileContext = `\n\n=== USER MEMORY ===
- Name: ${profile.displayName || `${profile.firstName} ${profile.lastName}`.trim() || "N/A"}
- Role / Account Type: ${profile.accountType || "N/A"}
- Institution: ${profile.institution || "N/A"}
- Department: ${profile.department || profile.field || "N/A"}
- Level: ${profile.studyLevel || "N/A"}
- Country: ${profile.country || "N/A"}
- Goals: ${Array.isArray(goals) ? goals.join(", ") : "N/A"}
- Preferences: ${preferenceSummary || "N/A"}`;
      }
    } catch (err) {
      console.error("[chat] Failed to fetch profile context for prompt personalization:", err);
    }
  }

  const prompt = `Conversation transcript:\n${transcript}${profileContext}${contextText}`;

  const { text: aiText, usage } = await callGeminiAPI(prompt, userId);

  return {
    id: `ai-${Date.now()}`,
    role: "assistant",
    content: aiText,
    timestamp: Date.now(),
    sources,
    usage,
  };
}
