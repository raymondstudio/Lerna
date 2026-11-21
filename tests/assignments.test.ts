import { describe, expect, it } from "vitest";
import {
  parseQuestionsFromExtractedText,
  generateAssignmentSolution,
  generateFollowUpAnswer,
} from "@/lib/assignments/service";
import {
  assertAssignmentId,
  mapAssignmentRow,
  AssignmentApiError,
} from "@/lib/repositories/assignments";

describe("Assignments Service & Parser", () => {
  it("parses numbered questions correctly from OCR text", () => {
    const sampleText = `
1. Calculate the determinant of the 2x2 matrix [[3, 5], [2, 4]].
2. Find the roots of the quadratic equation: x^2 - 7x + 10 = 0.
Question 3: A particle moves with velocity v(t) = 3t^2 - 4t. Determine its displacement.
    `.trim();

    const questions = parseQuestionsFromExtractedText(sampleText);
    expect(questions.length).toBe(3);
    expect(questions[0].id).toBe(1);
    expect(questions[0].question).toContain("Calculate the determinant");
    expect(questions[1].id).toBe(2);
    expect(questions[1].question).toContain("Find the roots");
    expect(questions[2].id).toBe(3);
    expect(questions[2].question).toContain("A particle moves");
  });

  it("handles unnumbered assignment text as Question 1", () => {
    const raw = "Prove that the square root of 2 is irrational.";
    const questions = parseQuestionsFromExtractedText(raw);
    expect(questions.length).toBe(1);
    expect(questions[0].id).toBe(1);
    expect(questions[0].question).toBe(raw);
  });

  it("returns empty array for empty or blank text", () => {
    expect(parseQuestionsFromExtractedText("")).toEqual([]);
    expect(parseQuestionsFromExtractedText("   \n\n  ")).toEqual([]);
  });

  it("assertAssignmentId validates UUID format and throws AssignmentApiError on invalid input", () => {
    expect(() => assertAssignmentId("11111111-2222-3333-4444-555555555555")).not.toThrow();
    expect(() => assertAssignmentId("invalid-id")).toThrow(AssignmentApiError);
    expect(() => assertAssignmentId("")).toThrow(AssignmentApiError);
    expect(() => assertAssignmentId(null)).toThrow(AssignmentApiError);
  });

  it("maps database row snake_case to AssignmentRecord camelCase", () => {
    const row = {
      id: "11111111-2222-3333-4444-555555555555",
      user_id: "user-123",
      course_id: "course-456",
      title: "Homework 1",
      description: "Math set",
      mode: "explain" as const,
      status: "completed" as const,
      extracted_questions: [{ id: 1, question: "Find x" }],
      share_token: "tok-abc-1234567890",
      is_public: true,
      created_at: "2026-11-21T00:00:00Z",
      updated_at: "2026-11-21T01:00:00Z",
      courses: { code: "MTH101", title: "Calculus" },
    };

    const record = mapAssignmentRow(row);
    expect(record.id).toBe(row.id);
    expect(record.userId).toBe(row.user_id);
    expect(record.courseId).toBe(row.course_id);
    expect(record.title).toBe(row.title);
    expect(record.mode).toBe("explain");
    expect(record.status).toBe("completed");
    expect(record.extractedQuestions).toEqual([{ id: 1, question: "Find x" }]);
    expect(record.isPublic).toBe(true);
    expect(record.courses?.code).toBe("MTH101");
  });
});
