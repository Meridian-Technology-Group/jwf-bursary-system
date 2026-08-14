import { describe, it, expect } from "vitest";
import {
  DEADLINE_UNKNOWN,
  invitationDeadlineFields,
  INVITATION_ROUND_DEADLINE_SELECT,
} from "@/lib/email/invitation-deadline";
import type { SubmissionDeadlineRound } from "@/lib/rounds/submission-deadline";

/**
 * The regression under test (CF-11 / CF-12): every invitation-style send used
 * to inject the invitation TOKEN EXPIRY (now + 30 days) as `{{deadline}}`,
 * which the templates present as the deadline for SUBMITTING the application.
 * `{{deadline}}` must now be the effective submission deadline; the token
 * expiry moves to its own `{{link_expiry}}` field.
 */

const round: SubmissionDeadlineRound = {
  closeDate: new Date("2026-09-30T00:00:00"),
  defaultSubmissionDeadlineNew: new Date("2026-09-20T00:00:00"),
  defaultSubmissionDeadlineRolling: new Date("2026-04-30T00:00:00"),
};

/** A token expiry deliberately unlike either round date. */
const expiresAt = new Date("2026-12-25T10:30:00");
const expiryText = expiresAt.toLocaleDateString("en-GB");

describe("invitationDeadlineFields", () => {
  it("never puts the token expiry in {{deadline}} — the CF-11 bug", () => {
    for (const type of ["NEW", "ROLLING_OVER"] as const) {
      const fields = invitationDeadlineFields(round, type, expiresAt);
      expect(fields.deadline).not.toBe(expiryText);
    }
  });

  it("puts the token expiry in {{link_expiry}}, where it belongs", () => {
    const fields = invitationDeadlineFields(round, "NEW", expiresAt);
    expect(fields.link_expiry).toBe(expiryText);
  });

  it("a NEW invitation gets the round's new-applicant submission deadline", () => {
    const fields = invitationDeadlineFields(round, "NEW", expiresAt);
    expect(fields.deadline).toBe(
      new Date("2026-09-20T23:59:59.999").toLocaleDateString("en-GB")
    );
  });

  it("a re-assessment invitation gets the round's ROLLING-OVER (April) deadline", () => {
    const fields = invitationDeadlineFields(round, "ROLLING_OVER", expiresAt);
    expect(fields.deadline).toBe(
      new Date("2026-04-30T23:59:59.999").toLocaleDateString("en-GB")
    );
  });

  it("the two invitation types advertise genuinely different deadlines", () => {
    expect(invitationDeadlineFields(round, "NEW", expiresAt).deadline).not.toBe(
      invitationDeadlineFields(round, "ROLLING_OVER", expiresAt).deadline
    );
  });

  it("honours an application's own override (second-parent invites)", () => {
    const override = new Date("2026-11-05T17:00:00");
    const fields = invitationDeadlineFields(
      round,
      "NEW",
      expiresAt,
      override
    );
    expect(fields.deadline).toBe(override.toLocaleDateString("en-GB"));
  });

  it("falls back to the round close date when that type has no round default", () => {
    const noDefaults: SubmissionDeadlineRound = {
      closeDate: new Date("2026-09-30T00:00:00"),
      defaultSubmissionDeadlineNew: null,
      defaultSubmissionDeadlineRolling: null,
    };
    const fields = invitationDeadlineFields(noDefaults, "NEW", expiresAt);
    expect(fields.deadline).toBe(
      new Date("2026-09-30T23:59:59.999").toLocaleDateString("en-GB")
    );
  });

  it("says 'to be confirmed' — never the expiry — when there is no round", () => {
    // Invitation.roundId is nullable, and the resend path reads the stored row.
    const fields = invitationDeadlineFields(null, "NEW", expiresAt);
    expect(fields.deadline).toBe(DEADLINE_UNKNOWN);
    expect(fields.deadline).not.toBe(expiryText);
    expect(fields.link_expiry).toBe(expiryText);
  });

  it("the deadline is stable across resends; only link_expiry moves", () => {
    // A resend regenerates the token and resets the 30-day clock. Before E1
    // that silently pushed the advertised "deadline" 30 days out.
    const firstSend = invitationDeadlineFields(
      round,
      "NEW",
      new Date("2026-06-01T09:00:00")
    );
    const resend = invitationDeadlineFields(
      round,
      "NEW",
      new Date("2026-07-01T09:00:00")
    );
    expect(resend.deadline).toBe(firstSend.deadline);
    expect(resend.link_expiry).not.toBe(firstSend.link_expiry);
  });
});

describe("INVITATION_ROUND_DEADLINE_SELECT", () => {
  it("selects exactly the columns SubmissionDeadlineRound requires", () => {
    // Guards the failure mode where a new invitation path forgets a column and
    // silently resolves every deadline to the round close date.
    expect(Object.keys(INVITATION_ROUND_DEADLINE_SELECT).sort()).toEqual([
      "closeDate",
      "defaultSubmissionDeadlineNew",
      "defaultSubmissionDeadlineRolling",
    ]);
  });
});
