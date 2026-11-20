/**
 * Audit 20 Nov 2026 (finding 11) — a reference version dated for a later
 * academic year must not reach this year's assessments. On 20 Nov 2026 an
 * admin entering 2027/28 notional costs effective 2027-09-01 used to change
 * every 2026/27 assessment saved afterwards, because the loaders took the
 * newest row regardless of its date.
 */
import { describe, expect, it, vi } from "vitest";
import { getIncomeCategoryBands, getNotionalCostConfigs } from "../reference-tables";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
// What the assessment page passes for a 2026/27 round: 1 Sep 2027, exclusive.
const BEFORE_2026_27 = d("2027-09-01");
const BEFORE_2027_28 = d("2028-09-01");

/** Rows in the loader's own order (effectiveFrom desc), as Prisma returns them. */
function notionalTx() {
  const row = (effectiveFrom: string, amount: number) => ({
    id: `nc-${effectiveFrom}`,
    category: 1,
    costType: "ESSENTIALS",
    amount,
    effectiveFrom: d(effectiveFrom),
    createdAt: d(effectiveFrom),
  });
  return {
    notionalCostConfig: {
      findMany: vi.fn(async () => [
        row("2027-09-01", 30_000), // next year's version, entered early
        row("2026-09-06", 25_000), // an in-year respec (prod has one)
        row("2026-09-01", 24_000),
      ]),
    },
  };
}

describe("getNotionalCostConfigs — versions dated for a later year stay out", () => {
  it("a 2026/27 assessment keeps this year's newest version, not next year's", async () => {
    const rows = await getNotionalCostConfigs(notionalTx() as never, BEFORE_2026_27);
    expect(rows.map((r) => r.amount)).toEqual([25_000]);
  });

  it("a 2027/28 assessment gets the 2027/28 version", async () => {
    const rows = await getNotionalCostConfigs(notionalTx() as never, BEFORE_2027_28);
    expect(rows.map((r) => r.amount)).toEqual([30_000]);
  });

  it("an assessment in a year before every version still gets a set (the newest)", async () => {
    const rows = await getNotionalCostConfigs(notionalTx() as never, d("2026-09-01"));
    expect(rows.map((r) => r.amount)).toEqual([30_000]);
  });

  it("with no date (the settings screen) it shows the newest version, scheduled or not", async () => {
    const rows = await getNotionalCostConfigs(notionalTx() as never);
    expect(rows.map((r) => r.amount)).toEqual([30_000]);
  });
});

describe("band loaders use the same rule", () => {
  it("getIncomeCategoryBands ignores a generation dated for next year", async () => {
    const band = (effectiveFrom: string, feesBenchmarkPct: number) => ({
      id: `ib-${effectiveFrom}`,
      bandFloor: null,
      bandCeiling: null,
      category: 1,
      feesBenchmarkPct,
      effectiveFrom: d(effectiveFrom),
    });
    const tx = {
      incomeCategoryBand: {
        findMany: vi.fn(async () => [band("2026-09-08", 10), band("2027-09-01", 12)]),
      },
    };
    const rows = await getIncomeCategoryBands(tx as never, BEFORE_2026_27);
    expect(rows.map((r) => r.feesBenchmarkPct)).toEqual([10]);
  });
});
