/**
 * CF-25 — a failed submission must tell the applicant what to do, not what the
 * server was doing. These tests pin both halves of that: nothing internal
 * reaches the applicant, and the internal thing still exists (the caller logs
 * it — see `submitApplication` in `(portal)/apply/actions.ts`).
 */

import { describe, expect, it } from "vitest";
import {
  SUBMISSION_BLOCKED_MESSAGE,
  SUBMISSION_DEADLINE_PASSED_MESSAGE,
  applicantSubmissionMessage,
} from "@/lib/applications/submission-error";

/** The exact payload the gap gate throws (JSON stuffed into an Error message). */
function gapsError(gaps: Array<{ sectionType: string }>): Error {
  return new Error(
    JSON.stringify({
      code: "GAPS_BLOCKING_SUBMISSION",
      gaps: gaps.map((g, i) => ({
        id: `gap-${i}`,
        sectionType: g.sectionType,
        label: `Internal gap label ${i}`,
        fieldRef: "parent1Income.p60DocumentId",
      })),
    })
  );
}

/** The exact error the completeness gate throws. */
function incompleteError(sections: string[]): Error {
  const err = new Error(
    `The following sections are not yet complete: ${sections.join(", ")}. Please complete them before submitting.`
  ) as Error & { incompleteSections: string[] };
  err.incompleteSections = sections;
  return err;
}

describe("applicantSubmissionMessage — the gap payload (what Charlotte saw)", () => {
  it("replaces the JSON blob with the plain sentence plus the sections to fix", () => {
    const message = applicantSubmissionMessage(
      gapsError([
        { sectionType: "PARENTS_INCOME" },
        { sectionType: "FAMILY_ID" },
      ])
    );

    expect(message).toBe(
      "Your application can't be submitted yet. Please finish these sections and try again: Parents' Income, Family Identification."
    );
  });

  it("leaks no internal detail — no JSON, no field refs, no gap labels, no enum values", () => {
    const message = applicantSubmissionMessage(
      gapsError([{ sectionType: "PARENTS_INCOME" }])
    );

    expect(message).not.toContain("GAPS_BLOCKING_SUBMISSION");
    expect(message).not.toContain("{");
    expect(message).not.toContain("parent1Income");
    expect(message).not.toContain("Internal gap label");
    expect(message).not.toContain("PARENTS_INCOME");
  });

  it("names each section once, however many gaps it has", () => {
    const message = applicantSubmissionMessage(
      gapsError([
        { sectionType: "PARENTS_INCOME" },
        { sectionType: "PARENTS_INCOME" },
        { sectionType: "PARENTS_INCOME" },
      ])
    );

    expect(message).toBe(
      "Your application can't be submitted yet. Please finish these sections and try again: Parents' Income."
    );
  });
});

describe("applicantSubmissionMessage — incomplete sections", () => {
  it("uses the section names the applicant sees, not the enum values", () => {
    const err = incompleteError(["PARENT_DETAILS", "DECLARATION"]);
    const message = applicantSubmissionMessage(err);

    expect(message).toBe(
      "Your application can't be submitted yet. Please finish these sections and try again: Parent / Guardian Details, Declaration."
    );
    expect(message).not.toContain("PARENT_DETAILS");
    // The internal message is untouched — staff surfaces still render it, and
    // the caller logs it.
    expect(err.message).toContain("PARENT_DETAILS, DECLARATION");
  });
});

describe("applicantSubmissionMessage — everything else", () => {
  it("says nothing about an unexpected failure beyond the plain sentence", () => {
    const message = applicantSubmissionMessage(
      new Error(
        'Invalid `prisma.application.findUnique()` invocation: relation "applications" does not exist'
      )
    );

    expect(message).toBe(SUBMISSION_BLOCKED_MESSAGE);
    expect(message).not.toContain("prisma");
    expect(message).not.toContain("relation");
  });

  it("handles a non-Error throw without echoing it", () => {
    expect(applicantSubmissionMessage("boom")).toBe(SUBMISSION_BLOCKED_MESSAGE);
    expect(applicantSubmissionMessage(undefined)).toBe(SUBMISSION_BLOCKED_MESSAGE);
    expect(applicantSubmissionMessage({ query: "SELECT 1" })).toBe(
      SUBMISSION_BLOCKED_MESSAGE
    );
  });

  it("does not mistake an ordinary message for a gap payload", () => {
    expect(applicantSubmissionMessage(new Error("Application not found."))).toBe(
      SUBMISSION_BLOCKED_MESSAGE
    );
  });
});

describe("applicantSubmissionMessage — messages already written for the applicant", () => {
  it("passes the deadline lockout through, since replacing it would lose the reason", () => {
    expect(
      applicantSubmissionMessage(new Error(SUBMISSION_DEADLINE_PASSED_MESSAGE))
    ).toBe(SUBMISSION_DEADLINE_PASSED_MESSAGE);
  });

  it("passes the auth/ownership refusals through", () => {
    for (const safe of [
      "You must be signed in to submit an application.",
      "You do not have permission to submit this application.",
    ]) {
      expect(applicantSubmissionMessage(new Error(safe))).toBe(safe);
    }
  });
});
