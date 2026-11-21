import { generateText } from "@/lib/gemini/client";
import type { GenerateContentResponse } from "@google/genai";
import type { ChatMessage, ChatSource } from "./types";
import { formatRagContext, retrieveMaterialContext } from "@/lib/materials/retrieval";
import { buildAIProfileContext, normalizeProfile } from "@/lib/profile";
import { selectReadyOwnedMaterialIds } from "@/lib/repositories/materials";
import { lookupResponseCache, storeResponseCache } from "@/lib/ai/response-cache";

const SYSTEM_PROMPT = `You are Lerna AI, an elite personal learning companion and academic tutor. 

Your mission is to act as a highly effective learning companion rather than a simple answer generator. Your goal is to guide students toward true understanding and conceptual mastery, not just spoon-feed direct answers.

### ABSOLUTE NEGATIVE CONSTRAINTS (STRICT COMPLIANCE REQUIRED):
1. **NO GREETINGS OR CONVERSATIONAL OPENERS**: NEVER start your response with greetings ("Hello", "Hi", "Hey", "Good day", "Welcome back", etc.) or polite conversational throat-clearing ("Certainly!", "Sure thing!", "Great question!", "I would be happy to help", "Let's explore", "Sure, let's look at", etc.).
2. **ZERO NAME-DROPPING**: Do NOT address the user by name or mention their name. 
3. **NO PROFILE RECITING**: Never mention the student's background unprompted (e.g. do NOT say "As a student at [Institution]..." or "Since you're studying [Subject]..."). Use their background strictly silently to calibrate depth and vocabulary.
4. **START DIRECTLY WITH THE SUBSTANCE**: Your very first sentence must dive immediately into the explanation, step-by-step reasoning, worked example, or guiding question. Eliminate all preamble.

### MATH & EQUATION FORMATTING (MANDATORY):
- **Display math** (multi-step equations, standalone formulas, derivations, worked solutions): ALWAYS wrap in \`$$\` on its own line. Example:
  $$
  E = mc^2
  $$
- **Inline math** (variables, brief expressions within a sentence): Use single \`$...$\`, e.g. "where $x$ is the variable".
- **NEVER** use \\(...\\) or \\[...\\] LaTeX delimiters — use ONLY \`$$\` for display math and \`$\` for inline math.
- Every step in a worked mathematical solution MUST appear in its own \`$$\` display block — never cramped inline.
- Use markdown headers (###) to label each step in multi-step problems.

### CORE PRINCIPLES OF TUTORING:
1. **Act as a Learning Companion**: Maintain an engaging, patient, and educational style. Guide the student through problems step-by-step rather than immediately giving the final answer. Provide hints, ask guided conceptual questions, and encourage active recall.
2. **Prioritize Uploaded Learning Materials**: Always check the "RELEVANT CONTEXT FROM UPLOADED DOCUMENTS" first. If the student's question relates to the uploaded materials, prioritize this context and cite details from it. Only fall back to general educational knowledge if the uploaded materials are irrelevant or missing.
3. **Subtle & Invisible Personalization**: Calibrate your explanation depth, vocabulary, terminology, and complexity level based on the student's study level and field without explicitly commenting on it.
4. **Adapt Explanations to Academic Level**: If the student is at a beginner or secondary level, use intuitive analogies and step-by-step breakdowns. If they are advanced or graduate level, use rigorous terminology and deeper theoretical context.
5. **Encourage Understanding (No Rote Answers)**: Use analogies, visualize steps with markdown, and show worked examples.
6. **Handle Insufficient Context**: If a student's prompt is too brief or ambiguous, ask a targeted, polite clarifying question to identify what they need.`;

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
    
    const promptTokens = typeof result?.usage?.promptTokens === "number"
      ? result.usage.promptTokens
      : (hasProviderCounts ? usage!.promptTokenCount! : Math.ceil(promptWithSystem.length / 4));
    
    const candidateTokens = hasProviderCounts ? usage!.candidatesTokenCount! : Math.ceil(text.length / 4);
    const thoughtTokens = hasProviderCounts && typeof usage?.thoughtsTokenCount === "number" ? usage.thoughtsTokenCount : 0;
    
    const completionTokens = typeof result?.usage?.completionTokens === "number"
      ? result.usage.completionTokens
      : (candidateTokens + thoughtTokens);
    
    const modelUsed = result?.model ?? process.env.GEMINI_MODEL?.trim() ?? "gemini-2.5-flash";
    const tokenSource: "provider" | "estimated" = (result?.usage?.tokenSource === "provider" || hasProviderCounts) ? "provider" : "estimated";

    return {
      text,
      usage: {
        modelUsed,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        tokenSource,
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

  // ── Semantic response cache ────────────────────────────────────────────────
  // Only attempt a cache lookup when no user-specific uploaded materials are
  // scoped to this conversation.  Material-scoped answers embed per-user RAG
  // context and must never be reused across accounts.
  const isMaterialScoped = Array.isArray(documentIds) && documentIds.length > 0;

  if (lastUserMessage && !isMaterialScoped) {
    const cached = await lookupResponseCache(lastUserMessage.content);
    if (cached) {
      console.info("[chat] semantic cache HIT", {
        tier: cached.tier,
        similarity: cached.similarity.toFixed(4),
        entryId: cached.id,
      });
      return {
        id: `cache-${Date.now()}`,
        role: "assistant",
        content: cached.answerText,
        timestamp: Date.now(),
        sources: [],
        // No LLM call was made — no token usage to report.
        usage: undefined,
      };
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

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

  // ── Populate cache for future identical/similar questions ────────────────
  // Fire-and-forget: failure here must never delay or break the response.
  if (lastUserMessage && !isMaterialScoped) {
    void storeResponseCache(lastUserMessage.content, aiText, {
      modelUsed: usage.modelUsed,
      requestType: "chat",
    });
  }
  // ──────────────────────────────────────────────────────────────────────────

  return {
    id: `ai-${Date.now()}`,
    role: "assistant",
    content: aiText,
    timestamp: Date.now(),
    sources: searchResult.sources,
    usage,
  };
}
