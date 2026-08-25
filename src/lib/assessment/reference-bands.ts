/**
 * CALC-01 — Reference-band resolution (pure, DB-free).
 *
 * Every "profiling" / notional-grid reference table (Appendix B, C.1–C.5) is
 * versioned by `effectiveFrom` like the other reference tables (mirrors
 * `fee-year.ts`'s split: the DB read + latest-effective dedup lives in
 * `src/lib/db/queries/reference-tables.ts`, which then delegates the actual
 * "which band does this value fall in" decision to the pure resolvers below
 * so the rule is unit-tested without a database).
 *
 * ## Band resolution convention
 *
 * A band row has a `floor` and a `ceiling`, either of which may be `null` to
 * mean "no bound in that direction" (open-ended). Bands are resolved in
 * ascending `ceiling` order (a row with `ceiling: null` sorts last, i.e. it is
 * the top/open-ended band) and the FIRST row whose `[floor, ceiling]` range
 * contains the value wins. Concretely:
 *
 *   - Both `floor` and `ceiling` are INCLUSIVE by default
 *     (`floor <= value <= ceiling`).
 *   - `IncomeCategoryBand` (Appendix C.1) is the one exception: the appendix
 *     explicitly documents its bands as "inclusive of floor, exclusive of
 *     ceiling", so its resolver passes `ceilingExclusive: true`
 *     (`floor <= value < ceiling`).
 *   - Because resolution walks bands in ascending-ceiling order and returns
 *     the FIRST match, a value that sits exactly on a shared boundary
 *     between two adjacent, non-overlapping bands always resolves to the
 *     LOWER band. This is what lets a contiguous "ladder" of bands
 *     (0, 0.1, 0.3, 0.5, 0.8, 1, 2, 3 …) be stored as plain boundary values
 *     with no epsilon fudging anywhere — see `DEBT_RATIO_BANDS` fixtures in
 *     the sibling test file for a worked example.
 *   - The one place an epsilon IS used is `FinancialEquityBand`, which has a
 *     genuine isolated single-point band ("0 → no debt, no equity") wedged
 *     between "<0 → in debt" and "0–50k → some savings" — two bands would
 *     otherwise both claim `ceiling = 0`. Since financial equity is money
 *     (quantised to the penny), the "in debt" band's ceiling is stored as
 *     -0.01, which isn't a fudge — it's the smallest representable value
 *     below zero.
 *
 * A value outside every band (below the lowest floor, or — for tables with
 * no open-ended top row, like `AffordabilityBand` — above the highest
 * ceiling) resolves to `null`; callers decide the fallback (e.g. the
 * affordability grid's outside-range clamp is assumption CALC-A6, applied by
 * the CALC-06 award engine, not here).
 */

/** The minimal shape a resolvable band row needs. */
export interface BandRow {
  /** Inclusive lower bound, or `null` for "no lower bound" (open-ended bottom). */
  floor: number | null
  /** Upper bound (inclusive unless `ceilingExclusive` is passed), or `null` for "no upper bound". */
  ceiling: number | null
}

export interface ResolveBandOptions {
  /** When true, `ceiling` is treated as exclusive (`value < ceiling`). Default false. */
  ceilingExclusive?: boolean
}

/**
 * Resolves the band row whose range contains `value`, per the convention
 * documented above. Returns `null` if no band matches.
 */
export function resolveBand<T extends BandRow>(
  bands: readonly T[],
  value: number,
  options: ResolveBandOptions = {},
): T | null {
  const { ceilingExclusive = false } = options

  // Ascending by ceiling; null (open-ended top) sorts last.
  const sorted = [...bands].sort((a, b) => {
    if (a.ceiling === null && b.ceiling === null) return 0
    if (a.ceiling === null) return 1
    if (b.ceiling === null) return -1
    return a.ceiling - b.ceiling
  })

  for (const band of sorted) {
    const floorOk = band.floor === null || value >= band.floor
    const ceilingOk =
      band.ceiling === null || (ceilingExclusive ? value < band.ceiling : value <= band.ceiling)
    if (floorOk && ceilingOk) return band
  }

  return null
}

