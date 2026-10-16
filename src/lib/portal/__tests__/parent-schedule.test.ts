import { describe, it, expect } from "vitest";
import {
  parentScheduleStatus,
  scheduleRowsForParent,
  type ParentScheduleAccountInput,
  type ParentScheduleApplicationInput,
  type ParentScheduleEntryInput,
} from "../parent-schedule";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const TODAY = new Date("2026-10-14T12:00:00Z");

function entry(over: Partial<ParentScheduleEntryInput> = {}): ParentScheduleEntryInput {
  return {
    scheduleYear: 1,
    academicYear: "2026-27",
    status: "SCHEDULED",
    availableOn: d("2026-08-21"),
    requiredBy: d("2026-11-30"),
    receivedOn: null,
    applicationId: null,
    ...over,
  };
}

function app(over: Partial<ParentScheduleApplicationInput> = {}): ParentScheduleApplicationInput {
  return {
    id: "app-1",
    childName: "Alex Doe",
    bursaryAccountId: "acc-1",
    academicYear: "2026/27",
    formStatus: "IN_PROGRESS",
    submittedAt: null,
    submissionDeadlineAt: null,
    migrationSource: null,
    applicationType: "NEW",
    updatedAt: d("2026-10-01"),
    ...over,
  };
}

function account(over: Partial<ParentScheduleAccountInput> = {}): ParentScheduleAccountInput {
  return {
    id: "acc-1",
    childName: "Alex Doe",
    school: "TRINITY",
    entryYearGroup: "Y8",
    entries: [entry()],
    applications: [],
    rejections: [],
    completions: new Map(),
    ...over,
  };
}

