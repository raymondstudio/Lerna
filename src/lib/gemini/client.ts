import { GoogleGenAI } from "@google/genai";
import { env } from "../env";
import { emitAnalyticsEvent } from "@/lib/analytics/events";

type GenerateResult = {
  text: string;
  raw: unknown;
};

export type EmbeddingTaskType =
  | "RETRIEVAL_DOCUMENT"
  | "RETRIEVAL_QUERY";

const GENERATIVE_MODEL = "gemini-2.5-flash";
const EMBEDDING_MODEL = "gemini-embedding-001";

export const EMBEDDING_DIMENSIONS = 768;

let aiClient: GoogleGenAI | null = null;
let mockModeNotified = false;

function getApiKey(): string {
  return env.GEMINI_API_KEY || env.NEXT_PUBLIC_GEMINI_API_KEY || "";
}

function isKeyValid(): boolean {
  const key = getApiKey();
  return typeof key === "string" && key.trim().length > 0;
}

function notifyMockMode() {
  if (!mockModeNotified) {
    console.info("[Gemini Client] Simulated mock mode enabled. Make sure to set GEMINI_API_KEY starting with 'AIzaSy' in .env for live AI responses.");
    mockModeNotified = true;
  }
}

function getClient(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: getApiKey(),
    });
  }

  return aiClient;
}

const MOCK_ANSWERS: Record<string, string> = {
  "quantum computing": "Quantum computing is a type of computing that uses quantum mechanics (like superposition and entanglement) to process information. While classical computers use bits (0s and 1s), quantum computers use qubits, which can exist in multiple states at once. This allows them to solve complex calculations, like drug discovery or cryptography, exponentially faster.",
  "active and passive transport": "Active transport requires cellular energy (ATP) to move molecules against their concentration gradient (from low to high concentration), like the sodium-potassium pump. Passive transport, however, requires no energy as molecules move along their gradient (from high to low concentration), such as simple diffusion or osmosis.",
  "recursive programming": "Recursive programming is a method where a function calls itself to solve a smaller instance of the same problem. Think of it like a set of nesting Russian dolls: to reach the smallest doll, you must open each larger doll one by one, with a 'base case' that tells the function when to stop opening dolls and return the result.",
  "dna replicate": "DNA replication is the process by which a double-stranded DNA molecule is copied to produce two identical DNA molecules. It occurs in three main steps: unwinding of the double helix by helicase, complementary base pairing by DNA polymerase, and joining of the sugar-phosphate backbone by ligase.",
  "default": "That's an excellent study question! In academic terms, this concept focuses on how structured inputs adapt to dynamic environments. To master this topic, try breaking it down into its core components: define the primary terms, map out their relationships, and look for real-world examples of this system in action."
};

function generateQuestionsFromText(text: string, count: number): any[] {
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 40 && s.length < 200);

  const questions: any[] = [];
  const countToGen = Math.min(count, sentences.length);

  const words = text
    .split(/\s+/)
    .map(w => w.replace(/[^a-zA-Z]/g, "").trim())
    .filter(w => w.length > 5 && !["about", "which", "their", "there", "would", "other", "should", "could"].includes(w.toLowerCase()));
  
  const uniqueWords = Array.from(new Set(words));

  for (let i = 0; i < countToGen; i++) {
    const sentence = sentences[i];
    const sentenceWords = sentence.split(/\s+/).map(w => w.replace(/[^a-zA-Z]/g, "")).filter(w => w.length > 5);
    if (sentenceWords.length === 0) continue;
    
    const keyword = sentenceWords.reduce((a, b) => a.length > b.length ? a : b);
    const questionText = sentence.replace(new RegExp(`\\b${keyword}\\b`, 'i'), "_______");
    const correctOption = keyword;
    const distractors = uniqueWords
      .filter(w => w.toLowerCase() !== keyword.toLowerCase())
      .slice(0, 3);
    
    while (distractors.length < 3) {
      distractors.push(`Concept ${distractors.length + 1}`);
    }
    
    const options = [correctOption, ...distractors].sort(() => Math.random() - 0.5);

    questions.push({
      question: `Complete the sentence: "${questionText}"`,
      options: options,
      correct_answer: correctOption,
      explanation: `Based on the context: "${sentence}"`
    });
  }

  return questions;
}

