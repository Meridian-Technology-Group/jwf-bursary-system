/**
 * Epic 21 #1 + #2 (CR-002 Phase 4) — gap reporting figures.
 *
 * #1 Scholarship-adjusted gap (her 11 Oct 2026 email). The gap is
 * `confirmed − recommended` payable fees, negative when the family pays less
 * than recommended. Part of that shortfall is scholarship, which costs the
 * bursary fund nothing, so for funding reports she wants the gap with the
 * scholarship added back:
 *
 *   adjusted gap = gap + scholarship spend incl. VAT
 *               = gap + scholarshipSpendBeforeVat × (1 + vatRate / 100)
 *
 * No scholarship → the adjusted gap is the gap. Display only: no rule reads it.
 * (D-9: the incl-VAT basis is the one quoted to her, −£851,622 → −£83,565.)
 *
 * #2 Main gap reason. When an assessment carries several gap codes, the
 * highest-ranked one (lowest `rank`) takes the full justification of the gap.
 * Unranked codes come last, then display order, then code — so the answer is
 * always deterministic.
 */

/** Rounds to pennies, half away from zero (gaps are usually negative). */
function roundPennies(n: number): number {
  return (Math.sign(n) * Math.round((Math.abs(n) + Number.EPSILON) * 100)) / 100;
}

/** Scholarship spend including VAT, or 0 when there is none. */
export function scholarshipSpendInclVat(
  scholarshipSpendBeforeVat: number | null,
  vatRate: number | null
): number {
  if (!scholarshipSpendBeforeVat) return 0;
  return roundPennies(scholarshipSpendBeforeVat * (1 + (vatRate ?? 0) / 100));
}

/** The gap with the scholarship added back. Null gap → null. */
export function scholarshipAdjustedGap(
  gap: number | null,
  scholarshipSpendBeforeVat: number | null,
  vatRate: number | null
): number | null {
  if (gap === null) return null;
  return roundPennies(gap + scholarshipSpendInclVat(scholarshipSpendBeforeVat, vatRate));
}

export interface RankedGapReason {
  code: number;
  rank: number | null;
  sortOrder: number;
}

/** Orders gap reasons by precedence: rank (nulls last), sortOrder, code. */
export function compareGapPrecedence(a: RankedGapReason, b: RankedGapReason): number {
  if (a.rank !== b.rank) {
    if (a.rank === null) return 1;
    if (b.rank === null) return -1;
    return a.rank - b.rank;
  }
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.code - b.code;
}

/** The gap reason that takes the full justification, or null when none. */
export function mainGapReason<T extends RankedGapReason>(linked: readonly T[]): T | null {
  if (linked.length === 0) return null;
  return [...linked].sort(compareGapPrecedence)[0];
}

// ─── Reports: gap summary (Epic 21 #1 + #2) ─────────────────────────────────

export interface GapSummaryInput {
  school: string;
  gapAmount: number | null;
  scholarshipSpendBeforeVat: number | null;
  vatRate: number | null;
  gapReasons: (RankedGapReason & { label: string })[];
}

export interface GapTotals {
  /** Recommendations counted (one per account per round). */
  accounts: number;
  gap: number;
  scholarshipInclVat: number;
  adjustedGap: number;
  /** Recommendations whose gap is not zero. */
  accountsWithGap: number;
  /** Recommendations with any scholarship spend. */
  accountsWithScholarship: number;
}

export interface GapByMainReasonRow {
  code: number;
  label: string;
  rank: number | null;
  accounts: number;
  gap: number;
  adjustedGap: number;
}

export interface GapSummary {
  totals: GapTotals;
  bySchool: ({ school: string } & GapTotals)[];
  /** One row per main gap reason in use, in precedence order. */
  byMainReason: GapByMainReasonRow[];
  /** Recommendations with no gap code (gap under £1, or none recorded). */
  noCode: { accounts: number; gap: number; adjustedGap: number };
}

function emptyTotals(): GapTotals {
  return {
    accounts: 0,
    gap: 0,
    scholarshipInclVat: 0,
    adjustedGap: 0,
    accountsWithGap: 0,
    accountsWithScholarship: 0,
  };
}

function addTo(t: GapTotals, gap: number, scholarship: number, adjusted: number): void {
  t.accounts += 1;
  t.gap = roundPennies(t.gap + gap);
  t.scholarshipInclVat = roundPennies(t.scholarshipInclVat + scholarship);
  t.adjustedGap = roundPennies(t.adjustedGap + adjusted);
  if (gap !== 0) t.accountsWithGap += 1;
  if (scholarship !== 0) t.accountsWithScholarship += 1;
}

/**
 * Reduces a round's recommendations to the Reports "Gap" section: totals,
 * per-school totals, and the gap counted once per account under its main
 * (highest-ranked) gap code — the table sent to Charlotte on 11 Oct 2026.
 * A null gap counts as £0.
 */
export function summariseGaps(rows: readonly GapSummaryInput[]): GapSummary {
  const totals = emptyTotals();
  const schools = new Map<string, GapTotals>();
  const reasons = new Map<number, GapByMainReasonRow & { sortOrder: number }>();
  const noCode = { accounts: 0, gap: 0, adjustedGap: 0 };

  for (const row of rows) {
    const gap = row.gapAmount ?? 0;
    const scholarship = scholarshipSpendInclVat(row.scholarshipSpendBeforeVat, row.vatRate);
    const adjusted = roundPennies(gap + scholarship);

    addTo(totals, gap, scholarship, adjusted);
    const school = schools.get(row.school) ?? emptyTotals();
    addTo(school, gap, scholarship, adjusted);
    schools.set(row.school, school);

    const main = mainGapReason(row.gapReasons);
    if (!main) {
      noCode.accounts += 1;
      noCode.gap = roundPennies(noCode.gap + gap);
      noCode.adjustedGap = roundPennies(noCode.adjustedGap + adjusted);
      continue;
    }
    const entry = reasons.get(main.code) ?? {
      code: main.code,
      label: main.label,
      rank: main.rank,
      sortOrder: main.sortOrder,
      accounts: 0,
      gap: 0,
      adjustedGap: 0,
    };
    entry.accounts += 1;
    entry.gap = roundPennies(entry.gap + gap);
    entry.adjustedGap = roundPennies(entry.adjustedGap + adjusted);
    reasons.set(main.code, entry);
  }

  return {
    totals,
    bySchool: Array.from(schools.entries())
      .map(([school, t]) => ({ school, ...t }))
      .sort((a, b) => a.school.localeCompare(b.school)),
    byMainReason: Array.from(reasons.values())
      .sort(compareGapPrecedence)
      .map(({ sortOrder: _sortOrder, ...r }) => r),
    noCode,
  };
}
