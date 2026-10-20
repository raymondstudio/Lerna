import type { SupabaseClient } from "@supabase/supabase-js";
import { savePracticeQuiz } from "@/lib/repositories/practice";
import { describe, expect, it } from "vitest";
import { validatePracticeSubmission } from "@/lib/quiz/practice-validation";
const question = { questionText: "Synthetic fixture?", options: ["One", "Two"], correctAnswer: "One", userAnswer: "One", isCorrect: true };
const submission = { title: "Private practice", score: 100, totalQuestions: 1, type: "mcq", questions: [question] };
describe("self-reported practice consistency", () => {
  it("accepts consistent private practice and preserves percentage semantics", () => {
    expect(validatePracticeSubmission(submission).score).toBe(100);
    expect(validatePracticeSubmission({ ...submission, score: 50, totalQuestions: 2, questions: [question, { ...question, userAnswer: "Two", isCorrect: false }] }).score).toBe(50);
  });
  it("rejects impossible scores/counts, forged flags and arbitrary MCQ choices", () => {
    for (const payload of [
      { ...submission, score: 200 }, { ...submission, totalQuestions: 2 }, { ...submission, score: 0 },
      { ...submission, questions: [{ ...question, userAnswer: "Two" }] },
      { ...submission, questions: [{ ...question, userAnswer: "Foreign", isCorrect: false }], score: 0 },
    ]) expect(() => validatePracticeSubmission(payload)).toThrow();
  });
  it("short answers require equality rather than accepting every nonempty string", () => {
    expect(validatePracticeSubmission({ ...submission, type: "short_answer", questions: [{ ...question, options: [], userAnswer: " one " }] }).score).toBe(100);
    expect(() => validatePracticeSubmission({ ...submission, type: "short_answer", questions: [{ ...question, options: [], userAnswer: "Anything" }] })).toThrow();
  });
  it("retains explicitly self-marked flashcard practice", () => {
    expect(validatePracticeSubmission({ ...submission, type: "flashcard", questions: [{ ...question, options: [] }] }).type).toBe("flashcard");
  });
  it("rejects excessive resources before persistence", () => {
    expect(() => validatePracticeSubmission({ ...submission, title: "x".repeat(501) })).toThrow();
    expect(() => validatePracticeSubmission({ ...submission, timeSpent: -1 })).toThrow();
  });
});

describe("practice RPC response boundaries", () => {
  it("preserves durable deleted, conflict, and capacity statuses without a false save", async () => {
    const data = validatePracticeSubmission(submission);
    for (const [code, status] of [["PT410", 410], ["PT409", 409], ["PT429", 429]] as const) {
      const client = { rpc: async () => ({ data: null, error: { code } }) } as unknown as SupabaseClient;
      await expect(savePracticeQuiz(client, data, "11111111-1111-4111-8111-111111111111")).rejects.toMatchObject({ status });
    }
    const client = { rpc: async () => ({ data: "22222222-2222-4222-8222-222222222222", error: null }) } as unknown as SupabaseClient;
    await expect(savePracticeQuiz(client, data, "11111111-1111-4111-8111-111111111111")).resolves.toBe("22222222-2222-4222-8222-222222222222");
  });
});