describe("scheduleRowsForParent (Epic 22 P5)", () => {
  it("TS-NOWS01 shape: a migrated year 1, then later years Scheduled with the round's dates", () => {
    const rows = scheduleRowsForParent(
      account({
        entries: [
          entry({ status: "COMPLETE", applicationId: "gt-1" }),
          entry({
            scheduleYear: 2,
            academicYear: "2027-28",
            availableOn: d("2027-04-15"),
            requiredBy: d("2027-05-22"),
          }),
        ],
        applications: [
          app({
            id: "gt-1",
            migrationSource: "GRANT_TRACKER",
            applicationType: "ROLLING_OVER",
            formStatus: "SUBMITTED",
            submittedAt: new Date("2026-05-19T10:30:00Z"),
          }),
        ],
      }),
      TODAY
    );
    expect(rows.map((r) => [r.academicYear, r.schoolYear, r.status, r.completion])).toEqual([
      ["2026-27", 8, "Submitted", "100% completed"],
      ["2027-28", 9, "Scheduled", "—"],
    ]);
    // Her 15 Oct answer: the GT renewal window and the GT submission date.
    expect(rows[0]).toMatchObject({
      opensOn: d("2026-04-15"),
      closesOn: d("2026-05-21"),
      submitBy: d("2026-05-23"),
      hasOwnDeadline: false,
      submissionDate: new Date("2026-05-19T10:30:00Z"),
    });
    expect(rows[1]).toMatchObject({
      opensOn: d("2027-04-15"),
      closesOn: d("2027-05-22"),
      submitBy: d("2027-05-22"),
      hasOwnDeadline: false,
    });
  });

  it("a new Grant Tracker family: opened 7 days before its GT submission date, closed and due on it", () => {
    const [row] = scheduleRowsForParent(
      account({
        entries: [entry({ status: "COMPLETE", applicationId: "gt-1" })],
        applications: [
          app({
            id: "gt-1",
            migrationSource: "GRANT_TRACKER",
            formStatus: "SUBMITTED",
            // 23:30 UTC on 3 Mar is still 3 Mar in London (GMT).
            submittedAt: new Date("2026-03-03T23:30:00Z"),
          }),
        ],
      }),
      TODAY
    );
    expect(row).toMatchObject({
      opensOn: d("2026-02-24"),
      closesOn: d("2026-03-03"),
      submitBy: d("2026-03-03"),
      hasOwnDeadline: false,
      status: "Submitted",
      completion: "100% completed",
      submissionDate: new Date("2026-03-03T23:30:00Z"),
    });
  });

  it("a Grant Tracker year reads Submitted even when its row is still SCHEDULED (prod's year-1 rows)", () => {
    const [row] = scheduleRowsForParent(
      account({
        applications: [
          app({
            migrationSource: "GRANT_TRACKER",
            applicationType: "ROLLING_OVER",
            formStatus: "SUBMITTED",
            submittedAt: d("2026-05-20"),
          }),
        ],
      }),
      TODAY
    );
    expect(row.status).toBe("Submitted");
    expect(row.closesOn).toEqual(d("2026-05-21"));
  });

  it("prod's 2026-27 shape: the stale 17 Sep NA window never shows — the row's own 30 Nov does", () => {
    // Prod (14 Oct): year-1 rows store 21 Aug / 30 Nov and link no round; the
    // round's NA_CURRENT window says 17 Sep. Dates come from the row only.
    const [row] = scheduleRowsForParent(account(), TODAY);
    expect(row.closesOn).toEqual(d("2026-11-30"));
    expect(row.submitBy).toEqual(d("2026-11-30"));
    for (const date of [row.opensOn, row.closesOn, row.submitBy]) {
      expect(date?.toISOString().slice(0, 10)).not.toBe("2026-09-17");
    }
    expect(row.status).toBe("Open, not started");
  });

  it("a draft shows P1's completion and the family's own deadline when extended", () => {
    const [row] = scheduleRowsForParent(
      account({
        applications: [app({ submissionDeadlineAt: new Date("2026-12-14T23:59:00Z") })],
        completions: new Map([["app-1", 62.5]]),
      }),
      TODAY
    );
    expect(row).toMatchObject({
      status: "In progress",
      completion: "62.5%",
      closesOn: d("2026-11-30"),
      submitBy: new Date("2026-12-14T23:59:00Z"),
      hasOwnDeadline: true,
    });
  });

  it("a submitted year keeps its original date, also once assessed or paused (D-2)", () => {
    const submittedAt = new Date("2026-10-10T09:00:00Z");
    for (const status of ["RECEIVED", "COMPLETE"] as const) {
      const [row] = scheduleRowsForParent(
        account({
          entries: [entry({ status, applicationId: "app-1", receivedOn: d("2026-10-10") })],
          applications: [app({ formStatus: "SUBMITTED", submittedAt })],
        }),
        TODAY
      );
      expect(row).toMatchObject({
        status: "Submitted",
        completion: "100% completed",
        submissionDate: submittedAt,
      });
    }
  });

  it("Reject and restart: Submitted → Rejected → the new attempt at 0% (D-1, D-19)", () => {
    const rows = scheduleRowsForParent(
      account({
        entries: [entry({ applicationId: "app-2" })],
        applications: [app({ id: "app-2", formStatus: "CREATED" })],
        rejections: [
          {
            academicYear: "2026/27",
            submittedAt: new Date("2026-10-01T10:00:00Z"),
            rejectedAt: new Date("2026-10-05T10:00:00Z"),
          },
        ],
        completions: new Map([["app-2", 0]]),
      }),
      TODAY
    );
    expect(rows.map((r) => [r.status, r.completion, r.submissionDate?.toISOString() ?? null])).toEqual([
      ["Submitted", "100% completed", "2026-10-01T10:00:00.000Z"],
      ["Rejected", "100% completed", "2026-10-05T10:00:00.000Z"],
      ["Open, not started", "0%", null],
    ]);
    // The dates repeat on every row of the year, as in her example.
    expect(new Set(rows.map((r) => r.closesOn?.toISOString())).size).toBe(1);
  });

  it("two rejections in a year: oldest first, then the newest attempt", () => {
    const rows = scheduleRowsForParent(
      account({
        applications: [app({ id: "app-3", formStatus: "SUBMITTED", submittedAt: d("2026-10-12") })],
        entries: [entry({ status: "RECEIVED", applicationId: "app-3" })],
        rejections: [
          { academicYear: "2026/27", submittedAt: d("2026-10-06"), rejectedAt: d("2026-10-08") },
          { academicYear: "2026/27", submittedAt: d("2026-10-01"), rejectedAt: d("2026-10-03") },
        ],
      }),
      TODAY
    );
    expect(rows.map((r) => [r.status, r.submissionDate?.toISOString().slice(0, 10)])).toEqual([
      ["Submitted", "2026-10-01"],
      ["Rejected", "2026-10-03"],
      ["Submitted", "2026-10-06"],
      ["Rejected", "2026-10-08"],
      ["Submitted", "2026-10-12"],
    ]);
  });

  it("a rejection in a year hidden from the family is not shown", () => {
    const rows = scheduleRowsForParent(
      account({
        rejections: [
          { academicYear: "2027/28", submittedAt: d("2027-05-01"), rejectedAt: d("2027-05-02") },
        ],
      }),
      TODAY
    );
    expect(rows).toHaveLength(1);
  });

  it("matches the original NEW form by the child's name when it isn't linked to the account", () => {
    const [row] = scheduleRowsForParent(
      account({
        applications: [
          app({ bursaryAccountId: null, childName: "alex  doe", formStatus: "SUBMITTED", submittedAt: d("2026-09-01") }),
        ],
      }),
      TODAY
    );
    expect(row.status).toBe("Submitted");
  });

  it("a past year with nothing submitted reads Not submitted", () => {
    const [row] = scheduleRowsForParent(
      account({ entries: [entry({ academicYear: "2025-26", availableOn: d("2025-04-15"), requiredBy: d("2025-05-21") })] }),
      TODAY
    );
    expect(row.status).toBe("Not submitted");
  });
});

describe("parentScheduleStatus (D-12)", () => {
  const base = { opensOn: d("2026-08-21"), submitBy: d("2026-11-30"), today: TODAY, completion: null };

  it("a RECEIVED year with no form here reads Submitted on its received date", () => {
    expect(
      parentScheduleStatus({ ...base, entry: { status: "RECEIVED", receivedOn: d("2026-10-02") }, application: null })
    ).toEqual({ status: "Submitted", completion: "100% completed", submissionDate: d("2026-10-02") });
  });

  it("a created form with nothing in it is Open, not started", () => {
    expect(
      parentScheduleStatus({
        ...base,
        entry: { status: "SCHEDULED", receivedOn: null },
        application: app({ formStatus: "CREATED" }),
      }).status
    ).toBe("Open, not started");
  });
});
