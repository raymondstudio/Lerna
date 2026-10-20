import { generateText } from "@/lib/gemini/client";
import type { GenerateContentResponse } from "@google/genai";
import type { ChatMessage, ChatSource } from "./types";
import { formatRagContext, retrieveMaterialContext } from "@/lib/materials/retrieval";
import { buildAIProfileContext, normalizeProfile } from "@/lib/profile";
import { selectReadyOwnedMaterialIds } from "@/lib/repositories/materials";

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

async function callGeminiAPI(prompt: string, userId?: string): Promise<{ text: string; usage: NonNullable<ChatMessage["usage"]> }> {
  try {
    const promptWithSystem = `${SYSTEM_PROMPT}\n\n${prompt}`;
    const result = await generateText(promptWithSystem, { userId, requestType: "chat" });
    const text = (result?.text ?? "").toString().trim();

    if (!text) throw new Error("The tutoring provider returned an empty response.");

    const raw = result?.raw as Partial<GenerateContentResponse> | undefined;
    const usage = raw?.usageMetadata;
    const hasProviderCounts = typeof usage?.promptTokenCount === "number" && Number.isFinite(usage.promptTokenCount)
      && typeof usage.candidatesTokenCount === "number" && Number.isFinite(usage.candidatesTokenCount);
    const promptTokens = hasProviderCounts ? usage!.promptTokenCount! : Math.ceil(promptWithSystem.length / 4);
    const candidateTokens = hasProviderCounts ? usage!.candidatesTokenCount! : Math.ceil(text.length / 4);
    const thoughtTokens = hasProviderCounts && typeof usage?.thoughtsTokenCount === "number" ? usage.thoughtsTokenCount : 0;
    const completionTokens = candidateTokens + thoughtTokens;
    const modelUsed = "gemini-2.5-flash";

    return {
      text,
      usage: {
        modelUsed,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        tokenSource: hasProviderCounts ? "provider" : "estimated",
        operationId: result.operation?.id,
        operationOutcome: result.operation?.outcome,
        estimatedCost: result.operation?.outcome === "succeeded"
          ? (promptTokens * 0.00000030) + (completionTokens * 0.00000250) : null,
      }
    };
  } catch (err) {
    throw err;
  }
}

export async function getAIResponse(
  messages: ChatMessage[],
  sessionId?: string,
  userId?: string,
  documentIds?: string[]
): Promise<ChatMessage> {
  const recentMessages = messages.slice(-8);
  const transcript = recentMessages
    .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
    .join("\n\n");

  const lastUserMessage = [...recentMessages].reverse().find((m) => m.role === "user");

  let searchPromise = Promise.resolve({ contextText: "", sources: [] as ChatSource[] });
  
  if (sessionId && userId && lastUserMessage) {
    searchPromise = (async () => {
      // Check the material scope before even a paid query reformulation. If the
      // authorization store is unavailable, no subsequent provider call is safe.
      const readyIds = await selectReadyOwnedMaterialIds(userId, documentIds);
      if (readyIds.length === 0) return { contextText: "", sources: [] as ChatSource[] };
      let searchQuery = lastUserMessage.content;
      
      // Query Reformulation if there is conversation history
      if (recentMessages.length > 1) {
        const reformulationPrompt = `Given the following conversation history and the latest student message, formulate a single, standalone search query that captures all the necessary context to search a vector database for relevant study materials. If the latest message is already a standalone question, just return it. Return ONLY the search query, with no conversational filler.
        
Conversation:
${transcript}

Standalone Query:`;
        const reformulateResult = await generateText(reformulationPrompt, { userId, requestType: "chat" });
        const text = reformulateResult?.text?.toString().trim();
        if (text) searchQuery = text;
      }

      try {
        const ragResult = await retrieveMaterialContext({
          userId,
          sessionId,
          query: searchQuery,
          documentIds,
        });
        
        if (ragResult.chunks.length > 0) {
          return {
            contextText: "\n\n=== RELEVANT CONTEXT FROM UPLOADED DOCUMENTS ===\n" + formatRagContext(ragResult.chunks),
            sources: ragResult.sources,
          };
        }
      } catch {
        throw new Error("Authorized material retrieval is unavailable. Please retry.");
      }
      return { contextText: "", sources: [] };
    })();
  }

  let profilePromise = Promise.resolve("");
  if (userId) {
    profilePromise = (async () => {
      try {
        const { createSupabaseServerClient } = await import("@/lib/supabase/server");
        const supabase = await createSupabaseServerClient();
        const [profileResult, subscriptionResult, roleResult] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).single(),
          supabase.from("subscriptions").select("plan, status, billing_cycle, subscription_status").eq("user_id", userId).single(),
          supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
        ]);

        const profile = normalizeProfile(profileResult.data, subscriptionResult.data, roleResult.data);
        return profile ? buildAIProfileContext(profile) : "";
      } catch {
        console.error("[chat] Profile context unavailable");
        return "";
      }
    })();
  }

  // Await RAG and Profile concurrently to drastically reduce latency
  const [searchResult, profileContext] = await Promise.all([searchPromise, profilePromise]);

  const prompt = `Conversation transcript:\n${transcript}${profileContext}${searchResult.contextText}`;

  const { text: aiText, usage } = await callGeminiAPI(prompt, userId);

  return {
    id: `ai-${Date.now()}`,
    role: "assistant",
    content: aiText,
    timestamp: Date.now(),
    sources: searchResult.sources,
    usage,
  };
}
