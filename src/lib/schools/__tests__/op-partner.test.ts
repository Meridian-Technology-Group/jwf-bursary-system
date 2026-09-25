/**
 * GT migration PR-C (S9): the OP partnering school end to end — one school,
 * no VAT, per-account fees, bursary ends at Year 11, JWF fund, never newly
 * invited. Expected horizons from 02-target-model.md: OP Y10 → 2, Y11 → 1.
 */
import { describe, expect, it } from "vitest";
import { EmailTemplateType, InvitationSituation } from "@prisma/client";
import {
  ALL_SCHOOLS,
  entrySchoolYearOptions,
  FEE_TABLE_SCHOOLS,
  finalEligibleSchoolYear,
  INVITABLE_SCHOOLS,
  schoolAllowsSituation,
  schoolName,
  schoolVatRate,
} from "..";
import {
  getTotalSchoolingYears,
  remainingYearsForEntrySchoolYear,
} from "@/lib/assessment/schooling-years";
import { resolveScheduleHorizon } from "@/lib/bursary-accounts/schedule";
import { buildPortalScheduleRows } from "@/lib/bursary-accounts/portal-schedule";
import { awardFundOptionsForSchool } from "@/lib/assessment/award-fund";
import { resolveInvitationTemplate } from "@/lib/email/invitation-template";

describe("OP partnering school (S9)", () => {
  it("is named as she named it", () => {
    expect(schoolName("OP_PARTNER")).toBe("OP partnering school");
  });

  it("carries no VAT and has no fee table", () => {
    expect(schoolVatRate("OP_PARTNER")).toBe(0);
    expect(FEE_TABLE_SCHOOLS).not.toContain("OP_PARTNER");
  });

  it("is offered to staff but never on parent-facing or new-invitation forms", () => {
    expect(ALL_SCHOOLS).toContain("OP_PARTNER");
    expect(INVITABLE_SCHOOLS).not.toContain("OP_PARTNER");
  });

  it("only takes rolling-over invitations", () => {
    expect(schoolAllowsSituation("OP_PARTNER", "ROLLING_OVER")).toBe(true);
    expect(schoolAllowsSituation("OP_PARTNER", "NEW")).toBe(false);
    expect(schoolAllowsSituation("OP_PARTNER", "INTERNAL")).toBe(false);
    expect(schoolAllowsSituation("WHITGIFT", "NEW")).toBe(true);
  });

  it("never borrows a Whitgift invitation template", () => {
    expect(resolveInvitationTemplate(InvitationSituation.ROLLING_OVER, "OP_PARTNER")).toBe(
      EmailTemplateType.INVITATION_ROLLING,
    );
    for (const situation of [InvitationSituation.NEW, InvitationSituation.INTERNAL]) {
      expect(resolveInvitationTemplate(situation, "OP_PARTNER")).toBe(EmailTemplateType.INVITATION);
    }
  });

  it("pays from the Foundation's fund only", () => {
    expect(awardFundOptionsForSchool("OP_PARTNER")).toEqual(["JWF"]);
  });

  describe("the bursary ends at Year 11", () => {
    it("final year 11; entry years offered 6–11", () => {
      expect(finalEligibleSchoolYear("OP_PARTNER")).toBe(11);
      expect(entrySchoolYearOptions("OP_PARTNER")).toEqual([6, 7, 8, 9, 10, 11]);
      expect(entrySchoolYearOptions("WHITGIFT")).toEqual([6, 7, 8, 9, 10, 11, 12, 13]);
    });

    it.each([
      [6, 6],
      [9, 3],
      [10, 2],
      [11, 1],
      [12, 0],
    ])("OP entering Year %i has %i years", (entry, years) => {
      expect(getTotalSchoolingYears(entry, "OP_PARTNER")).toBe(years);
    });

    it("Trinity and Whitgift still run to Year 13", () => {
      expect(getTotalSchoolingYears(10, "TRINITY")).toBe(4);
      expect(getTotalSchoolingYears(10)).toBe(4);
    });

    it("the entry-year autofill caps at Year 11", () => {
      expect(remainingYearsForEntrySchoolYear(10, "OP_PARTNER")).toBe(2);
      expect(remainingYearsForEntrySchoolYear(11, "OP_PARTNER")).toBe(1);
      expect(remainingYearsForEntrySchoolYear(12, "OP_PARTNER")).toBeNull();
      expect(remainingYearsForEntrySchoolYear(12, "WHITGIFT")).toBe(2);
    });

    it("the account schedule horizon stops at Year 11", () => {
      expect(resolveScheduleHorizon("Y10", undefined, "OP_PARTNER")).toBe(2);
      expect(resolveScheduleHorizon("Y10", undefined, "WHITGIFT")).toBe(4);
    });

    it("the parent's schedule calendar stops at Year 11", () => {
      const rows = buildPortalScheduleRows({
        entryYearGroup: "Y9",
        firstAssessmentYear: "2026/2027",
        visibleEntries: [{ scheduleYear: 1, academicYear: "2026/2027" }],
        currentAcademicYearStart: 2026,
        school: "OP_PARTNER",
      });
      expect(rows.map((r) => r.schoolYear)).toEqual([9, 10, 11]);
    });
  });
});
