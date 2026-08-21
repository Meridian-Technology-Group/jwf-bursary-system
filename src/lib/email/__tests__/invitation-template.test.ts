// Epic 14 B3 (CG-26, LA-3) — invitation template resolution.
//
// Five variants keyed situation × school, with the legacy INVITATION as the
// fallback for anything unresolvable (pre-B3 rows). Also pins the rolling
// template's seed copy: it must reference the portal opening date and the
// submission deadline — sourced from the round, never the token expiry
// (the CF-11 bug class).

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  EmailTemplateType,
  InvitationSituation,
  School,
} from "@prisma/client";

import {
  OPENING_DATE_UNKNOWN,
  deadlineTypeForSituation,
  openingDateMergeField,
  resolveInvitationTemplate,
} from "../invitation-template";

describe("resolveInvitationTemplate", () => {
  it.each([
    [InvitationSituation.NEW, School.TRINITY, EmailTemplateType.INVITATION_NEW_TS],
    [InvitationSituation.NEW, School.WHITGIFT, EmailTemplateType.INVITATION_NEW_WS],
    [InvitationSituation.INTERNAL, School.TRINITY, EmailTemplateType.INVITATION_INTERNAL_TS],
    [InvitationSituation.INTERNAL, School.WHITGIFT, EmailTemplateType.INVITATION_INTERNAL_WS],
    [InvitationSituation.ROLLING_OVER, School.TRINITY, EmailTemplateType.INVITATION_ROLLING],
    [InvitationSituation.ROLLING_OVER, School.WHITGIFT, EmailTemplateType.INVITATION_ROLLING],
  ] as const)("%s × %s → %s", (situation, school, expected) => {
    expect(resolveInvitationTemplate(situation, school)).toBe(expected);
  });

  it("rolling-over needs no school (one template for both)", () => {
    expect(resolveInvitationTemplate(InvitationSituation.ROLLING_OVER, null)).toBe(
      EmailTemplateType.INVITATION_ROLLING
    );
  });

  it("falls back to the legacy INVITATION when no situation is recorded", () => {
    expect(resolveInvitationTemplate(null, School.TRINITY)).toBe(
      EmailTemplateType.INVITATION
    );
    expect(resolveInvitationTemplate(undefined, null)).toBe(
      EmailTemplateType.INVITATION
    );
  });

  it("falls back to the legacy INVITATION when a school-keyed situation has no school", () => {
    expect(resolveInvitationTemplate(InvitationSituation.NEW, null)).toBe(
      EmailTemplateType.INVITATION
    );
    expect(resolveInvitationTemplate(InvitationSituation.INTERNAL, undefined)).toBe(
      EmailTemplateType.INVITATION
    );
  });
});

describe("deadlineTypeForSituation", () => {
  it("rolling-over reads the round's rolling deadline; everything else NEW", () => {
    expect(deadlineTypeForSituation(InvitationSituation.ROLLING_OVER)).toBe(
      "ROLLING_OVER"
    );
    expect(deadlineTypeForSituation(InvitationSituation.NEW)).toBe("NEW");
    expect(deadlineTypeForSituation(InvitationSituation.INTERNAL)).toBe("NEW");
    expect(deadlineTypeForSituation(null)).toBe("NEW");
  });
});

describe("openingDateMergeField", () => {
  it("formats the round's opening date en-GB", () => {
    expect(
      openingDateMergeField({ openDate: new Date(Date.UTC(2027, 3, 12)) })
    ).toBe("12/04/2027");
  });

  it("is honest when there is no round", () => {
    expect(openingDateMergeField(null)).toBe(OPENING_DATE_UNKNOWN);
  });
});

describe("seeded rolling template copy (migration 20260816170100)", () => {
  const sql = readFileSync(
    path.join(
      __dirname,
      "../../../../prisma/migrations/20260816170100_e14_invitation_variants/migration.sql"
    ),
    "utf8"
  );

  it("mentions the portal re-opening and the submission window via round-sourced fields", () => {
    expect(sql).toContain("The application portal re-opened on {{opening_date}}");
    expect(sql).toContain("submit your application by {{deadline}}");
  });

  it("seeds all five variant rows", () => {
    for (const t of [
      "INVITATION_NEW_TS",
      "INVITATION_NEW_WS",
      "INVITATION_INTERNAL_TS",
      "INVITATION_INTERNAL_WS",
      "INVITATION_ROLLING",
    ]) {
      expect(sql).toContain(t);
    }
  });
});
