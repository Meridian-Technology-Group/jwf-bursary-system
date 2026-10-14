// Licence fix (14 Oct 2026) — the per-invitation "Submit by" date.

import { describe, expect, it } from "vitest";
import {
  applicationDeadlineFromInvitation,
  emailDeadlineOverride,
  endOfLondonDay,
  londonDateKey,
  parseInvitationSubmitBy,
} from "../submit-by";
import { invitationDeadlineFields } from "@/lib/email/invitation-deadline";
import { invitationScenarioFields } from "@/lib/rounds/window-consumption";

// A `@db.Date` column as Prisma returns it: UTC midnight.
const dbDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const CLOSE = dbDate("2026-11-30");

describe("endOfLondonDay", () => {
  it("is 23:59:59.999 London time — 22:59:59.999Z in BST", () => {
    expect(endOfLondonDay("2026-09-17").toISOString()).toBe("2026-09-17T22:59:59.999Z");
  });

  it("is 23:59:59.999Z in GMT", () => {
    expect(endOfLondonDay("2026-11-16").toISOString()).toBe("2026-11-16T23:59:59.999Z");
  });

  it("is right on the clock-change days", () => {
    // Clocks go back 25 Oct 2026 (GMT by 23:59) and forward 28 Mar 2027 (BST).
    expect(endOfLondonDay("2026-10-25").toISOString()).toBe("2026-10-25T23:59:59.999Z");
    expect(endOfLondonDay("2027-03-28").toISOString()).toBe("2027-03-28T22:59:59.999Z");
  });

  it("always falls on the chosen London day", () => {
    for (const day of ["2026-01-01", "2026-06-30", "2026-11-16", "2027-03-28"]) {
      expect(londonDateKey(endOfLondonDay(day))).toBe(day);
    }
  });
});

describe("parseInvitationSubmitBy", () => {
  // 9 Nov 2026, 10:00 London (GMT).
  const NOW = new Date("2026-11-09T10:00:00.000Z");

  it("blank or absent means no date", () => {
    expect(parseInvitationSubmitBy("", CLOSE, NOW)).toEqual({ ok: true, submitBy: null });
    expect(parseInvitationSubmitBy("   ", CLOSE, NOW)).toEqual({ ok: true, submitBy: null });
    expect(parseInvitationSubmitBy(null, CLOSE, NOW)).toEqual({ ok: true, submitBy: null });
    expect(parseInvitationSubmitBy(undefined, null, NOW)).toEqual({ ok: true, submitBy: null });
  });

  it("her example: sent 9 Nov, due 16 Nov → the end of 16 Nov in London", () => {
    const r = parseInvitationSubmitBy("2026-11-16", CLOSE, NOW);
    expect(r).toEqual({ ok: true, submitBy: new Date("2026-11-16T23:59:59.999Z") });
  });

  it("today is allowed; yesterday is not (London calendar)", () => {
    expect(parseInvitationSubmitBy("2026-11-09", CLOSE, NOW).ok).toBe(true);
    const r = parseInvitationSubmitBy("2026-11-08", CLOSE, NOW);
    expect(r).toEqual({ ok: false, error: "The submit-by date cannot be in the past." });
  });

  it("uses the London day, not the UTC day, for 'today'", () => {
    // 23:30Z on 14 Sep is 00:30 on 15 Sep in London (BST): 14 Sep is past.
    const lateBst = new Date("2026-09-14T23:30:00.000Z");
    expect(parseInvitationSubmitBy("2026-09-14", CLOSE, lateBst).ok).toBe(false);
    expect(parseInvitationSubmitBy("2026-09-15", CLOSE, lateBst).ok).toBe(true);
  });

  it("the round's close date is allowed; the day after is not", () => {
    expect(parseInvitationSubmitBy("2026-11-30", CLOSE, NOW)).toEqual({
      ok: true,
      submitBy: new Date("2026-11-30T23:59:59.999Z"),
    });
    const r = parseInvitationSubmitBy("2026-12-01", CLOSE, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("30/11/2026");
  });

  it("rejects malformed and impossible dates", () => {
    expect(parseInvitationSubmitBy("16/11/2026", CLOSE, NOW).ok).toBe(false);
    expect(parseInvitationSubmitBy("2026-11-31", CLOSE, NOW).ok).toBe(false);
    expect(parseInvitationSubmitBy("2026-13-01", CLOSE, NOW).ok).toBe(false);
  });

  it("refuses a date when the invitation has no round", () => {
    expect(parseInvitationSubmitBy("2026-11-16", null, NOW).ok).toBe(false);
  });
});

describe("applicationDeadlineFromInvitation (copy to the application)", () => {
  const invDate = new Date("2026-11-16T23:59:59.999Z");
  const existing = new Date("2026-11-20T23:59:59.999Z");

  it("copies the invitation's date onto a new application", () => {
    expect(applicationDeadlineFromInvitation(null, invDate)).toEqual(invDate);
    expect(applicationDeadlineFromInvitation(undefined, invDate)).toEqual(invDate);
  });

  it("never overwrites an override that is already set", () => {
    expect(applicationDeadlineFromInvitation(existing, invDate)).toEqual(existing);
    expect(applicationDeadlineFromInvitation(existing, null)).toEqual(existing);
  });

  it("leaves no override when the invitation has no date", () => {
    expect(applicationDeadlineFromInvitation(null, null)).toBeNull();
  });
});

describe("the email's {{deadline}} choice", () => {
  // Prod's 2026/27 round shape (14 Oct 2026): NA_CURRENT window submit_by
  // 17 Sep, closeDate 30 Nov, no per-type defaults. Dates built as local
  // midnights, as `submission-deadline.test.ts` does, so the formatted day is
  // stable in any server time zone.
  const prodRound = {
    closeDate: new Date("2026-11-30T00:00:00"),
    defaultSubmissionDeadlineNew: null,
    defaultSubmissionDeadlineRolling: null,
  };
  const prodWindows = [
    {
      scenario: "NA_CURRENT" as const,
      opensOn: new Date("2026-08-20T00:00:00"),
      submitBy: new Date("2026-09-17T00:00:00"),
      defaultTaxYear: null,
    },
  ];
  const expiresAt = new Date("2026-11-13T12:00:00");

  function emailFor(submitBy: Date | null) {
    const { deadlineRound } = invitationScenarioFields({
      situation: "NEW",
      academicYear: "2026/27",
      onDate: new Date("2026-10-14T12:00:00Z"),
      deadlineRound: prodRound,
      roundOpenDate: null,
      windows: prodWindows,
    });
    return invitationDeadlineFields(
      deadlineRound,
      "NEW",
      expiresAt,
      emailDeadlineOverride(submitBy)
    );
  }

  it("no invitation date → the close date the portal enforces (30/11/2026), not the window's 17 Sep", () => {
    expect(emailFor(null).deadline).toBe("30/11/2026");
  });

  it("an invitation date wins over the round chain", () => {
    expect(emailFor(new Date("2026-11-16T12:00:00")).deadline).toBe("16/11/2026");
  });

  it("an application's own override wins over the invitation's date", () => {
    const inv = new Date("2026-11-16T12:00:00");
    const app = new Date("2026-11-20T12:00:00");
    expect(emailDeadlineOverride(inv, app)).toEqual(app);
    expect(emailDeadlineOverride(inv, null)).toEqual(inv);
    expect(emailDeadlineOverride(null, null)).toBeNull();
  });
});
