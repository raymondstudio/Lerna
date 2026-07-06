import { generateText } from "@/lib/gemini/client";
import type { ChatMessage, ChatSource } from "./types";
import { formatRagContext, retrieveMaterialContext } from "@/lib/materials/retrieval";

const SYSTEM_PROMPT = `You are EduAgent AI, a professional AI tutor. When responding, do the following:
- Act as a knowledgeable and patient tutor.
- Explain step-by-step with clear examples when appropriate.
- Simplify complex concepts and use analogies.
- Ask one or two relevant follow-up questions to gauge understanding.
- Keep answers concise but thorough and show worked examples when helpful.
- Use uploaded materials whenever relevant.
- If the answer exists in uploaded documents, prioritize those sources.
- If uploaded materials are not relevant or unavailable, use general educational knowledge.

Respond in a supportive, encouraging tone suitable for learners.`;

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
      const { data: profile } = (await supabase
        .from("profiles")
        .select(`
          account_type, 
          institution, 
          department, 
          study_level, 
          country,
          onboarding_completed,
          institutions (
            name,
            short_name,
            institution_type,
            state,
            country
          ),
          user_preferences (
            learning_goals,
            teaching_style,
            preferred_quiz_format
          )
        `)
        .eq("id", userId)
        .single()) as any;

      if (profile && profile.onboarding_completed) {
        const prefs = Array.isArray(profile.user_preferences)
          ? profile.user_preferences[0]
          : profile.user_preferences;

        const goals = prefs?.learning_goals || [];
        const tStyle = prefs?.teaching_style || "Intermediate";
        const qFormat = prefs?.preferred_quiz_format || "Mixed";

        const instInfo = profile.institutions || {
          name: profile.institution,
          institution_type: "N/A",
          state: "N/A",
          country: profile.country
        };

        profileContext = `\n\n=== STUDENT PROFILE (TAILOR EXPLANATIONS TO THESE DETAILS) ===
- Role / Account Type: ${profile.account_type || "N/A"}
- Current Institution: ${instInfo.name || "N/A"}
- Institution Type: ${instInfo.institution_type || "N/A"}
- Department: ${profile.department || "N/A"}
- Current Level: ${profile.study_level || "N/A"}
- Country: ${instInfo.country || profile.country || "N/A"}
- Learning Goals: ${Array.isArray(goals) ? goals.join(", ") : "N/A"}
- Preferred Difficulty/Style: ${tStyle}
- Preferred Question Format: ${qFormat}`;
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
