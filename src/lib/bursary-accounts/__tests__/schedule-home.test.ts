// Epic 14 D3 (CG-02) — Bursary Application Schedule row-state machine.

import { describe, expect, it } from "vitest";
import {
  buildScheduleHomeRows,
  type ScheduleHomeEntryInput,
  type ScheduleHomeRoundInput,
} from "../schedule-home";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const round2027: ScheduleHomeRoundInput = {
  openDate: d("2027-04-12"),
  closeDate: d("2027-08-19"),
  decisionDate: d("2027-07-01"),
  defaultSubmissionDeadlineNew: null,
  defaultSubmissionDeadlineRolling: null,
  windows: [],
};

function entry(
  overrides: Partial<ScheduleHomeEntryInput>
): ScheduleHomeEntryInput {
  return {
    scheduleYear: 2,
    academicYear: "2027-28",
    availableOn: null,
    requiredBy: null,
    status: "SCHEDULED",
    round: null,
    application: null,
    ...overrides,
  };
}

const TODAY = d("2027-05-01"); // inside the RA window (12 Apr – 22 May 2027)

describe("buildScheduleHomeRows — states", () => {
  it("SUBMITTED when the year's application is in", () => {
    const [row] = buildScheduleHomeRows({
      entryYearGroup: "Y7",
      today: TODAY,
      entries: [
        entry({
          round: round2027,
          application: {
            id: "app-1",
            formStatus: "SUBMITTED",
            applicationType: "ROLLING_OVER",
            submissionDeadlineAt: null,
          },
        }),
      ],
    });
    expect(row.state).toBe("submitted");
    expect(row.stateLabel).toBe("SUBMITTED");
    expect(row.applicationId).toBeNull();
  });

  it("SUBMITTED when the entry itself is RECEIVED/COMPLETE (office-processed)", () => {
    const [row] = buildScheduleHomeRows({
      entryYearGroup: "Y7",
      today: TODAY,
      entries: [entry({ status: "RECEIVED" })],
    });
    expect(row.state).toBe("submitted");
  });

  it("CONTINUE with an in-flight draft, carrying the application id", () => {
    const [row] = buildScheduleHomeRows({
      entryYearGroup: "Y7",
      today: TODAY,
      entries: [
        entry({
          round: round2027,
          application: {
            id: "app-2",
            formStatus: "IN_PROGRESS",
            applicationType: "ROLLING_OVER",
            submissionDeadlineAt: null,
          },
        }),
      ],
    });
    expect(row.state).toBe("continue");
    expect(row.stateLabel).toBe("CONTINUE");
    expect(row.applicationId).toBe("app-2");
  });

  it("START APPLICATION inside the open window with a round and no application", () => {
    const [row] = buildScheduleHomeRows({
      entryYearGroup: "Y7",
      today: TODAY,
      entries: [entry({ round: round2027 })],
    });
    expect(row.state).toBe("start");
    expect(row.stateLabel).toBe("START APPLICATION");
  });

  it("LOCKED before the opening date (future year)", () => {
    const [row] = buildScheduleHomeRows({
      entryYearGroup: "Y7",
      today: d("2026-09-01"), // before the derived RA opening 12 Apr 2027
      entries: [entry({})],
    });
    expect(row.state).toBe("locked");
  });

  it("LOCKED in-window when no round exists to apply into", () => {
    const [row] = buildScheduleHomeRows({
      entryYearGroup: "Y7",
      today: TODAY,
      entries: [entry({ round: null })],
    });
    expect(row.state).toBe("locked");
  });

  it("CLOSED after the deadline with nothing submitted", () => {
    const [row] = buildScheduleHomeRows({
      entryYearGroup: "Y7",
      today: d("2027-06-15"), // after 22 May derived RA deadline
      entries: [entry({})],
    });
    expect(row.state).toBe("closed");
  });

  it("deadline day itself still counts as open (end-of-day boundary)", () => {
    const [row] = buildScheduleHomeRows({
      entryYearGroup: "Y7",
      today: d("2027-05-22"),
      entries: [entry({ round: round2027 })],
    });
    expect(row.state).toBe("start");
  });
});

