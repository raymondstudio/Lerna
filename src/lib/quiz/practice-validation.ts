import { z } from "zod";
import { MaterialBoundaryError } from "@/lib/uploads/validation";
const id = z.string().uuid().nullable().optional();
const text = (max: number) => z.string().trim().min(1).max(max);
const questionSchema = z.object({
  questionText: text(10_000), options: z.array(text(2000)).max(8).default([]),
  correctAnswer: text(5000), explanation: z.string().max(10_000).optional(),
  userAnswer: z.string().max(5000).nullable().optional(), isCorrect: z.boolean(),
});
const schema = z.object({
  courseId: id, materialId: id, title: text(500), score: z.number().int().min(0).max(100),
  totalQuestions: z.number().int().min(1).max(100), type: z.enum(["mcq", "flashcard", "short_answer"]).default("mcq"),
  timeSpent: z.number().int().min(0).max(86_400).nullable().optional(),
  difficulty: text(80).default("Medium"), topic: text(240).default("General"),
  questions: z.array(questionSchema).min(1).max(100),
});
export type PracticeSubmission = z.infer<typeof schema>;
export function validatePracticeSubmission(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new MaterialBoundaryError("Quiz results contain invalid or oversized fields.");
  const data = parsed.data;
  if (data.totalQuestions !== data.questions.length) throw new MaterialBoundaryError("Question count does not match the submitted answers.");
  let correct = 0;
  for (const question of data.questions) {
    if (data.type === "mcq" && (question.options.length < 2 || new Set(question.options).size !== question.options.length
      || !question.options.includes(question.correctAnswer) || (question.userAnswer && !question.options.includes(question.userAnswer)))) {
      throw new MaterialBoundaryError("Quiz options or answers are inconsistent.");
    }
    const derived = data.type === "flashcard" ? question.isCorrect : data.type === "short_answer"
      ? (question.userAnswer ?? "").trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()
      : question.userAnswer === question.correctAnswer;
    if (question.isCorrect !== derived) throw new MaterialBoundaryError("Question correctness does not match the submitted answer.");
    if (derived) correct++;
  }
  const percentage = Math.round(correct / data.totalQuestions * 100);
  if (data.score !== percentage) throw new MaterialBoundaryError("Quiz score does not match the submitted answers.");
  return { ...data, score: percentage };
}
