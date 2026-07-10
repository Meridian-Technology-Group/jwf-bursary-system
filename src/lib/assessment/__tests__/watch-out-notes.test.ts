import { describe, it, expect } from "vitest";
import {
  selectPreviousWatchOutNotes,
  type WatchOutCandidate,
} from "@/lib/assessment/watch-out-notes";

function candidate(overrides: Partial<WatchOutCandidate>): WatchOutCandidate {
  return {
    applicationId: "app-prev",
    academicYear: "2025/26",
    status: "COMPLETED",
    completedAt: new Date("2026-01-01T00:00:00Z"),
    watchOutNotes: "Keep an eye on the second income stream.",
    ...overrides,
  };
}

describe("selectPreviousWatchOutNotes — CALC-10 assessor's-wizard read path", () => {
  it("returns null when there are no candidates", () => {
    expect(selectPreviousWatchOutNotes([], "app-current")).toBeNull();
  });

  it("returns null when the only candidate IS the current application", () => {
    const candidates = [candidate({ applicationId: "app-current" })];
    expect(selectPreviousWatchOutNotes(candidates, "app-current")).toBeNull();
  });

  it("returns null when the previous assessment is not COMPLETED", () => {
    const candidates = [candidate({ status: "IN_PROGRESS" })];
    expect(selectPreviousWatchOutNotes(candidates, "app-current")).toBeNull();
  });

  it("returns null when the previous COMPLETED assessment left a blank note", () => {
    const candidates = [
      candidate({ watchOutNotes: null }),
      candidate({ applicationId: "app-prev-2", watchOutNotes: "   " }),
    ];
    expect(selectPreviousWatchOutNotes(candidates, "app-current")).toBeNull();
  });

  it("selects the previous completed assessment's note", () => {
    const candidates = [candidate({})];
    const result = selectPreviousWatchOutNotes(candidates, "app-current");
    expect(result).toEqual({
      applicationId: "app-prev",
      academicYear: "2025/26",
      watchOutNotes: "Keep an eye on the second income stream.",
    });
  });

  it("picks the MOST RECENT completed assessment by completedAt when several exist", () => {
    const candidates = [
      candidate({
        applicationId: "app-2023",
        academicYear: "2023/24",
        completedAt: new Date("2024-01-01T00:00:00Z"),
        watchOutNotes: "Older note.",
      }),
      candidate({
        applicationId: "app-2025",
        academicYear: "2025/26",
        completedAt: new Date("2026-01-01T00:00:00Z"),
        watchOutNotes: "Newest note.",
      }),
      candidate({
        applicationId: "app-2024",
        academicYear: "2024/25",
        completedAt: new Date("2025-01-01T00:00:00Z"),
        watchOutNotes: "Middle note.",
      }),
    ];
    const result = selectPreviousWatchOutNotes(candidates, "app-current");
    expect(result).toEqual({
      applicationId: "app-2025",
      academicYear: "2025/26",
      watchOutNotes: "Newest note.",
    });
  });

  it("excludes the current application even when it is COMPLETED with a note", () => {
    const candidates = [
      candidate({ applicationId: "app-current", watchOutNotes: "Should never surface." }),
      candidate({ applicationId: "app-prev", watchOutNotes: "Prior year note." }),
    ];
    const result = selectPreviousWatchOutNotes(candidates, "app-current");
    expect(result?.applicationId).toBe("app-prev");
    expect(result?.watchOutNotes).toBe("Prior year note.");
  });

  it("accepts string completedAt values (as returned across a JSON boundary)", () => {
    const candidates = [
      candidate({ completedAt: "2026-01-01T00:00:00.000Z" as unknown as Date }),
    ];
    const result = selectPreviousWatchOutNotes(candidates, "app-current");
    expect(result?.watchOutNotes).toBe("Keep an eye on the second income stream.");
  });

  it("treats a null/unparseable completedAt as sorting last (never chosen over a dated row)", () => {
    const candidates = [
      candidate({ applicationId: "app-undated", completedAt: null, watchOutNotes: "Undated note." }),
      candidate({ applicationId: "app-dated", completedAt: new Date("2020-01-01T00:00:00Z"), watchOutNotes: "Dated note." }),
    ];
    const result = selectPreviousWatchOutNotes(candidates, "app-current");
    expect(result?.applicationId).toBe("app-dated");
  });

  it("is a pure function — does not mutate the input array", () => {
    const candidates = [
      candidate({ applicationId: "a", completedAt: new Date("2024-01-01T00:00:00Z") }),
      candidate({ applicationId: "b", completedAt: new Date("2026-01-01T00:00:00Z") }),
    ];
    const copy = [...candidates];
    selectPreviousWatchOutNotes(candidates, "app-current");
    expect(candidates).toEqual(copy);
  });
});