describe("buildScheduleHomeRows — dates", () => {
  it("entry availableOn/requiredBy win over everything", () => {
    const [row] = buildScheduleHomeRows({
      entryYearGroup: "Y7",
      today: TODAY,
      entries: [
        entry({
          availableOn: d("2027-04-01"),
          requiredBy: d("2027-06-01"),
          round: round2027,
        }),
      ],
    });
    expect(row.openingDate).toEqual(d("2027-04-01"));
    expect(row.submissionDeadline).toEqual(d("2027-06-01"));
  });

  it("a stored RA window fills the null rolling default (D2 precedence)", () => {
    const [row] = buildScheduleHomeRows({
      entryYearGroup: "Y7",
      today: TODAY,
      entries: [
        entry({
          round: {
            ...round2027,
            windows: [
              {
                scenario: "RA",
                opensOn: d("2027-04-14"),
                submitBy: d("2027-05-28"),
                defaultTaxYear: null,
              },
            ],
          },
        }),
      ],
    });
    expect(row.openingDate).toEqual(d("2027-04-14"));
    // effectiveSubmissionDeadline end-of-days the round default.
    expect(row.submissionDeadline?.toISOString().slice(0, 10)).toBe(
      "2027-05-28"
    );
  });

  it("derived RA defaults fill when no round exists (informational row)", () => {
    const [row] = buildScheduleHomeRows({
      entryYearGroup: "Y7",
      today: TODAY,
      entries: [entry({})],
    });
    expect(row.openingDate).toEqual(d("2027-04-12"));
    expect(row.submissionDeadline).toEqual(d("2027-05-22"));
    expect(row.awardCommunicationDate).toBeNull();
  });

  it("award news comes from the round's decision date", () => {
    const [row] = buildScheduleHomeRows({
      entryYearGroup: "Y7",
      today: TODAY,
      entries: [entry({ round: round2027 })],
    });
    expect(row.awardCommunicationDate).toEqual(d("2027-07-01"));
  });
});

describe("buildScheduleHomeRows — labelling", () => {
  it("derives school year from the entry group + schedule year; OTHER → null", () => {
    const rows = buildScheduleHomeRows({
      entryYearGroup: "Y7",
      today: TODAY,
      entries: [
        entry({ scheduleYear: 1, academicYear: "2026-27" }),
        entry({ scheduleYear: 2, academicYear: "2027-28" }),
      ],
    });
    expect(rows.map((r) => r.schoolYear)).toEqual([7, 8]);
    expect(rows.map((r) => r.academicYear)).toEqual(["2026-27", "2027-28"]);

    const [other] = buildScheduleHomeRows({
      entryYearGroup: "OTHER",
      today: TODAY,
      entries: [entry({})],
    });
    expect(other.schoolYear).toBeNull();
  });

  it("year 1 is treated as NEW; later years as ROLLING_OVER (typed deadline)", () => {
    const typedRound: ScheduleHomeRoundInput = {
      ...round2027,
      defaultSubmissionDeadlineNew: d("2027-08-01"),
      defaultSubmissionDeadlineRolling: d("2027-05-10"),
    };
    const rows = buildScheduleHomeRows({
      entryYearGroup: "Y7",
      today: TODAY,
      entries: [
        entry({ scheduleYear: 1, academicYear: "2027-28", round: typedRound }),
        entry({ scheduleYear: 2, academicYear: "2027-28", round: typedRound }),
      ],
    });
    expect(rows[0].submissionDeadline?.toISOString().slice(0, 10)).toBe(
      "2027-08-01"
    );
    expect(rows[1].submissionDeadline?.toISOString().slice(0, 10)).toBe(
      "2027-05-10"
    );
  });
});