function getMockAnswer(prompt: string): string {
  const normalized = prompt.toLowerCase();
  
  if (normalized.includes("quiz generator") || normalized.includes("json") || normalized.includes("correct_answer")) {
    const countMatch = prompt.match(/generate exactly (\d+)/i) || prompt.match(/count = (\d+)/i) || prompt.match(/(\d+) questions/i);
    const count = countMatch ? parseInt(countMatch[1]) : 5;
    
    let textContent = "";
    const docIndex = normalized.indexOf("document context:");
    if (docIndex !== -1) {
      textContent = prompt.slice(docIndex + "document context:".length).trim();
    } else {
      const courseIndex = normalized.indexOf("course:");
      if (courseIndex !== -1) {
        textContent = prompt.slice(courseIndex + "course:".length).trim();
      }
    }
    
    let quizQuestions: any[] = [];
    if (textContent.length > 100) {
      quizQuestions = generateQuestionsFromText(textContent, count);
    }
    
    if (quizQuestions.length < count) {
      const generalMock = [
        {
          question: "What is the primary role of active learning in studying?",
          options: ["Passive reading", "Retrieval practice and self-testing", "Highlighting everything", "Listening to lectures only"],
          correct_answer: "Retrieval practice and self-testing",
          explanation: "Active recall forces the brain to retrieve information, strengthening neural pathways."
        },
        {
          question: "Which of these is a key component of the Pomodoro technique?",
          options: ["Study for 5 hours straight", "Take 25-minute breaks", "Work in focused 25-minute intervals", "No breaks allowed"],
          correct_answer: "Work in focused 25-minute intervals",
          explanation: "The Pomodoro technique uses structured intervals (25 mins work, 5 mins break) to maximize focus."
        },
        {
          question: "What does spaced repetition help prevent?",
          options: ["Overstudying", "The forgetting curve", "High exam scores", "Sleep deprivation"],
          correct_answer: "The forgetting curve",
          explanation: "Reviewing material at increasing intervals flattens the forgetting curve, retaining knowledge long-term."
        },
        {
          question: "When taking notes, what is the Cornell method known for?",
          options: ["Using mind maps", "Dividing pages into notes, cues, and summary", "Writing down everything verbatim", "Recording audio only"],
          correct_answer: "Dividing pages into notes, cues, and summary",
          explanation: "The Cornell method uses a systematic format for organizing notes into structured sections."
        },
        {
          question: "What type of memory is strengthened by worked examples?",
          options: ["Short-term memory", "Procedural and conceptual schema", "Sensory memory", "Echoic memory"],
          correct_answer: "Procedural and conceptual schema",
          explanation: "Worked examples demonstrate step-by-step problem solving, building structural understanding."
        }
      ];
      
      while (quizQuestions.length < count) {
        const fallbackQ = generalMock[quizQuestions.length % generalMock.length];
        quizQuestions.push({
          ...fallbackQ,
          question: quizQuestions.length === 0 ? fallbackQ.question : `${fallbackQ.question} (Q${quizQuestions.length + 1})`
        });
      }
    }
    
    return JSON.stringify({ questions: quizQuestions.slice(0, count) });
  }

  // Extract actual user query from transcript to prevent fallback topics like 'Mixed' or 'vacuum'
  let userQuery = prompt;
  
  // Try matching last Student message
  const studentMatches = Array.from(prompt.matchAll(/Student:\s*([^\n]+)/gi));
  if (studentMatches.length > 0) {
    userQuery = studentMatches[studentMatches.length - 1][1].trim();
  } else {
    // If it's a study session summary context or other formats, extract the topic/course
    const courseMatch = prompt.match(/course:\s*([^\n]+)/i);
    if (courseMatch) {
      userQuery = courseMatch[1].trim();
    }
  }

  const normalizedQuery = userQuery.toLowerCase();
  for (const key of Object.keys(MOCK_ANSWERS)) {
    if (key !== "default" && normalizedQuery.includes(key)) {
      return `⚠️ [Offline Simulated Mode - Gemini Key Not Loaded]\n\n` + MOCK_ANSWERS[key];
    }
  }

  const cleanPrompt = userQuery.replace(/[^a-zA-Z0-9\s]/g, "");
  const words = cleanPrompt.split(/\s+/).filter(w => w.length > 4);
  const subject = words.length > 0 ? words[words.length - 1] : "this topic";

  const warningLabel = "⚠️ [Offline Simulated Mode - Gemini Key Not Loaded]\n\n";

  return warningLabel + 
         `Here is a structured explanation about **${subject}** to help you study:\n\n` +
         `### 1. Core Overview\n` +
         `When analyzing **${subject}**, it is important to first understand its foundational principles. It represents a structured approach to solving academic problems by breaking them down into manageable sub-components.\n\n` +
         `### 2. Key Concepts\n` +
         `- **Integration**: Combining multiple elements of ${subject} to form a cohesive system.\n` +
         `- **Optimization**: Refining the processes involved to improve learning efficiency and accuracy.\n` +
         `- **Contextual Application**: Applying these concepts in real-world exercises and quizzes.\n\n` +
         `### 3. Practice Question\n` +
         `To test your understanding, consider this question: *How does the primary function of ${subject} change when operating in a dynamic environment?*\n\n` +
         `Feel free to ask me to explain any of these points in more detail, or try generating a quiz on this!`;
}

