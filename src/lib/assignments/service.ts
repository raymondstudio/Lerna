import { generateText } from "@/lib/ai/client";
import { extractImageText } from "@/lib/gemini/client";
import type { ExtractedQuestion, AssignmentRecord, AssignmentMessageRecord } from "@/lib/repositories/assignments";

const ANSWER_MODE_SYSTEM_PROMPT = `You are Lerna AI, an academic expert tutor solving an assignment in ANSWER MODE.
Your role:
1. Extract and solve every question and sub-question from the assignment accurately and completely. Never skip any question.
2. Present complete, simplified working sufficient for a student to verify and understand how the answer was obtained.
3. Show all key formulas, step-by-step substitutions, calculations, and clear final answers.
4. Avoid unnecessary lengthy theoretical or conversational explanations, but never return bare unexplained numbers.
5. Number solutions clearly to correspond to the original assignment (e.g., "### Question 1", "#### Part (a)").
6. Format all mathematical and scientific notation strictly using LaTeX ($...$ for inline equations, $$...$$ on its own line for block equations).
7. Emphasize final answers clearly (e.g., "**Final Answer:** $x = 42$").`;

const EXPLAIN_MODE_SYSTEM_PROMPT = `You are Lerna AI, an academic tutor solving and teaching an assignment in EXPLAIN MODE.
Your role:
1. Solve every question and sub-question thoroughly. Never skip any question.
2. Teach the underlying reasoning behind each step. Explain WHY a particular formula, theorem, or method is chosen.
3. Show explicitly how numbers are substituted into variables and calculate intermediate steps step by step.
4. Explain algebraic and calculus transformations (e.g. "Subtract 5 from both sides", "Differentiate using the product rule").
5. Break complex academic concepts into intuitive, student-friendly explanations while preserving mathematical rigor.
6. Number solutions clearly to correspond to the original assignment (e.g., "### Question 1", "#### Part (a)").
7. Format all mathematical and scientific notation strictly using LaTeX ($...$ for inline equations, $$...$$ on its own line for block equations).
8. Highlight key takeaways and emphasize final answers clearly (e.g., "**Final Answer:** $x = 42$").`;

export async function extractAssignmentFromAttachment(
  buffer: Buffer,
  mimeType: string,
  fileName?: string,
  userId?: string
): Promise<{ extractedText: string; questions: ExtractedQuestion[] }> {
  let extractedText = "";

  if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
    try {
      extractedText = await extractImageText(buffer, mimeType, fileName, {
        userId,
        requestType: "assignment_extraction",
      });
    } catch {
      extractedText = "";
    }
  } else if (mimeType === "text/plain") {
    extractedText = buffer.toString("utf8");
  }

  const questions = parseQuestionsFromExtractedText(extractedText);
  return { extractedText, questions };
}

export function parseQuestionsFromExtractedText(text: string): ExtractedQuestion[] {
  if (!text || !text.trim()) return [];

  const rawLines = text.split("\n");
  const questions: ExtractedQuestion[] = [];
  let currentQ: { id: number; question: string } | null = null;
  const questionPattern = /^(?:(?:Question|Problem|Exercise|Q\.?|P\.?)\s*(\d+)|(\d+)[.)]\s+)/i;

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(questionPattern);
    if (match) {
      if (currentQ) {
        questions.push(currentQ);
      }
      const num = parseInt(match[1] || match[2] || `${questions.length + 1}`, 10);
      currentQ = {
        id: isNaN(num) ? questions.length + 1 : num,
        question: trimmed,
      };
    } else if (currentQ) {
      currentQ.question += "\n" + trimmed;
    }
  }

  if (currentQ) {
    questions.push(currentQ);
  }

  // If no numbered questions were detected, treat the entire text as Question 1
  if (questions.length === 0 && text.trim().length > 0) {
    questions.push({
      id: 1,
      question: text.trim(),
    });
  }

  return questions;
}

export async function generateAssignmentSolution(params: {
  assignmentTitle: string;
  courseTitle?: string;
  courseCode?: string;
  mode: "answer" | "explain";
  extractedText: string;
  typedPrompt?: string;
  userId: string;
  signal?: AbortSignal;
}): Promise<string> {
  const systemPrompt = params.mode === "explain" ? EXPLAIN_MODE_SYSTEM_PROMPT : ANSWER_MODE_SYSTEM_PROMPT;
  const courseContext = params.courseCode
    ? `Course: ${params.courseCode} - ${params.courseTitle || ""}`
    : "General Course";

  let contentToSolve = "";
  if (params.extractedText.trim()) {
    contentToSolve += `### Extracted Assignment Content:\n${params.extractedText.trim()}\n\n`;
  }
  if (params.typedPrompt?.trim()) {
    contentToSolve += `### Student's Questions / Notes:\n${params.typedPrompt.trim()}\n\n`;
  }

  if (!contentToSolve.trim()) {
    contentToSolve = `Assignment Title: ${params.assignmentTitle}`;
  }

  const prompt = `Please solve the following academic assignment completely.

${courseContext}
Assignment Title: ${params.assignmentTitle}
Mode: ${params.mode.toUpperCase()} MODE

${contentToSolve}

Remember to solve every question and provide clear LaTeX-formatted mathematical steps.`;

  const result = await generateText(prompt, {
    userId: params.userId,
    requestType: "assignment_solution",
    systemPrompt,
    temperature: 0.2,
    signal: params.signal,
  });

  return result.text;
}

export async function generateFollowUpAnswer(params: {
  assignment: AssignmentRecord;
  messages: AssignmentMessageRecord[];
  userPrompt: string;
  userId: string;
  signal?: AbortSignal;
}): Promise<string> {
  const systemPrompt = params.assignment.mode === "explain" ? EXPLAIN_MODE_SYSTEM_PROMPT : ANSWER_MODE_SYSTEM_PROMPT;
  
  // Format past conversation
  let conversationHistory = "";
  const recentMessages = params.messages.slice(-8); // bounded window
  for (const msg of recentMessages) {
    const roleLabel = msg.role === "assistant" ? "Tutor" : "Student";
    conversationHistory += `${roleLabel}: ${msg.content}\n\n`;
  }

  const prompt = `You are Lerna AI assisting a student with their assignment: "${params.assignment.title}".
Mode: ${params.assignment.mode.toUpperCase()} MODE.

### Previous Conversation Context:
${conversationHistory}

### Student Follow-up Question:
${params.userPrompt}

Please address the student's question directly. Maintain the mathematical rigor, LaTeX notation, and tone of the current ${params.assignment.mode} mode.`;

  const result = await generateText(prompt, {
    userId: params.userId,
    requestType: "assignment_followup",
    systemPrompt,
    temperature: 0.3,
    signal: params.signal,
  });

  return result.text;
}
