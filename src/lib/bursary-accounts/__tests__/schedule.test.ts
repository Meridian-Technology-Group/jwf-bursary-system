import { describe, it, expect, vi } from "vitest";
import {
  resolveScheduleHorizon,
  planSchedule,
  generateSchedule,
  scheduleDatesForYear,
  rollingRedateWhere,
  effectiveHorizon,
  planEndAfterYear,
  planAddYear,
  scheduleEditControls,
  type PlannerRow,
  FINAL_ELIGIBLE_SCHOOL_YEAR,
  MAX_SCHEDULE_YEARS,
} from "../schedule";

describe("resolveScheduleHorizon (D19)", () => {
  it("counts years to the final eligible school year (Y7 → 7..13 = 7)", () => {
    expect(resolveScheduleHorizon("Y7")).toBe(7);
  });

  it("Y12 → 12,13 = 2 years", () => {
    expect(resolveScheduleHorizon("Y12")).toBe(2);
  });

  it("Y6 → clamped to MAX_SCHEDULE_YEARS (6..13 = 8)", () => {
    expect(resolveScheduleHorizon("Y6")).toBe(
      Math.min(FINAL_ELIGIBLE_SCHOOL_YEAR - 6 + 1, MAX_SCHEDULE_YEARS)
    );
  });

  it("OTHER / null falls back to the default horizon", () => {
    expect(resolveScheduleHorizon("OTHER")).toBe(MAX_SCHEDULE_YEARS);
    expect(resolveScheduleHorizon(null)).toBe(MAX_SCHEDULE_YEARS);
  });

  // CH-26: the four historic entry points are no longer the only ones. A Y8 or
  // Y10 entrant used to be recorded as OTHER and silently got the 8-year
  // default horizon; now each derives its own.
  it("derives a real horizon for every school year 6–13 (CH-26)", () => {
    const expected: Array<[Parameters<typeof resolveScheduleHorizon>[0], number]> = [
      ["Y6", 8],
      ["Y7", 7],
      ["Y8", 6],
      ["Y9", 5],
      ["Y10", 4],
      ["Y11", 3],
      ["Y12", 2],
      ["Y13", 1],
    ];
    for (const [group, horizon] of expected) {
      expect(resolveScheduleHorizon(group)).toBe(horizon);
    }
  });
});

describe("planSchedule — dates + labels + show/hide", () => {
  const rows = planSchedule({
    awardAcademicYear: "2026/2027",
    awardOpenDate: new Date(Date.UTC(2026, 8, 1)), // 1 Sep 2026
    awardCloseDate: new Date(Date.UTC(2026, 11, 1)), // 1 Dec 2026
    horizon: 3,
  });

  it("generates N rows, Year 1 = award year", () => {
    expect(rows).toHaveLength(3);
    expect(rows[0].scheduleYear).toBe(1);
    expect(rows[0].academicYear).toBe("2026-27");
    expect(rows[2].academicYear).toBe("2028-29");
  });

  it("Year 1 keeps the award round's dates; later years take the rolling-over window (Epic 21 F2, D-1)", () => {
    const iso = (d: Date | null) => d?.toISOString().slice(0, 10);
    expect(iso(rows[0].availableOn)).toBe("2026-09-01");
    expect(iso(rows[0].requiredBy)).toBe("2026-12-01");
    // 2027-28 → 15/04/2027–21/05/2027; 2028-29 → 15/04/2028–21/05/2028.
    expect(iso(rows[1].availableOn)).toBe("2027-04-15");
    expect(iso(rows[1].requiredBy)).toBe("2027-05-21");
    expect(iso(rows[2].availableOn)).toBe("2028-04-15");
    expect(iso(rows[2].requiredBy)).toBe("2028-05-21");
  });

  it("shows every year of the award by default (Epic 21 #5, D-2)", () => {
    expect(rows.every((r) => r.showOnPortal)).toBe(true);
  });

  it("falls back to the raw label when the academic year can't be parsed", () => {
    const r = planSchedule({
      awardAcademicYear: "unknown",
      awardOpenDate: null,
      awardCloseDate: null,
      horizon: 2,
    });
    expect(r[0].academicYear).toBe("unknown");
    expect(r[1].academicYear).toBe("unknown +1");
    expect(r[0].availableOn).toBeNull();
  });
});

function makeTx(existingYears: number[] = []) {
  return {
    // Epic 21 R2 — later schedule years read each round's stored RA window.
    roundWindow: { findMany: vi.fn(async () => [] as unknown[]) },
    bursaryScheduleEntry: {
      findMany: vi.fn(async () =>
        existingYears.map((y) => ({ scheduleYear: y }))
      ),
      create: vi.fn(async () => ({})),
    },
    bursaryAccount: { update: vi.fn(async () => ({})) },
  };
}

