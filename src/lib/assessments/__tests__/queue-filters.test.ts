import { describe, it, expect } from "vitest";
import {
  filterAssessmentQueueRows,
  academicYearOptions,
  parseDateBoundary,
} from "../queue-filters";
import {
  deriveBursaryStatus,
  type AssessmentQueueRow,
} from "@/lib/db/queries/assessments-queue";

// Charlotte's two worked examples (8 Sep 2026): Levi Amoah is a CLOSED account
// with a locked outcome; Langazye Kaluba is an ACTIVE account with a locked
// outcome for 2026/27.
function row(over: Partial<AssessmentQueueRow> = {}): AssessmentQueueRow {
  return {
    applicationId: "app-1",
    reference: "REF-1",
    childName: "Langazye Kaluba",
    school: "WHITGIFT",
    academicYear: "2026/27",
    status: "LOCKED",
    assigneeId: null,
    assigneeName: null,
    submittedAt: new Date("2026-06-15T09:00:00.000Z"),
    updatedAt: null,
    bursaryStatus: "ACTIVE",
    ...over,
  };
}

const kaluba = row();
const levi = row({
  applicationId: "app-2",
  reference: "REF-2",
  childName: "Levi Amoah",
  bursaryStatus: "CLOSED",
});
const trinityRow = row({
  applicationId: "app-3",
  reference: "REF-3",
  school: "TRINITY",
  academicYear: "2025/26",
  submittedAt: new Date("2025-06-15T09:00:00.000Z"),
});
const noAccount = row({
  applicationId: "app-4",
  reference: "REF-4",
  status: "IN_PROGRESS",
  bursaryStatus: null,
});
const all = [kaluba, levi, trinityRow, noAccount];

describe("filterAssessmentQueueRows", () => {
  it("returns everything when no filter is set", () => {
    expect(filterAssessmentQueueRows(all, {})).toHaveLength(4);
  });

  it("filters by bursary account status", () => {
    expect(
      filterAssessmentQueueRows(all, { bursaryStatus: "CLOSED" }).map((r) => r.childName)
    ).toEqual(["Levi Amoah"]);
  });

  it("excludes rows with no bursary account once a bursary status is chosen", () => {
    // An application never locked as an award has no account, so it is neither
    // active nor closed and must not pad a filtered list.
    const active = filterAssessmentQueueRows(all, { bursaryStatus: "ACTIVE" });
    expect(active.map((r) => r.applicationId)).not.toContain("app-4");
    expect(active).toHaveLength(2);
  });

  it("filters by round", () => {
    expect(
      filterAssessmentQueueRows(all, { academicYear: "2025/26" }).map((r) => r.reference)
    ).toEqual(["REF-3"]);
  });

  it("filters by school", () => {
    expect(filterAssessmentQueueRows(all, { school: "TRINITY" })).toHaveLength(1);
    expect(filterAssessmentQueueRows(all, { school: "WHITGIFT" })).toHaveLength(3);
  });

  it("composes every filter with AND", () => {
    expect(
      filterAssessmentQueueRows(all, {
        bursaryStatus: "ACTIVE",
        academicYear: "2026/27",
        school: "WHITGIFT",
      }).map((r) => r.childName)
    ).toEqual(["Langazye Kaluba"]);
  });

  it("returns nothing when filters cannot be satisfied together", () => {
    expect(
      filterAssessmentQueueRows(all, { school: "TRINITY", academicYear: "2026/27" })
    ).toHaveLength(0);
  });

  describe("submission date", () => {
    it("includes both bounds, so one day in both boxes selects that day", () => {
      const result = filterAssessmentQueueRows(all, {
        submittedFrom: parseDateBoundary("2026-06-15", "start"),
        submittedTo: parseDateBoundary("2026-06-15", "end"),
      });
      expect(result.map((r) => r.reference).sort()).toEqual(["REF-1", "REF-2", "REF-4"]);
    });

    it("an open-ended lower bound filters everything earlier out", () => {
      const result = filterAssessmentQueueRows(all, {
        submittedFrom: parseDateBoundary("2026-01-01", "start"),
      });
      expect(result.map((r) => r.reference)).not.toContain("REF-3");
    });

    it("an open-ended upper bound keeps only what is earlier", () => {
      const result = filterAssessmentQueueRows(all, {
        submittedTo: parseDateBoundary("2025-12-31", "end"),
      });
      expect(result.map((r) => r.reference)).toEqual(["REF-3"]);
    });

    it("excludes a row with no submission date once either bound is set", () => {
      const undated = row({ applicationId: "app-5", reference: "REF-5", submittedAt: null });
      const result = filterAssessmentQueueRows([...all, undated], {
        submittedFrom: parseDateBoundary("2020-01-01", "start"),
      });
      expect(result.map((r) => r.reference)).not.toContain("REF-5");
    });

    it("keeps an undated row when no date bound is set", () => {
      const undated = row({ applicationId: "app-5", reference: "REF-5", submittedAt: null });
      const result = filterAssessmentQueueRows([...all, undated], { school: "WHITGIFT" });
      expect(result.map((r) => r.reference)).toContain("REF-5");
    });
  });
});

describe("parseDateBoundary", () => {
  it("returns undefined for missing or malformed input", () => {
    expect(parseDateBoundary(undefined, "start")).toBeUndefined();
    expect(parseDateBoundary("", "start")).toBeUndefined();
    expect(parseDateBoundary("15/06/2026", "start")).toBeUndefined();
    expect(parseDateBoundary("2026-6-1", "start")).toBeUndefined();
  });

  it("anchors the start of the day and the end of the day", () => {
    expect(parseDateBoundary("2026-06-15", "start")?.toISOString()).toBe(
      "2026-06-15T00:00:00.000Z"
    );
    expect(parseDateBoundary("2026-06-15", "end")?.toISOString()).toBe(
      "2026-06-15T23:59:59.999Z"
    );
  });
});

describe("academicYearOptions", () => {
  it("lists each round once, newest first", () => {
    expect(academicYearOptions(all)).toEqual(["2026/27", "2025/26"]);
  });

  it("skips rows with no round and returns nothing for an empty list", () => {
    expect(academicYearOptions([row({ academicYear: null })])).toEqual([]);
    expect(academicYearOptions([])).toEqual([]);
  });
});

// ─── deriveBursaryStatus — her two worked examples ─────────────────────────

describe("deriveBursaryStatus", () => {
  it("her Kaluba case: an award lock creates the account, so it reads ACTIVE", () => {
    expect(deriveBursaryStatus("ACTIVE", "NEW_AWARD")).toBe("ACTIVE");
  });

  it("her Levi Amoah case: archived with no account still reads CLOSED", () => {
    // Close-and-archive never creates a bursary account, but she describes
    // Levi as "a closed account". The family's file is what she means.
    expect(deriveBursaryStatus(null, "CLOSED_ARCHIVED")).toBe("CLOSED");
  });

  it("a real closed account reads CLOSED", () => {
    expect(deriveBursaryStatus("CLOSED", "NEW_AWARD")).toBe("CLOSED");
  });

  it("an assessment still in flight with no account is undetermined", () => {
    expect(deriveBursaryStatus(null, "IN_PROGRESS")).toBeNull();
    expect(deriveBursaryStatus(null, "COMPLETED")).toBeNull();
    expect(deriveBursaryStatus(null, null)).toBeNull();
  });

  it("the account row wins over the assessment status when both exist", () => {
    // A reopened account is ACTIVE again even if an old assessment archived.
    expect(deriveBursaryStatus("ACTIVE", "CLOSED_ARCHIVED")).toBe("ACTIVE");
  });
});