function getMockEmbedding(text: string): number[] {
  const vector = new Array(EMBEDDING_DIMENSIONS).fill(0);
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    const charCode = text.charCodeAt(i % text.length) || 0;
    vector[i] = Math.sin(charCode + i) * 0.1;
  }
  return vector;
}

function isMockingNeeded(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes("api key") ||
    msg.includes("api_key") ||
    msg.includes("invalid_argument") ||
    msg.includes("missing gemini_api_key") ||
    msg.includes("unauthorized") ||
    msg.includes("forbidden") ||
    msg.includes("auth")
  );
}

export async function generateText(
  prompt: string,
  options?: { userId?: string; requestType?: string }
): Promise<GenerateResult> {
  if (!isKeyValid()) {
    notifyMockMode();
    const mockText = getMockAnswer(prompt);
    const mockPromptTokens = Math.ceil(prompt.length / 4);
    const mockCompletionTokens = Math.ceil(mockText.length / 4);
    void emitAnalyticsEvent(
      options?.userId,
      "ai_request_completed",
      {
        promptTokens: mockPromptTokens,
        completionTokens: mockCompletionTokens,
        modelUsed: GENERATIVE_MODEL,
        requestType: options?.requestType || "chat",
      }
    );
    return {
      text: mockText,
      raw: { mock: true },
    };
  }

  try {
    const response = await getClient().models.generateContent({
      model: GENERATIVE_MODEL,
      contents: prompt,
    });

    const text = response.text;

    if (!text || text.trim() === "") {
      console.error("[Gemini Error] Response text is empty", {
        rawResponse: response,
      });

      throw new Error(
        "Gemini API returned empty response. Check API key and rate limits."
      );
    }

    const promptTokens = response.usageMetadata?.promptTokenCount || Math.ceil(prompt.length / 4);
    const completionTokens = response.usageMetadata?.candidatesTokenCount || Math.ceil(text.length / 4);

    void emitAnalyticsEvent(
      options?.userId,
      "ai_request_completed",
      {
        promptTokens,
        completionTokens,
        modelUsed: GENERATIVE_MODEL,
        requestType: options?.requestType || "chat",
      }
    );

    return {
      text,
      raw: response,
    };
  } catch (error) {
    console.error("[Gemini Client] Real API request failed. Error Details:", error);
    if (isMockingNeeded(error)) {
      notifyMockMode();
      const mockText = getMockAnswer(prompt);
      const mockPromptTokens = Math.ceil(prompt.length / 4);
      const mockCompletionTokens = Math.ceil(mockText.length / 4);
      void emitAnalyticsEvent(
        options?.userId,
        "ai_request_completed",
        {
          promptTokens: mockPromptTokens,
          completionTokens: mockCompletionTokens,
          modelUsed: GENERATIVE_MODEL,
          requestType: options?.requestType || "chat",
        }
      );
      return {
        text: mockText,
        raw: { mock: true },
      };
    }

    const errorMessage =
      error instanceof Error ? error.message : String(error);

    console.error("[Gemini Error] generateText failed", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    void emitAnalyticsEvent(
      options?.userId,
      "ai_request_failed",
      {
        promptTokens: Math.ceil(prompt.length / 4),
        modelUsed: GENERATIVE_MODEL,
        requestType: options?.requestType || "chat",
        errorMessage,
      }
    );

    throw new Error(`Gemini API error: ${errorMessage}`);
  }
}

export async function generateEmbedding(
  text: string,
  taskType: EmbeddingTaskType = "RETRIEVAL_DOCUMENT",
  options?: { userId?: string }
): Promise<number[]> {
  if (!isKeyValid()) {
    notifyMockMode();
    const mockEmb = getMockEmbedding(text);
    void emitAnalyticsEvent(
      options?.userId,
      "ai_request_completed",
      {
        promptTokens: Math.ceil(text.length / 4),
        completionTokens: 0,
        modelUsed: EMBEDDING_MODEL,
        requestType: "embedding",
      }
    );
    return mockEmb;
  }

  try {
    const response = await getClient().models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: {
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS,
      },
    });

    const embedding = response.embeddings?.[0]?.values;

    if (!embedding || embedding.length === 0) {
      throw new Error("Empty embedding returned by Gemini.");
    }

    const promptTokens = Math.ceil(text.length / 4);
    void emitAnalyticsEvent(
      options?.userId,
      "ai_request_completed",
      {
        promptTokens,
        completionTokens: 0,
        modelUsed: EMBEDDING_MODEL,
        requestType: "embedding",
      }
    );

    return embedding;
  } catch (error) {
    console.error("[Gemini Client] Real Embedding request failed. Error Details:", error);
    if (isMockingNeeded(error)) {
      notifyMockMode();
      const mockEmb = getMockEmbedding(text);
      void emitAnalyticsEvent(
        options?.userId,
        "ai_request_completed",
        {
          promptTokens: Math.ceil(text.length / 4),
          completionTokens: 0,
          modelUsed: EMBEDDING_MODEL,
          requestType: "embedding",
        }
      );
      return mockEmb;
    }

    const errorMessage =
      error instanceof Error ? error.message : String(error);

    console.error("[Gemini Error] generateEmbedding failed", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    void emitAnalyticsEvent(
      options?.userId,
      "ai_request_failed",
      {
        promptTokens: Math.ceil(text.length / 4),
        modelUsed: EMBEDDING_MODEL,
        requestType: "embedding",
        errorMessage,
      }
    );

    throw new Error(`Gemini Embedding error: ${errorMessage}`);
  }
}