const account = {
  id: "acc-1",
  school: "WHITGIFT" as const,
  entryYearGroup: "Y12" as const, // 2-year horizon → easy to assert
  firstAssessmentYear: "2026/2027",
};
const round = {
  academicYear: "2026/2027",
  openDate: new Date(Date.UTC(2026, 8, 1)),
  closeDate: new Date(Date.UTC(2026, 11, 1)),
};

describe("generateSchedule — idempotency", () => {
  it("creates the full horizon on a fresh account + persists scheduleYears", async () => {
    const tx = makeTx([]);
    const res = await generateSchedule(tx as never, account, round);
    expect(res.horizon).toBe(2);
    expect(res.created).toBe(2);
    expect(res.skipped).toBe(0);
    expect(tx.bursaryScheduleEntry.create).toHaveBeenCalledTimes(2);
    expect(tx.bursaryAccount.update).toHaveBeenCalledWith({
      where: { id: "acc-1" },
      data: { scheduleYears: 2 },
    });
  });

  it("re-running creates NOTHING when all rows already exist", async () => {
    const tx = makeTx([1, 2]);
    const res = await generateSchedule(tx as never, account, round);
    expect(res.created).toBe(0);
    expect(res.skipped).toBe(2);
    expect(tx.bursaryScheduleEntry.create).not.toHaveBeenCalled();
  });

  it("tops up only the missing years (never duplicates)", async () => {
    const tx = makeTx([1]);
    const res = await generateSchedule(tx as never, account, round);
    expect(res.created).toBe(1);
    expect(res.skipped).toBe(1);
    expect(tx.bursaryScheduleEntry.create).toHaveBeenCalledTimes(1);
  });
});

// ─── Epic 21 #4 — End after this year / Add a year ───────────────────────────

describe("effectiveHorizon", () => {
  it("is the natural horizon when the schedule was never ended", () => {
    expect(effectiveHorizon(7, null)).toBe(7);
    expect(effectiveHorizon(7, undefined)).toBe(7);
  });
  it("caps at the ADMIN's end year, never above the natural horizon or below 1", () => {
    expect(effectiveHorizon(7, 1)).toBe(1);
    expect(effectiveHorizon(7, 9)).toBe(7);
    expect(effectiveHorizon(7, 0)).toBe(1);
  });
});

describe("generateSchedule — respects scheduleEndYear", () => {
  const longAccount = { ...account, entryYearGroup: "Y8" as const }; // 6-year horizon

  it("never re-creates an ended year (Regenerate / award lock)", async () => {
    const tx = makeTx([1]);
    const res = await generateSchedule(tx as never, { ...longAccount, scheduleEndYear: 1 }, round);
    expect(res.horizon).toBe(1);
    expect(tx.bursaryScheduleEntry.create).not.toHaveBeenCalled();
    expect(tx.bursaryAccount.update).toHaveBeenCalledWith({
      where: { id: "acc-1" },
      data: { scheduleYears: 1 },
    });
  });

  it("is idempotent when run twice on an ended account", async () => {
    const tx = makeTx([1, 2]);
    await generateSchedule(tx as never, { ...longAccount, scheduleEndYear: 2 }, round);
    await generateSchedule(tx as never, { ...longAccount, scheduleEndYear: 2 }, round);
    expect(tx.bursaryScheduleEntry.create).not.toHaveBeenCalled();
  });
});

function row(scheduleYear: number, status: PlannerRow["status"] = "SCHEDULED"): PlannerRow {
  return { id: `e${scheduleYear}`, scheduleYear, academicYear: `${2025 + scheduleYear}-${String(26 + scheduleYear).slice(-2)}`, status };
}

describe("planEndAfterYear", () => {
  it("removes every SCHEDULED year after this one", () => {
    const plan = planEndAfterYear([row(1, "COMPLETE"), row(2), row(3), row(4)], 1);
    expect(plan).toEqual({ ok: true, deleteIds: ["e2", "e3", "e4"], removedYears: ["2027-28", "2028-29", "2029-30"] });
  });

  it("refuses when a later year has started, naming it", () => {
    const plan = planEndAfterYear([row(1, "COMPLETE"), row(2, "RECEIVED"), row(3)], 1);
    expect(plan).toEqual({ ok: false, reason: expect.stringContaining("2027-28 has already started") });
  });

  it("refuses when there is nothing after this year", () => {
    const plan = planEndAfterYear([row(1), row(2)], 2);
    expect(plan.ok).toBe(false);
  });
});

