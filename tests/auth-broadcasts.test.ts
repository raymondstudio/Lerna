import { describe, expect, it } from "vitest";
import { isBroadcastVisibleToLearner } from "@/lib/auth/broadcast-visibility";

const now = Date.parse("2026-10-17T12:00:00Z");
const student = { accountType: "Student", plan: "free", institution: "Fixture University", department: "Physics" };
const published = { status: "published", target_audience: "all" };
describe("learner announcement visibility", () => {
  it("allows a published announcement and matching targeted audience", () => {
    expect(isBroadcastVisibleToLearner(published, student, now)).toBe(true);
    expect(isBroadcastVisibleToLearner({ ...published, target_audience: "students", target_institution: "fixture university", target_department: "physics" }, student, now)).toBe(true);
  });
  it.each(["draft", "scheduled", "archived"])("hides %s announcements", (status) => {
    expect(isBroadcastVisibleToLearner({ ...published, status }, student, now)).toBe(false);
  });
  it("rejects future, expired and invalid lifecycle dates", () => {
    expect(isBroadcastVisibleToLearner({ ...published, scheduled_for: "2026-10-18T00:00:00Z" }, student, now)).toBe(false);
    expect(isBroadcastVisibleToLearner({ ...published, expires_at: "2026-10-17T11:00:00Z" }, student, now)).toBe(false);
    expect(isBroadcastVisibleToLearner({ ...published, expires_at: "invalid" }, student, now)).toBe(false);
  });
  it("does not leak another audience, department, institution or unknown target", () => {
    for (const override of [{ target_audience: "teachers" }, { target_audience: "pro" }, { target_audience: "unknown" }, { target_department: "Chemistry" }, { target_institution: "Other University" }]) {
      expect(isBroadcastVisibleToLearner({ ...published, ...override }, student, now)).toBe(false);
    }
  });
});
