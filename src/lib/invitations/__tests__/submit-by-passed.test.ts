import { describe, it, expect } from "vitest";
import {
  invitationSubmitByPassed,
  isInvitationLapsed,
  SUBMIT_BY_PASSED_MESSAGE,
} from "../submit-by-passed";

// 20 Nov 2026 (Charlotte, option A): an invitation not taken up before its
// submission date is refused at first access and shows "Expired" on the
// contact register.

const NOW = new Date("2026-11-20T11:09:27Z");

const ROUND = {
  closeDate: new Date("2027-04-14T00:00:00Z"),
  defaultSubmissionDeadlineNew: null,
  defaultSubmissionDeadlineRolling: null,
  windows: [] as { scenario: string; submitBy: Date | null }[],
};

const FIRST_YEAR = {
  submissionDeadlineAt: new Date("2026-11-19T23:59:59.999Z"),
  bursaryAccountId: null,
  applicationId: null,
};

describe("invitationSubmitByPassed", () => {
  it("true the day after the invitation's Submit by date (the 20 Nov case)", () => {
    expect(invitationSubmitByPassed(FIRST_YEAR, ROUND, NOW)).toBe(true);
  });

  it("false up to the last millisecond of the Submit by day", () => {
    expect(
      invitationSubmitByPassed(
        FIRST_YEAR,
        ROUND,
        new Date("2026-11-19T23:59:59.999Z")
      )
    ).toBe(false);
  });

  it("an undated first-year invitation falls back to the round close", () => {
    const undated = { ...FIRST_YEAR, submissionDeadlineAt: null };
    expect(invitationSubmitByPassed(undated, ROUND, NOW)).toBe(false);
    expect(
      invitationSubmitByPassed(undated, ROUND, new Date("2027-04-16T00:00:00Z"))
    ).toBe(true);
  });

  it("an undated re-assessment invitation reads the rolling-over date, not the NEW one", () => {
    const reassess = {
      submissionDeadlineAt: null,
      bursaryAccountId: "account-1",
      applicationId: null,
    };
    const round = {
      ...ROUND,
      defaultSubmissionDeadlineNew: new Date("2026-11-01T00:00:00Z"),
      defaultSubmissionDeadlineRolling: new Date("2027-04-30T00:00:00Z"),
    };
    expect(invitationSubmitByPassed(reassess, round, NOW)).toBe(false);
  });

  it("never blocks a second parent joining an existing application", () => {
    expect(
      invitationSubmitByPassed(
        { ...FIRST_YEAR, applicationId: "app-1" },
        ROUND,
        NOW
      )
    ).toBe(false);
  });

  it("false without a round", () => {
    expect(invitationSubmitByPassed(FIRST_YEAR, null, NOW)).toBe(false);
  });
});

describe("isInvitationLapsed", () => {
  it("a PENDING invitation past its date has lapsed", () => {
    expect(
      isInvitationLapsed({ ...FIRST_YEAR, status: "PENDING" }, ROUND, NOW)
    ).toBe(true);
  });

  it("an ACCEPTED invitation never lapses (the family took it up)", () => {
    expect(
      isInvitationLapsed({ ...FIRST_YEAR, status: "ACCEPTED" }, ROUND, NOW)
    ).toBe(false);
  });

  it("an EXPIRED invitation has lapsed whatever its date", () => {
    expect(
      isInvitationLapsed(
        {
          ...FIRST_YEAR,
          submissionDeadlineAt: new Date("2099-01-01T00:00:00Z"),
          status: "EXPIRED",
        },
        ROUND,
        NOW
      )
    ).toBe(true);
  });
});

describe("SUBMIT_BY_PASSED_MESSAGE", () => {
  it("is Charlotte's wording, with the bursary inbox", () => {
    expect(SUBMIT_BY_PASSED_MESSAGE).toBe(
      "You are trying to access the application form for the first time, but the submission date has already passed. We had emailed you over a week ago about it. Please email our bursary department at fees@johnwhitgiftfoundation.org to notify the team so that they can inform you of the next steps."
    );
  });
});