// ─── Table-specific typed rows + resolvers ────────────────────────────────
//
// Each table's row shape uses the SAME field names as its Prisma model /
// seed data (`bandFloor`/`bandCeiling`, or `ratioFloor`/`ratioCeiling` for the
// two ratio-based tables) rather than the generic `BandRow`'s `floor`/
// `ceiling`, so callers can pass DB/seed rows straight through with no
// remapping. Each resolver adapts to the generic `BandRow` shape internally.

export interface AffordabilityBandRow {
  bandFloor: number
  bandCeiling: number
  basePct: number
}

/** Appendix B. Every row has real floor/ceiling — no open-ended rows in this table. */
export function resolveAffordabilityBand(
  bands: readonly AffordabilityBandRow[],
  netIncome: number,
): AffordabilityBandRow | null {
  const view = bands.map((b) => ({ floor: b.bandFloor, ceiling: b.bandCeiling, source: b }))
  return resolveBand(view, netIncome)?.source ?? null
}

export interface IncomeCategoryBandRow {
  bandFloor: number | null
  bandCeiling: number | null
  category: number
  feesBenchmarkPct: number
}

/** Appendix C.1 — floor-inclusive, ceiling-EXCLUSIVE (the appendix's own note). */
export function resolveIncomeCategoryBand(
  bands: readonly IncomeCategoryBandRow[],
  netIncome: number,
): IncomeCategoryBandRow | null {
  const view = bands.map((b) => ({ floor: b.bandFloor, ceiling: b.bandCeiling, source: b }))
  return resolveBand(view, netIncome, { ceilingExclusive: true })?.source ?? null
}

export interface PropertyEquityBandRow {
  bandFloor: number | null
  bandCeiling: number | null
  category: number
}

/** Appendix C.2. */
export function resolvePropertyEquityBand(
  bands: readonly PropertyEquityBandRow[],
  equity: number,
): PropertyEquityBandRow | null {
  const view = bands.map((b) => ({ floor: b.bandFloor, ceiling: b.bandCeiling, source: b }))
  return resolveBand(view, equity)?.source ?? null
}

export interface FinancialEquityBandRow {
  bandFloor: number | null
  bandCeiling: number | null
  label: string
}

/** Appendix C.3. */
export function resolveFinancialEquityBand(
  bands: readonly FinancialEquityBandRow[],
  financialEquity: number,
): FinancialEquityBandRow | null {
  const view = bands.map((b) => ({ floor: b.bandFloor, ceiling: b.bandCeiling, source: b }))
  return resolveBand(view, financialEquity)?.source ?? null
}

export interface DebtRatioBandRow {
  ratioFloor: number | null
  ratioCeiling: number | null
  minRepaymentMonths: number | null
  statusLabel: string
}

/**
 * Appendix C.4 (normalised per assumption CALC-A3).
 *
 * CH-40 — ceiling-EXCLUSIVE, per Charlotte's confirmation of 24 Aug 2026:
 * *"it should be the logic of < , so 'zero debt, no credit risk' is a negative
 * number; number equal to zero or strictly less than 0.1 'small debt level,
 * negligible credit risk – level 1'"*.
 *
 * Her `<` logic is applied to every boundary above zero, so each boundary now
 * OPENS its band rather than closing the one below — `0.1` moves from level 1
 * to level 2, `0.3` from level 2 to the next, and so on. The seeded boundaries
 * were already the non-overlapping reading she confirmed (0–0.1, 0.1–0.3,
 * 0.3–0.5, 0.5–0.8, 0.8–1.0), so only the comparison changes. The
 * income-category resolver above already passes the same flag; the two tables
 * now agree on convention.
 *
 * ⚠️ **Zero is deliberately NOT moved to level 1, contrary to her literal
 * wording — see Q9.** She describes ZERO DEBT as "a negative number", but
 * `debtOverNdiRatio` is floored at zero by construction
 * (`v2/debt.ts`: `Math.max(0, yearlyDebtExposure) / householdNetIncome`), so it
 * can never BE negative. Taking her wording literally would make ZERO DEBT
 * permanently unreachable and label every debt-free household — including one
 * with a large savings surplus — "SMALL DEBT LEVEL". That is plainly not the
 * intent, and Part 5's reported values are among those she has already signed
 * off, so the zero case is left exactly as it behaves today and asked rather
 * than guessed. Resolving Q9 is likely to mean removing the floor in `debt.ts`
 * so a savings surplus reads negative, at which point this guard can go.
 */
