/**
 * Charlotte, 17 Oct 2026 — the debt shortfall table splits by the sign of NDI,
 * and two lifestyle-squeeze tables get a new version. Pins the migration to
 * the seed module and the per-table versioning the split relies on.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { latestGenerationPerTable } from "../reference-tables";
import {
  LIFESTYLE_BELOW_ZERO_LABELS,
  debtShortfallBandsNdiNegative,
  lifestyleSqueezeBandsOct17,
} from "../../../../../prisma/seed-data/profiling-reference";

const sql = readFileSync(
  resolve(__dirname, "../../../../../prisma/migrations/20261017150000_debt_shortfall_ndi_split/migration.sql"),
  "utf8",
);

describe("per-table versioning", () => {
  const d = (s: string) => new Date(s);
  it("a new version of one table does not hide the others", () => {
    const rows = [
      { t: "A", effectiveFrom: d("2026-09-11"), v: 1 },
      { t: "B", effectiveFrom: d("2026-09-11"), v: 2 },
      { t: "A", effectiveFrom: d("2026-10-17"), v: 3 },
    ];
    expect(latestGenerationPerTable(rows, (r) => r.t).map((r) => r.v).sort()).toEqual([2, 3]);
  });
});

describe("migration 20261017150000 matches the seed module", () => {
  it("seeds every row of her table (1)", () => {
    expect(debtShortfallBandsNdiNegative).toHaveLength(7);
    for (const b of debtShortfallBandsNdiNegative) {
      expect(sql).toContain(`'${b.statusLabel}'`);
      expect(sql).toContain(`${b.floorGbp ?? "NULL"}`);
    }
    expect(sql).toContain("DATE '2026-10-17'");
  });
  it("gives the two no-debt squeeze tables her below-0% labels, only where they read n/a", () => {
    for (const label of Object.values(LIFESTYLE_BELOW_ZERO_LABELS)) expect(sql).toContain(`'${label}'`);
    expect(sql).toContain(`"status_label" = 'n/a'`);
    const bottom = lifestyleSqueezeBandsOct17.filter((b) => b.ratioFloor === null);
    expect(bottom.map((b) => b.statusLabel).sort()).toEqual(Object.values(LIFESTYLE_BELOW_ZERO_LABELS).sort());
    // Only the bottom row changes: no other row of the new version reads her labels.
    expect(lifestyleSqueezeBandsOct17.filter((b) => b.ratioFloor !== null).some((b) => Object.values<string>(LIFESTYLE_BELOW_ZERO_LABELS).includes(b.statusLabel))).toBe(false);
  });
});
