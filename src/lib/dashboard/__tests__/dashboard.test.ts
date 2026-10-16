/**
 * Epic 23 T9 — BURSARY ACTIVITY DASHBOARD shaping (her 6 Sep layout) and the
 * illustrative-data store (D-18, D-19).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  closeReasonShortLabel,
  cohortOf,
  fullAcademicYear,
  isNewApplicationInvitation,
  nextRoundAcademicYear,
  percentOf,
  scheduleLabelForRound,
  shapeBand1,
  shapeBand2,
  shapeBand3,
  spendGroupOf,
  taxYearForRound,
  visibleSchools,
  workloadBucket,
  emptyPerSchool,
} from "../shape";
import { chooseRealOrSample, readSample, SAMPLE_DEFAULTS, SAMPLE_KEYS, SAMPLE_SCHEMAS } from "../sample-data";

describe("years", () => {
  it("labels the round, its tax year and the next round", () => {
    expect(fullAcademicYear("2026/27")).toBe("2026/2027");
    expect(taxYearForRound("2026/27")).toBe("2025/2026");
    expect(taxYearForRound("2027/28")).toBe("2026/2027");
    expect(nextRoundAcademicYear("2026/27")).toBe("2027/28");
    expect(nextRoundAcademicYear("2099/00")).toBe("2100/01");
    expect(scheduleLabelForRound("2027/28")).toBe("2027-28");
  });
});

describe("D-19 cohorts", () => {
  it("ex-OP, TS / TS-TBF, WS / WS-WFA / Pastoral Boarders; WSP-JWF counts as WS", () => {
    expect(cohortOf({ school: "OP_PARTNER", awardFundType: "JWF", migrationSource: "GRANT_TRACKER" })).toBe("EX_OP");
    expect(cohortOf({ school: "TRINITY", awardFundType: "JWF", migrationSource: null })).toBe("TS");
    expect(cohortOf({ school: "TRINITY", awardFundType: "TBF", migrationSource: null })).toBe("TS_TBF");
    expect(cohortOf({ school: "WHITGIFT", awardFundType: "WSP_JWF", migrationSource: null })).toBe("WS");
    expect(cohortOf({ school: "WHITGIFT", awardFundType: "WFA", migrationSource: null })).toBe("WS_WFA");
    expect(cohortOf({ school: "WHITGIFT", awardFundType: "WFA", migrationSource: "MANUAL_PB" })).toBe("WS_PB");
    expect(cohortOf({ school: "WHITGIFT", awardFundType: null, migrationSource: null })).toBe("WS");
  });
  it("spend groups fold the funds back into ex-OP / TS / WS", () => {
    expect(spendGroupOf("TS_TBF")).toBe("ts");
    expect(spendGroupOf("WS_PB")).toBe("ws");
    expect(spendGroupOf("EX_OP")).toBe("exOp");
  });
});

describe("helpers", () => {
  it("% of total, one decimal; blank on an empty total", () => {
    expect(percentOf(1, 3)).toBe(33.3);
    expect(percentOf(0, 0)).toBe(null);
  });
  it("shows OP only where it has any", () => {
    expect(visibleSchools(emptyPerSchool())).toEqual(["TRINITY", "WHITGIFT"]);
    expect(visibleSchools(emptyPerSchool(), { TRINITY: 0, WHITGIFT: 0, OP_PARTNER: 2 })).toEqual(["TRINITY", "WHITGIFT", "OP_PARTNER"]);
  });
  it("her assessment rows: waiting (incl. in progress), paused, completed; drafts in none", () => {
    expect(workloadBucket({ formStatus: "SUBMITTED", assessmentStatus: null })).toBe("waiting");
    expect(workloadBucket({ formStatus: "SUBMITTED", assessmentStatus: "IN_PROGRESS" })).toBe("waiting");
    expect(workloadBucket({ formStatus: "SUBMITTED", assessmentStatus: "PAUSED" })).toBe("paused");
    expect(workloadBucket({ formStatus: "SUBMITTED", assessmentStatus: "ROLLED_OVER" })).toBe("completed");
    expect(workloadBucket({ formStatus: "IN_PROGRESS", assessmentStatus: null })).toBe(null);
  });
  it("close reasons lose the 'Closed account –' prefix", () => {
    expect(closeReasonShortLabel("Closed account – Family relocating")).toBe("Family relocating");
  });
  it("a new-application invitation is a first-year family", () => {
    expect(isNewApplicationInvitation({ school: "TRINITY", situation: "NEW", bursaryAccountId: null })).toBe(true);
    expect(isNewApplicationInvitation({ school: "TRINITY", situation: "INTERNAL", bursaryAccountId: null })).toBe(true);
    expect(isNewApplicationInvitation({ school: "TRINITY", situation: "ROLLING_OVER", bursaryAccountId: "a" })).toBe(false);
    expect(isNewApplicationInvitation({ school: "TRINITY", situation: null, bursaryAccountId: "a" })).toBe(false);
  });
});

describe("band 1 — applications & assessments management", () => {
  it("per-school counts; total = new invitations + rolling-over due", () => {
    const b = shapeBand1(
      [
        { school: "TRINITY", applicationType: "NEW", formStatus: "SUBMITTED", assessmentStatus: "COMPLETED", assessmentSchool: null },
        { school: "TRINITY", applicationType: "NEW", formStatus: "SUBMITTED", assessmentStatus: null, assessmentSchool: null },
        { school: "TRINITY", applicationType: "NEW", formStatus: "IN_PROGRESS", assessmentStatus: null, assessmentSchool: null },
        { school: "WHITGIFT", applicationType: "ROLLING_OVER", formStatus: "SUBMITTED", assessmentStatus: "PAUSED", assessmentSchool: null },
      ],
      [
        { school: "TRINITY", situation: "NEW", bursaryAccountId: null },
        { school: "TRINITY", situation: "INTERNAL", bursaryAccountId: null },
        { school: "WHITGIFT", situation: "ROLLING_OVER", bursaryAccountId: "acc" },
      ],
      ["WHITGIFT", "WHITGIFT"],
    );
    expect(b.newInvitesSent).toEqual({ TRINITY: 2, WHITGIFT: 0, OP_PARTNER: 0 });
    expect(b.newReceived).toEqual({ TRINITY: 2, WHITGIFT: 0, OP_PARTNER: 0 });
    expect(b.rollingDue).toEqual({ TRINITY: 0, WHITGIFT: 2, OP_PARTNER: 0 });
    expect(b.total).toEqual({ TRINITY: 2, WHITGIFT: 2, OP_PARTNER: 0 });
    expect(b.waiting.TRINITY).toBe(1);
    expect(b.completed.TRINITY).toBe(1);
    expect(b.paused.WHITGIFT).toBe(1);
    expect(b.totals).toEqual({ newInvitesSent: 2, newReceived: 2 });
    expect(b.schools).toEqual(["TRINITY", "WHITGIFT"]);
  });
});

describe("band 2 — outcomes, new & internal", () => {
  const base = { assessmentSchool: null, closedAt: null, closeReasonLabel: null, entryYear: 2026, bursarySpendBeforeVat: null };
  it("awards split by the award's year; closures and their top reasons", () => {
    const b = shapeBand2(
      [
        { ...base, school: "TRINITY", applicationType: "NEW", assessmentStatus: "NEW_AWARD", bursarySpendBeforeVat: 10000 },
        { ...base, school: "TRINITY", applicationType: "NEW", assessmentStatus: "NEW_AWARD", entryYear: 2027, bursarySpendBeforeVat: 5000.5 },
        { ...base, school: "WHITGIFT", applicationType: "NEW", assessmentStatus: "CLOSED_ARCHIVED", closeReasonLabel: "Closed account – Family relocating" },
        { ...base, school: "WHITGIFT", applicationType: "NEW", assessmentStatus: null, closedAt: new Date(), closeReasonLabel: "Closed account – Family relocating" },
        { ...base, school: "WHITGIFT", applicationType: "NEW", assessmentStatus: null, closedAt: new Date(), closeReasonLabel: "Closed account – ID checks fail" },
        { ...base, school: "WHITGIFT", applicationType: "ROLLING_OVER", assessmentStatus: "NEW_AWARD", bursarySpendBeforeVat: 99 },
      ],
      2026,
    );
    expect(b.newAwards).toEqual({ TRINITY: 2, WHITGIFT: 0, OP_PARTNER: 0 });
    expect(b.spendCurrentYear.TRINITY).toEqual({ spend: 10000, awards: 1 });
    expect(b.spendNextYear.TRINITY).toEqual({ spend: 5000.5, awards: 1 });
    expect(b.closedNoAward.WHITGIFT).toBe(3);
    expect(b.closedReasons).toEqual([
      { label: "Family relocating", share: 2 / 3 },
      { label: "ID checks fail", share: 1 / 3 },
    ]);
  });
});

describe("band 3 — rolling-over", () => {
  it("cohort counts, progress, committed spend and year-to-year reasons", () => {
    const scheduled = [
      { accountId: "a", school: "OP_PARTNER" as const, awardFundType: "JWF" as const, migrationSource: "GRANT_TRACKER", accountClosed: false },
      { accountId: "b", school: "TRINITY" as const, awardFundType: "TBF" as const, migrationSource: null, accountClosed: false },
      { accountId: "c", school: "WHITGIFT" as const, awardFundType: "WFA" as const, migrationSource: null, accountClosed: true },
    ];
    const b = shapeBand3(scheduled, 2, [
      {
        accountId: "b",
        applicationType: "ROLLING_OVER",
        formStatus: "SUBMITTED",
        assessmentStatus: "ROLLED_OVER",
        bursarySpendBeforeVat: 12000,
        reasonCodes: [{ code: 9, label: "Self-employed net profit decrease" }],
      },
      { accountId: "a", applicationType: "ROLLING_OVER", formStatus: "SUBMITTED", assessmentStatus: "PAUSED", bursarySpendBeforeVat: null, reasonCodes: [] },
      { accountId: null, applicationType: "NEW", formStatus: "SUBMITTED", assessmentStatus: "NEW_AWARD", bursarySpendBeforeVat: 1, reasonCodes: [] },
    ]);
    expect(b.cohorts).toEqual({ EX_OP: 1, TS: 0, TS_TBF: 1, WS: 0, WS_WFA: 1, WS_PB: 0 });
    expect(b.scheduledTotal).toBe(3);
    expect(b.progress).toEqual({ sent: 2, received: 2, waiting: 0, paused: 1, closed: 1, completedWithAward: 1 });
    expect(b.committedSpend).toEqual({ exOp: 0, ts: 12000, ws: 0 });
    expect(b.yoyChanges).toEqual([{ label: "9 - Self-employed net profit decrease", count: 1 }]);
  });
});

describe("illustrative data (D-18)", () => {
  it("real data as soon as any exists; the sample only while the real count is zero", () => {
    expect(chooseRealOrSample(0, ["real"], ["sample"])).toEqual({ data: ["sample"], illustrative: true });
    expect(chooseRealOrSample(1, ["real"], ["sample"])).toEqual({ data: ["real"], illustrative: false });
  });
  it("a missing or malformed stored payload falls back to her defaults", () => {
    expect(readSample("rolling_committed_spend", undefined)).toEqual(SAMPLE_DEFAULTS.rolling_committed_spend);
    expect(readSample("closed_reasons_top5", { rows: [{ label: "", share: 2 }] })).toEqual(SAMPLE_DEFAULTS.closed_reasons_top5);
    expect(readSample("rolling_committed_spend", { exOp: "1", ts: 2, ws: 3 })).toEqual({ exOp: 1, ts: 2, ws: 3 });
  });
  it("her defaults validate, and the lists keep to five and ten", () => {
    for (const k of SAMPLE_KEYS) expect(SAMPLE_SCHEMAS[k].safeParse(SAMPLE_DEFAULTS[k]).success).toBe(true);
    expect(SAMPLE_DEFAULTS.closed_reasons_top5.rows).toHaveLength(5);
    expect(SAMPLE_DEFAULTS.yoy_changes_top10.rows).toHaveLength(10);
    expect(
      SAMPLE_SCHEMAS.closed_reasons_top5.safeParse({ rows: Array.from({ length: 6 }, () => ({ label: "x", share: 0.1 })) }).success,
    ).toBe(false);
  });

  const sql = readFileSync(
    resolve(__dirname, "../../../../prisma/migrations/20261016180000_dashboard_sample_data/migration.sql"),
    "utf8",
  );
  it("the migration ships its RLS policies (staff read, ADMIN write)", () => {
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toMatch(/CREATE POLICY dashboard_sample_data_select[\s\S]*FOR SELECT TO app_user[\s\S]*is_admin_or_viewer\(\) OR public\.current_user_role\(\) = 'ASSESSOR'/);
    expect(sql).toMatch(/CREATE POLICY dashboard_sample_data_modify[\s\S]*FOR ALL TO app_user[\s\S]*USING \(public\.is_admin\(\)\)[\s\S]*WITH CHECK \(public\.is_admin\(\)\)/);
    expect(sql).toContain("ON CONFLICT (key) DO NOTHING");
  });
  it("seeds exactly her default figures", () => {
    for (const k of SAMPLE_KEYS) {
      const m = sql.match(new RegExp(`\\('${k}', \\$json\\$(.*?)\\$json\\$::jsonb\\)`));
      expect(m, k).not.toBeNull();
      expect(JSON.parse(m![1])).toEqual(SAMPLE_DEFAULTS[k]);
    }
  });
});