export async function extractImageText(
  buffer: Buffer,
  mimeType: string,
  fileName?: string,
  options?: { userId?: string }
): Promise<string> {
  if (!isKeyValid()) {
    notifyMockMode();
    const mockText = `[Mock OCR Result: Extracted text from ${fileName || "image"}. Let's study this material together!]`;
    void emitAnalyticsEvent(
      options?.userId,
      "ai_request_completed",
      {
        promptTokens: 100,
        completionTokens: Math.ceil(mockText.length / 4),
        modelUsed: GENERATIVE_MODEL,
        requestType: "ocr",
      }
    );
    return mockText;
  }

  try {
    const base64Data = buffer.toString("base64");
    const response = await getClient().models.generateContent({
      model: GENERATIVE_MODEL,
      contents: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        {
          text: "Extract and transcribe all readable text from this image exactly as it appears. Do not add any extra commentary or explanations, just the extracted text.",
        },
      ],
    });

    const text = response.text || "";
    const promptTokens = response.usageMetadata?.promptTokenCount || 200;
    const completionTokens = response.usageMetadata?.candidatesTokenCount || Math.ceil(text.length / 4);

    void emitAnalyticsEvent(
      options?.userId,
      "ai_request_completed",
      {
        promptTokens,
        completionTokens,
        modelUsed: GENERATIVE_MODEL,
        requestType: "ocr",
      }
    );

    return text;
  } catch (error) {
    if (isMockingNeeded(error)) {
      notifyMockMode();
      const mockText = `[Mock OCR Result: Extracted text from ${fileName || "image"}. Let's study this material together!]`;
      void emitAnalyticsEvent(
        options?.userId,
        "ai_request_completed",
        {
          promptTokens: 100,
          completionTokens: Math.ceil(mockText.length / 4),
          modelUsed: GENERATIVE_MODEL,
          requestType: "ocr",
        }
      );
      return mockText;
    }

    const errorMessage =
      error instanceof Error ? error.message : String(error);

    console.error("[Gemini Error] extractImageText failed", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    void emitAnalyticsEvent(
      options?.userId,
      "ai_request_failed",
      {
        promptTokens: 200,
        modelUsed: GENERATIVE_MODEL,
        requestType: "ocr",
        errorMessage,
      }
    );

    throw new Error(`Gemini Image Extraction error: ${errorMessage}`);
  }
}