describe("planAddYear", () => {
  it("adds the year after the last one", () => {
    expect(planAddYear([row(1), row(2)], 7, "WHITGIFT")).toEqual({ ok: true, scheduleYear: 3 });
  });

  it("refuses past the natural horizon (no Year 14)", () => {
    const plan = planAddYear([row(1), row(2)], 2, "WHITGIFT");
    expect(plan).toEqual({ ok: false, reason: expect.stringContaining("Year 13") });
  });

  it("names Year 11 at the OP partnering school", () => {
    const plan = planAddYear([row(1)], 1, "OP_PARTNER");
    expect(plan).toEqual({ ok: false, reason: expect.stringContaining("Year 11") });
  });
});

describe("scheduleEditControls", () => {
  const base = {
    applicationId: "app-1",
    roundAcademicYear: "2026/27",
    firstAssessmentYear: "2026/27",
    naturalHorizon: 3,
    school: "WHITGIFT" as const,
    accountClosed: false,
  };
  const linked = (r: PlannerRow, applicationId: string | null = null) => ({ ...r, applicationId });

  it("enables End with the years it would remove, and Add when there is room", () => {
    const c = scheduleEditControls({
      ...base,
      rows: [linked(row(1, "COMPLETE"), "app-1"), linked(row(2))],
    });
    expect(c.end).toEqual({ enabled: true, thisYear: "2026-27", removedYears: ["2027-28"] });
    expect(c.add).toEqual({ enabled: true, addedYear: "2028-29", reopens: false });
  });

  it("disables both with reasons when there is nothing to remove and no room to add", () => {
    const c = scheduleEditControls({
      ...base,
      rows: [linked(row(1), "app-1"), linked(row(2)), linked(row(3))].slice(0, 3),
      applicationId: "app-3",
      roundAcademicYear: "2028/29",
    });
    expect(c.end.enabled).toBe(false);
    expect(c.add).toEqual({ enabled: false, why: expect.stringContaining("Year 13") });
  });

  it("says Add re-opens a closed account", () => {
    const c = scheduleEditControls({ ...base, accountClosed: true, rows: [linked(row(1, "COMPLETE"), "app-1")] });
    expect(c.add).toEqual({ enabled: true, addedYear: "2027-28", reopens: true });
  });
});

describe("scheduleDatesForYear (Epic 21 F2)", () => {
  const open = new Date(Date.UTC(2026, 7, 21)); // 21 Aug 2026
  const close = new Date(Date.UTC(2026, 8, 17)); // 17 Sep 2026
  const iso = (d: Date | null) => d?.toISOString().slice(0, 10);

  it("year 1 is the award round's own dates", () => {
    const r = scheduleDatesForYear({ awardStartYear: 2026, awardOpenDate: open, awardCloseDate: close, scheduleYear: 1 });
    expect([iso(r.availableOn), iso(r.requiredBy)]).toEqual(["2026-08-21", "2026-09-17"]);
  });

  it("a later year is that year's rolling-over window, whatever the award round's dates", () => {
    const r = scheduleDatesForYear({ awardStartYear: 2026, awardOpenDate: open, awardCloseDate: close, scheduleYear: 2 });
    expect([iso(r.availableOn), iso(r.requiredBy)]).toEqual(["2027-04-15", "2027-05-21"]);
  });

  it("works without award round dates (round not found)", () => {
    const r = scheduleDatesForYear({ awardStartYear: 2026, awardOpenDate: null, awardCloseDate: null, scheduleYear: 3 });
    expect([iso(r.availableOn), iso(r.requiredBy)]).toEqual(["2028-04-15", "2028-05-21"]);
  });

  it("falls back to shifting the award dates when the award year can't be parsed (leap day safe)", () => {
    const leap = new Date(Date.UTC(2028, 1, 29)); // 29 Feb 2028
    const r = scheduleDatesForYear({ awardStartYear: null, awardOpenDate: leap, awardCloseDate: null, scheduleYear: 2 });
    // setUTCFullYear rolls 29 Feb into 1 Mar in a non-leap year.
    expect(iso(r.availableOn)).toBe("2029-03-01");
    expect(r.requiredBy).toBeNull();
  });
});

// ─── Epic 21 R2 — later years follow their own round's RA window ─────────────

