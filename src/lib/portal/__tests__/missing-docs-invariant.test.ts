import { describe, it, expect } from "vitest";
import {
  isSubmissionInvariantPreserved,
  assertSubmissionInvariantPreserved,
} from "@/lib/portal/missing-docs-invariant";

const submittedAt = new Date("2026-06-20T09:30:00.000Z");

describe("missing-doc upload submission invariant (Epic 05 §3.5)", () => {
  it("is preserved when submittedAt and formStatus are unchanged", () => {
    const before = { submittedAt, formStatus: "SUBMITTED" };
    const after = { submittedAt: new Date(submittedAt), formStatus: "SUBMITTED" };
    expect(isSubmissionInvariantPreserved(before, after)).toBe(true);
    expect(() =>
      assertSubmissionInvariantPreserved(before, after)
    ).not.toThrow();
  });

  it("is BROKEN when the submission date changes", () => {
    const before = { submittedAt, formStatus: "SUBMITTED" };
    const after = {
      submittedAt: new Date("2026-06-25T00:00:00.000Z"),
      formStatus: "SUBMITTED",
    };
    expect(isSubmissionInvariantPreserved(before, after)).toBe(false);
    expect(() => assertSubmissionInvariantPreserved(before, after)).toThrow(
      /submission date or form status/
    );
  });

  it("is BROKEN when the form status moves away from SUBMITTED", () => {
    const before = { submittedAt, formStatus: "SUBMITTED" };
    const after = { submittedAt, formStatus: "IN_PROGRESS" };
    expect(isSubmissionInvariantPreserved(before, after)).toBe(false);
    expect(() => assertSubmissionInvariantPreserved(before, after)).toThrow();
  });

  it("treats a null after as nothing-to-compare (durable trigger still guards)", () => {
    const before = { submittedAt, formStatus: "SUBMITTED" };
    expect(isSubmissionInvariantPreserved(before, null)).toBe(true);
  });

  it("treats both-null submittedAt as equal", () => {
    const before = { submittedAt: null, formStatus: "SUBMITTED" };
    const after = { submittedAt: null, formStatus: "SUBMITTED" };
    expect(isSubmissionInvariantPreserved(before, after)).toBe(true);
  });
});