export function resolveDebtRatioBand(
  bands: readonly DebtRatioBandRow[],
  debtOverNdiRatio: number,
): DebtRatioBandRow | null {
  const view = bands.map((b) => ({ floor: b.ratioFloor, ceiling: b.ratioCeiling, source: b }))
  if (debtOverNdiRatio <= 0) {
    // The open-ended-bottom row (ceiling 0) — ZERO DEBT.
    return bands.find((b) => b.ratioFloor === null) ?? null
  }
  return resolveBand(view, debtOverNdiRatio, { ceilingExclusive: true })?.source ?? null
}

export interface LifestyleSqueezeBandRow {
  ratioFloor: number | null
  ratioCeiling: number | null
  statusLabel: string
}

/** Appendix C.5. `squeezeRatioPct` is expressed in percentage points (100 = 100%). */
export function resolveLifestyleSqueezeBand(
  bands: readonly LifestyleSqueezeBandRow[],
  squeezeRatioPct: number,
): LifestyleSqueezeBandRow | null {
  const view = bands.map((b) => ({ floor: b.ratioFloor, ceiling: b.ratioCeiling, source: b }))
  return resolveBand(view, squeezeRatioPct)?.source ?? null
}

// ─── Direct key lookups (not band-based) ──────────────────────────────────

export interface NotionalCostConfigRow {
  category: number
  costType:
    | 'RENT'
    | 'COUNCIL_TAX'
    | 'ESSENTIALS'
    | 'CAR'
    | 'PUBLIC_TRANSPORT'
    | 'JWF_ALLOWANCE'
    | 'NOTIONAL_SAVINGS'
    | 'SAVINGS_CUSHION'
  amount: number
}

/** Direct (category, costType) lookup — not a band resolution. */
export function getNotionalCostAmount(
  configs: readonly NotionalCostConfigRow[],
  category: number,
  costType: NotionalCostConfigRow['costType'],
): number | null {
  const row = configs.find((c) => c.category === category && c.costType === costType)
  return row ? row.amount : null
}

/**
 * Appendix A "theoretical notional totals" — RENT + COUNCIL_TAX + ESSENTIALS +
 * PUBLIC_TRANSPORT + JWF_ALLOWANCE + CAR for a category. Both transport modes
 * are included unconditionally (workbook table-8 row 47, "LINKED NOTIONALS
 * G47") — this is the theoretical leg's benchmark, not the assessor-toggled
 * actual notional spend (CALC-03), which only deducts car/PT when the
 * corresponding `uses*` flag is set. Used by the CALC-06 award engine and
 * asserted directly against Appendix F's acceptance vectors here.
 */
export function theoreticalNotionalTotal(
  configs: readonly NotionalCostConfigRow[],
  category: number,
): number | null {
  const types: NotionalCostConfigRow['costType'][] = [
    'RENT',
    'COUNCIL_TAX',
    'ESSENTIALS',
    'PUBLIC_TRANSPORT',
    'JWF_ALLOWANCE',
    'CAR',
  ]
  let total = 0
  for (const type of types) {
    const amount = getNotionalCostAmount(configs, category, type)
    if (amount === null) return null
    total += amount
  }
  return total
}

export interface FamilyCategoryMetaRow {
  category: number
  familyMembers: number
  schoolAgeChildren: number
  description: string
}

/** Direct category lookup — not a band resolution. */
export function getFamilyCategoryMeta(
  metas: readonly FamilyCategoryMetaRow[],
  category: number,
): FamilyCategoryMetaRow | null {
  return metas.find((m) => m.category === category) ?? null
}
