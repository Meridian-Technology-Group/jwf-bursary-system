import { describe, it, expect } from "vitest";
import {
  ApplicationFormStatus,
  AssessmentStatus,
} from "@prisma/client";
import { deriveReviewPhase } from "../status";
import {
  ALL_REVIEW_PHASES,
  matchesReviewPhase,
  reviewPhaseWhere,
} from "../queue-filter";

// Epic 18's post-assessment locks never write `outcome`. deriveReviewPhase had
// no case for them, so a locked assessment read "Awaiting review" (with a Begin
// Review button that then failed) while the queue predicate called it Active.
describe("review phase of the post-assessment lock states", () => {
  const base = { formStatus: "SUBMITTED" as const, outcome: null, closedAt: null };

  it.each(["NEW_AWARD", "ROLLED_OVER", "WAITING_LIST"] as const)(
    "%s reads Active (QUALIFIES), not Awaiting review",
    (status) => {
      expect(deriveReviewPhase({ ...base, assessmentStatus: status })).toBe("QUALIFIES");
    }
  );

  it("CLOSED_ARCHIVED reads Closed (DOES_NOT_QUALIFY)", () => {
    expect(deriveReviewPhase({ ...base, assessmentStatus: "CLOSED_ARCHIVED" })).toBe(
      "DOES_NOT_QUALIFY"
    );
  });

  it("closedAt still wins over a lock state", () => {
    expect(
      deriveReviewPhase({ ...base, assessmentStatus: "ROLLED_OVER", closedAt: new Date() })
    ).toBe("CLOSED");
  });

  // The lifecycle as it is written today: an assessment exists only once the
  // form is SUBMITTED, and the Epic 18 path never sets `outcome`.
  it("derivation and the queue predicate agree on every current-lifecycle state", () => {
    const disagreements: string[] = [];
    for (const assessmentStatus of [null, ...Object.values(AssessmentStatus)]) {
      for (const closedAt of [null, new Date()]) {
        const facts = { formStatus: "SUBMITTED" as const, assessmentStatus, outcome: null, closedAt };
        const derived = deriveReviewPhase(facts);
        const matched = ALL_REVIEW_PHASES.filter((p) => matchesReviewPhase(facts, p));
        if (matched.length !== 1 || matched[0] !== derived) {
          disagreements.push(
            `${assessmentStatus}/${closedAt ? "closed" : "open"}: derived ${derived}, matched [${matched}]`
          );
        }
      }
    }
    expect(disagreements).toEqual([]);
  });

  it("legacy decided rows keep their phase", () => {
    for (const outcome of ["AWARDED", "QUALIFIES_NOT_AWARDED", "DOES_NOT_QUALIFY"] as const) {
      const facts = { formStatus: "SUBMITTED" as const, assessmentStatus: "COMPLETED" as const, outcome, closedAt: null };
      expect(matchesReviewPhase(facts, deriveReviewPhase(facts))).toBe(true);
    }
  });

  it("a form not yet submitted is pre-submission", () => {
    for (const formStatus of Object.values(ApplicationFormStatus).filter((s) => s !== "SUBMITTED")) {
      expect(deriveReviewPhase({ formStatus, assessmentStatus: null, outcome: null, closedAt: null })).toBe(
        "PRE_SUBMISSION"
      );
    }
  });

  it("the server-side filter selects the lock states under their phases", () => {
    expect(JSON.stringify(reviewPhaseWhere(["QUALIFIES"]))).toContain("ROLLED_OVER");
    expect(JSON.stringify(reviewPhaseWhere(["QUALIFIES"]))).toContain("NEW_AWARD");
    expect(JSON.stringify(reviewPhaseWhere(["QUALIFIES"]))).toContain("WAITING_LIST");
    expect(JSON.stringify(reviewPhaseWhere(["DOES_NOT_QUALIFY"]))).toContain("CLOSED_ARCHIVED");
  });
});