describe("scheduleDatesForYear — the round's stored RA window (Epic 21 R2)", () => {
  const iso = (d: Date | null) => d?.toISOString().slice(0, 10);
  const open = new Date(Date.UTC(2026, 8, 1));
  const close = new Date(Date.UTC(2026, 10, 30));

  it("a later year takes its round's RA window (her real date, 22 May)", () => {
    const r = scheduleDatesForYear({
      awardStartYear: 2026,
      awardOpenDate: open,
      awardCloseDate: close,
      scheduleYear: 2,
      raWindow: { opensOn: new Date(Date.UTC(2027, 3, 15)), submitBy: new Date(Date.UTC(2027, 4, 22)) },
    });
    expect([iso(r.availableOn), iso(r.requiredBy)]).toEqual(["2027-04-15", "2027-05-22"]);
  });

  it("year 1 ignores any window: it keeps the award round's dates", () => {
    const r = scheduleDatesForYear({
      awardStartYear: 2026,
      awardOpenDate: open,
      awardCloseDate: close,
      scheduleYear: 1,
      raWindow: { opensOn: new Date(Date.UTC(2027, 3, 15)), submitBy: new Date(Date.UTC(2027, 4, 22)) },
    });
    expect([iso(r.availableOn), iso(r.requiredBy)]).toEqual(["2026-09-01", "2026-11-30"]);
  });
});

describe("planSchedule — rolling windows by academic year (Epic 21 R2)", () => {
  const iso = (d: Date | null) => d?.toISOString().slice(0, 10);
  it("each later year reads the window of the round for ITS year; others keep the placeholder", () => {
    const rows = planSchedule({
      awardAcademicYear: "2026/27",
      awardOpenDate: new Date(Date.UTC(2026, 8, 1)),
      awardCloseDate: new Date(Date.UTC(2026, 10, 30)),
      horizon: 3,
      rollingWindows: new Map([
        // The award year's own RA window must NOT move year 1.
        [2026, { opensOn: new Date(Date.UTC(2026, 3, 1)), submitBy: new Date(Date.UTC(2026, 3, 2)) }],
        [2027, { opensOn: null, submitBy: new Date(Date.UTC(2027, 4, 22)) }],
      ]),
    });
    expect(rows.map((r) => [r.academicYear, iso(r.availableOn), iso(r.requiredBy)])).toEqual([
      ["2026-27", "2026-09-01", "2026-11-30"],
      // A window with only a close keeps the placeholder opening date.
      ["2027-28", "2027-04-15", "2027-05-22"],
      ["2028-29", "2028-04-15", "2028-05-21"],
    ]);
  });
});

describe("generateSchedule — loads the stored RA windows (Epic 21 R2)", () => {
  it("dates year 2 from the 2027/28 round's RA window", async () => {
    const tx = makeTx([]);
    tx.roundWindow.findMany.mockResolvedValueOnce([
      {
        opensOn: new Date(Date.UTC(2027, 3, 15)),
        submitBy: new Date(Date.UTC(2027, 4, 22)),
        round: { academicYear: "2027/28" },
      },
    ]);
    await generateSchedule(tx as never, account, round);
    expect(tx.roundWindow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { scenario: "RA" } })
    );
    const year2 = (tx.bursaryScheduleEntry.create.mock.calls as unknown as unknown[][])[1][0] as {
      data: { scheduleYear: number; requiredBy: Date };
    };
    expect(year2.data.scheduleYear).toBe(2);
    expect(year2.data.requiredBy.toISOString().slice(0, 10)).toBe("2027-05-22");
  });
});

describe("rollingRedateWhere — what a Rounds-page save re-dates (Epic 21 R2)", () => {
  it("only that year's planned rolling-over rows: year ≥ 2, SCHEDULED, no round", () => {
    expect(rollingRedateWhere("2027/28")).toEqual({
      academicYear: "2027-28",
      scheduleYear: { gte: 2 },
      status: "SCHEDULED",
      roundId: null,
    });
  });

  it("never touches year-1 rows (prod's 2026-27 award rows are SCHEDULED with no round)", () => {
    const where = rollingRedateWhere("2026/27")!;
    const prodYear1 = { academicYear: "2026-27", scheduleYear: 1, status: "SCHEDULED", roundId: null };
    const matches =
      prodYear1.academicYear === where.academicYear &&
      prodYear1.scheduleYear >= where.scheduleYear.gte &&
      prodYear1.status === where.status &&
      prodYear1.roundId === where.roundId;
    expect(matches).toBe(false);
  });

  it("accepts either label form and refuses an unparseable one", () => {
    expect(rollingRedateWhere("2027/2028")?.academicYear).toBe("2027-28");
    expect(rollingRedateWhere("next year")).toBeNull();
  });
});
