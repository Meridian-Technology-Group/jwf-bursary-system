import { describe, it, expect } from "vitest";
import { matchesQueueFilters, type QueueRowFilterFacts } from "@/lib/applications/queue-filter";

function row(overrides: Partial<QueueRowFilterFacts> = {}): QueueRowFilterFacts {
  return {
    reviewPhase: "SUBMITTED",
    round: { id: "round-1" },
    school: "WHITGIFT",
    reference: "APP-0001",
    leadApplicantName: "Jane Doe",
    leadApplicantEmail: "jane@example.com",
    ...overrides,
  };
}

describe("matchesQueueFilters (Items 1.1 / 1.3)", () => {
  it("matches everything when no filters are set", () => {
    expect(matchesQueueFilters(row(), {})).toBe(true);
  });

  it("filters by round id, and 'all' is a no-op", () => {
    expect(matchesQueueFilters(row(), { roundId: "round-1" })).toBe(true);
    expect(matchesQueueFilters(row(), { roundId: "round-2" })).toBe(false);
    expect(matchesQueueFilters(row(), { roundId: "all" })).toBe(true);
  });

  it("filters by school, and 'all' is a no-op", () => {
    expect(matchesQueueFilters(row(), { school: "WHITGIFT" })).toBe(true);
    expect(matchesQueueFilters(row(), { school: "TRINITY" })).toBe(false);
    expect(matchesQueueFilters(row(), { school: "all" })).toBe(true);
  });

  it("filters by a status multi-select (Item 1.3)", () => {
    expect(
      matchesQueueFilters(row({ reviewPhase: "PAUSED" }), {
        statuses: ["SUBMITTED", "PAUSED"],
      })
    ).toBe(true);
    expect(
      matchesQueueFilters(row({ reviewPhase: "COMPLETED" }), {
        statuses: ["SUBMITTED", "PAUSED"],
      })
    ).toBe(false);
    // Empty selection = no status filter.
    expect(matchesQueueFilters(row(), { statuses: [] })).toBe(true);
  });

  it("searches reference, lead applicant name and email case-insensitively", () => {
    expect(matchesQueueFilters(row(), { searchText: "app-0001" })).toBe(true);
    expect(matchesQueueFilters(row(), { searchText: "JANE" })).toBe(true);
    expect(matchesQueueFilters(row(), { searchText: "example.com" })).toBe(true);
    expect(matchesQueueFilters(row(), { searchText: "nomatch" })).toBe(false);
  });

  it("search does not throw when names are unrevealed (undefined)", () => {
    const bare = row({ leadApplicantName: undefined, leadApplicantEmail: undefined });
    expect(matchesQueueFilters(bare, { searchText: "app-0001" })).toBe(true);
    expect(matchesQueueFilters(bare, { searchText: "jane" })).toBe(false);
  });

  it("composes round + school + status + search with AND", () => {
    const r = row({ reviewPhase: "PAUSED", round: { id: "round-1" }, school: "TRINITY" });
    expect(
      matchesQueueFilters(r, {
        roundId: "round-1",
        school: "TRINITY",
        statuses: ["PAUSED"],
        searchText: "app-0001",
      })
    ).toBe(true);
    // Flip one criterion — the whole predicate must fail (AND, not OR).
    expect(
      matchesQueueFilters(r, {
        roundId: "round-1",
        school: "TRINITY",
        statuses: ["COMPLETED"],
        searchText: "app-0001",
      })
    ).toBe(false);
  });
});
