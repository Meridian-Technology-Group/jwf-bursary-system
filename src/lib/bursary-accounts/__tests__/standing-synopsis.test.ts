import { describe, it, expect } from "vitest";
import { yearEntryFromLock, orderSynopsisTimeline } from "../standing-synopsis";

describe("yearEntryFromLock (Epic 21 #6)", () => {
  it("carries the trimmed synopsis and the year", () => {
    expect(yearEntryFromLock({ synopsis: "  Notes  ", academicYear: "2026/27" })).toEqual({
      body: "Notes",
      academicYear: "2026/27",
    });
  });

  it("is null for a blank or missing synopsis", () => {
    expect(yearEntryFromLock({ synopsis: "   ", academicYear: "2026/27" })).toBeNull();
    expect(yearEntryFromLock({ synopsis: null, academicYear: "2026/27" })).toBeNull();
  });
});

describe("orderSynopsisTimeline", () => {
  const e = (id: string, iso: string, kind: "YEAR" | "NOTE" = "NOTE") => ({
    id,
    kind,
    academicYear: kind === "YEAR" ? "2026/27" : null,
    body: id,
    createdAt: new Date(iso),
  });

  it("is newest first, by when the entry was created", () => {
    const ordered = orderSynopsisTimeline([
      e("year-2026", "2026-10-01T00:00:00Z", "YEAR"),
      e("note-new", "2027-02-01T00:00:00Z"),
      e("note-old", "2026-11-01T00:00:00Z"),
    ]);
    expect(ordered.map((x) => x.id)).toEqual(["note-new", "note-old", "year-2026"]);
  });

  it("breaks a tie on id so the order is stable", () => {
    const ordered = orderSynopsisTimeline([e("b", "2026-11-01T00:00:00Z"), e("a", "2026-11-01T00:00:00Z")]);
    expect(ordered.map((x) => x.id)).toEqual(["a", "b"]);
  });
});
