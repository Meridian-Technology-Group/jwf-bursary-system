import { describe, it, expect } from "vitest";

/**
 * CH-45 — the Submitted column's sort comparator.
 *
 * Charlotte asked for the Assessments list to reorder chronologically on
 * clicking the Submitted header. She initially thanked us for it, then corrected
 * herself: the sort she had seen was on the **Applications** page, not this one.
 *
 * The comparator is duplicated here rather than imported because the page is a
 * server component with `requireRole` at the top — importing it would drag the
 * auth and Prisma boundary into a unit test for four lines of ordering. If the
 * page's comparator changes, this drifts silently, so it is a deliberate
 * trade-off: the value here is pinning the NULL and direction behaviour, which
 * is where an ordering bug actually hides.
 */
type Row = { submittedAt: Date | null; ref: string };

function sortRows(rows: Row[], sort: "submitted_asc" | "submitted_desc"): Row[] {
  return [...rows].sort((a, b) => {
    const at = a.submittedAt?.getTime();
    const bt = b.submittedAt?.getTime();
    if (at === undefined && bt === undefined) return 0;
    if (at === undefined) return 1;
    if (bt === undefined) return -1;
    return sort === "submitted_asc" ? at - bt : bt - at;
  });
}

const d = (iso: string) => new Date(iso);

describe("CH-45 — Submitted column ordering", () => {
  const rows: Row[] = [
    { submittedAt: d("2026-08-20T10:00:00Z"), ref: "middle" },
    { submittedAt: null, ref: "unsubmitted" },
    { submittedAt: d("2026-08-24T13:05:00Z"), ref: "newest" },
    { submittedAt: d("2026-07-10T13:05:00Z"), ref: "oldest" },
  ];

  it("orders oldest first ascending", () => {
    expect(sortRows(rows, "submitted_asc").map((r) => r.ref)).toEqual([
      "oldest",
      "middle",
      "newest",
      "unsubmitted",
    ]);
  });

  it("orders newest first descending", () => {
    expect(sortRows(rows, "submitted_desc").map((r) => r.ref)).toEqual([
      "newest",
      "middle",
      "oldest",
      "unsubmitted",
    ]);
  });

  it("keeps unsubmitted rows last in BOTH directions", () => {
    // The point of the null handling: a row with no submission date has nothing
    // to order by, and it must not leap to the top when she flips direction.
    expect(sortRows(rows, "submitted_asc").at(-1)?.ref).toBe("unsubmitted");
    expect(sortRows(rows, "submitted_desc").at(-1)?.ref).toBe("unsubmitted");
  });

  it("is stable across several unsubmitted rows", () => {
    const many: Row[] = [
      { submittedAt: null, ref: "a" },
      { submittedAt: d("2026-08-01T00:00:00Z"), ref: "dated" },
      { submittedAt: null, ref: "b" },
    ];
    expect(sortRows(many, "submitted_asc").map((r) => r.ref)).toEqual([
      "dated",
      "a",
      "b",
    ]);
  });

  it("does not mutate the caller's array", () => {
    const original = [...rows];
    sortRows(rows, "submitted_desc");
    expect(rows).toEqual(original);
  });

  it("treats an identical timestamp as a tie rather than reordering", () => {
    const same = d("2026-08-20T10:00:00Z");
    const tied: Row[] = [
      { submittedAt: same, ref: "first" },
      { submittedAt: same, ref: "second" },
    ];
    expect(sortRows(tied, "submitted_asc").map((r) => r.ref)).toEqual([
      "first",
      "second",
    ]);
  });
});
