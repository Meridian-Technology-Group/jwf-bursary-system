import { describe, it, expect } from "vitest";
import {
  filterAssessmentQueueRows,
  academicYearOptions,
  parseDateBoundary,
  matchesAssessmentSearch,
  matchesOnlyByLeadApplicant,
  sortAssessmentQueueRows,
} from "../queue-filters";
import type { AssessmentQueueRow } from "@/lib/db/queries/assessments-queue";

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
    leadApplicantName: "Grace Kaluba",
    leadApplicantEmail: "grace.kaluba@example.com",
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

// ─── the bursary column reads the account row only ─────────────────────────
//
// Charlotte, 10 Sep 2026, correcting her own Levi Amoah example: a case closed
// before it ever became a bursary account has NO account status, and the
// closed-and-archived meaning belongs to the assessment status column.

describe("bursaryStatus on a queue row", () => {
  it("an archived assessment with no account is not a closed account", () => {
    const archivedNoAccount = row({
      childName: "Levi Amoah",
      status: "LOCKED",
      bursaryStatus: null,
    });
    expect(archivedNoAccount.bursaryStatus).toBeNull();
    // and it must not be picked up by either bursary-status filter
    expect(filterAssessmentQueueRows([archivedNoAccount], { bursaryStatus: "CLOSED" })).toHaveLength(0);
    expect(filterAssessmentQueueRows([archivedNoAccount], { bursaryStatus: "ACTIVE" })).toHaveLength(0);
  });

  it("a real closed account still filters as CLOSED", () => {
    const closed = row({ bursaryStatus: "CLOSED" });
    expect(filterAssessmentQueueRows([closed], { bursaryStatus: "CLOSED" })).toHaveLength(1);
  });
});

// Charlotte, 10 Oct 2026: a search box on the Assessments list, and the
// Reference column sortable A–Z.
describe("search (matchesAssessmentSearch / filter search)", () => {
  const migrated = row({
    applicationId: "app-5",
    reference: "TS - ALI04 - ALI, Mir",
    childName: "Mir Ali",
    leadApplicantName: "Sara Ali",
    leadApplicantEmail: "s.ali@example.com",
  });

  it("matches the reference, child name, lead applicant name and email, ignoring case", () => {
    expect(matchesAssessmentSearch(migrated, "ali04")).toBe(true);
    expect(matchesAssessmentSearch(migrated, "MIR ALI")).toBe(true);
    expect(matchesAssessmentSearch(migrated, "sara")).toBe(true);
    expect(matchesAssessmentSearch(migrated, "s.ali@")).toBe(true);
    expect(matchesAssessmentSearch(migrated, "kaluba")).toBe(false);
  });

  it("treats a blank or whitespace query as no filter", () => {
    expect(matchesAssessmentSearch(migrated, undefined)).toBe(true);
    expect(matchesAssessmentSearch(migrated, "   ")).toBe(true);
  });

  it("copes with a row that has no lead applicant details", () => {
    const bare = row({ leadApplicantName: null, leadApplicantEmail: null });
    expect(matchesAssessmentSearch(bare, "grace")).toBe(false);
    expect(matchesAssessmentSearch(bare, "REF-1")).toBe(true);
  });

  it("composes with the other filters (AND)", () => {
    expect(
      filterAssessmentQueueRows([...all, migrated], { search: "ali", school: "WHITGIFT" }).map(
        (r) => r.applicationId
      )
    ).toEqual(["app-5"]);
    expect(filterAssessmentQueueRows([...all, migrated], { search: "ali", school: "TRINITY" })).toEqual([]);
  });

  it("flags a match that came only through the parent's name or email", () => {
    expect(matchesOnlyByLeadApplicant(migrated, "sara")).toBe(true);
    expect(matchesOnlyByLeadApplicant(migrated, "ali04")).toBe(false); // the reference matched
    expect(matchesOnlyByLeadApplicant(migrated, "mir")).toBe(false); // the child's name matched
    expect(matchesOnlyByLeadApplicant(migrated, "nobody")).toBe(false);
    expect(matchesOnlyByLeadApplicant(migrated, undefined)).toBe(false);
  });
});

describe("sortAssessmentQueueRows — Reference A–Z / Z–A", () => {
  const refs = ["TS-PARA02-X", "TS - ALI04 - ALI", "OP-ALI04-ALI", "ts-adam10", "TS-ADAM2"];
  const rows = refs.map((reference, i) => row({ applicationId: `a${i}`, reference }));

  it("sorts A–Z ignoring spacing and case, numbers in numeric order", () => {
    expect(sortAssessmentQueueRows(rows, "reference_asc").map((r) => r.reference)).toEqual([
      "OP-ALI04-ALI",
      "TS-ADAM2",
      "ts-adam10",
      "TS - ALI04 - ALI",
      "TS-PARA02-X",
    ]);
  });

  it("sorts Z–A as the exact reverse", () => {
    expect(sortAssessmentQueueRows(rows, "reference_desc").map((r) => r.reference)).toEqual(
      sortAssessmentQueueRows(rows, "reference_asc").map((r) => r.reference).reverse()
    );
  });

  it("leaves the query order alone when no sort is chosen, and never mutates its input", () => {
    const before = rows.map((r) => r.reference);
    expect(sortAssessmentQueueRows(rows, undefined).map((r) => r.reference)).toEqual(before);
    sortAssessmentQueueRows(rows, "reference_desc");
    expect(rows.map((r) => r.reference)).toEqual(before);
  });
});
