import { describe, it, expect } from "vitest";
import { submittedDateRangeWhere } from "@/lib/db/queries/applications";

describe("submittedDateRangeWhere (Item 7.1)", () => {
  it("returns undefined when neither bound is set (no filter)", () => {
    expect(submittedDateRangeWhere(undefined, undefined)).toBeUndefined();
  });

  it("from-only: inclusive lower bound, no upper bound", () => {
    const from = new Date("2026-06-01T00:00:00.000Z");
    expect(submittedDateRangeWhere(from, undefined)).toEqual({
      submittedAt: { gte: from },
    });
  });

  it("to-only: inclusive upper bound, no lower bound", () => {
    const to = new Date("2026-06-30T23:59:59.999Z");
    expect(submittedDateRangeWhere(undefined, to)).toEqual({
      submittedAt: { lte: to },
    });
  });

  it("both bounds: inclusive range", () => {
    const from = new Date("2026-06-01T00:00:00.000Z");
    const to = new Date("2026-06-30T23:59:59.999Z");
    expect(submittedDateRangeWhere(from, to)).toEqual({
      submittedAt: { gte: from, lte: to },
    });
  });

  // Prisma/SQL null-comparison semantics: a `gte`/`lte` filter on `submittedAt`
  // never matches a NULL value (unsubmitted application), so an unsubmitted
  // row is excluded automatically whenever either bound above is active — no
  // explicit `submittedAt: { not: null }` is needed in the fragment.
  it("the returned fragment relies on gte/lte alone for null exclusion (no explicit not-null clause)", () => {
    const from = new Date("2026-06-01T00:00:00.000Z");
    const fragment = submittedDateRangeWhere(from, undefined);
    expect(fragment).toEqual({ submittedAt: { gte: from } });
    expect(Object.keys(fragment!.submittedAt as object)).not.toContain("not");
  });
});
