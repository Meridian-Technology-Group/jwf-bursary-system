/**
 * Dashboard illustrative ("fictive") data (Epic 23 T9, D-18).
 *
 * Charlotte, 6 Sep 2026: "for the sections which refer to future data … a tab
 * where we could store some 'fictive data'". Each illustrative panel has one
 * row in `dashboard_sample_data` (key → payload). The defaults are her
 * mock-up's figures (Dashboard.xlsx) and are what the migration seeds.
 * A panel shows sample data only while its real count is zero, badged
 * "Illustrative data" (`chooseRealOrSample`).
 *
 * Pure: zod schemas, defaults, and the switch.
 */

import { z } from "zod";

export const SAMPLE_KEYS = ["closed_reasons_top5", "yoy_changes_top10", "rolling_committed_spend"] as const;
export type SampleKey = (typeof SAMPLE_KEYS)[number];

const label = z.string().trim().min(1, "Every row needs a label.").max(200);

/** Top 5 closed-application reasons: label + share of closes (0–1). */
export const ClosedReasonsSchema = z.object({
  rows: z
    .array(z.object({ label, share: z.coerce.number().min(0, "Shares are 0–100%.").max(1, "Shares are 0–100%.") }))
    .max(5, "At most five reasons."),
});

/** Top 10 year-to-year change reasons: "code - label" + number of recurrences. */
export const YoyChangesSchema = z.object({
  rows: z.array(z.object({ label, count: z.coerce.number().int().min(0) })).max(10, "At most ten reasons."),
});

/** Rolling-over new committed spend (before VAT) for the next round, by cohort. */
export const CommittedSpendSchema = z.object({
  exOp: z.coerce.number().min(0),
  ts: z.coerce.number().min(0),
  ws: z.coerce.number().min(0),
});

export const SAMPLE_SCHEMAS = {
  closed_reasons_top5: ClosedReasonsSchema,
  yoy_changes_top10: YoyChangesSchema,
  rolling_committed_spend: CommittedSpendSchema,
} as const;

export type SamplePayloads = {
  closed_reasons_top5: z.infer<typeof ClosedReasonsSchema>;
  yoy_changes_top10: z.infer<typeof YoyChangesSchema>;
  rolling_committed_spend: z.infer<typeof CommittedSpendSchema>;
};

export const SAMPLE_TITLES: Record<SampleKey, string> = {
  closed_reasons_top5: "Current round — new applications — top 5 of closed applications' reasons",
  yoy_changes_top10: "Next round — assessments — top 10 of year-to-year changes selected",
  rolling_committed_spend: "Rolling-over new committed spend (completed assessments)",
};

/** Her Dashboard.xlsx figures (6 Sep 2026). Seeded by migration 20261016180000. */
export const SAMPLE_DEFAULTS: SamplePayloads = {
  closed_reasons_top5: {
    rows: [
      { label: "Assessment confirms above threshold, does not qualify for bursary support", share: 0.65 },
      { label: "Qualifies for a bursary but not part of admissions’ final shortlist", share: 0.2 },
      { label: "Recipient accepted offer from another school", share: 0.07 },
      { label: "Applicant no longer interested in bursary support", share: 0.05 },
      { label: "Applicant missed deadline(s) & gave up", share: 0.01 },
    ],
  },
  yoy_changes_top10: {
    rows: [
      { label: "9 - Self-employed net profit decrease", count: 125 },
      { label: "10 - Bonus change year on year", count: 89 },
      { label: "13 - New job and decreased pay", count: 82 },
      { label: "11 - Increase in Benefits", count: 79 },
      { label: "15 - Increased savings", count: 56 },
      { label: "8 - Sudden unemployment", count: 35 },
      { label: "17 - Early Pension drawing", count: 12 },
      { label: "30 - Forged or tampered with documents", count: 5 },
      { label: "4 - One of their children has left school since last year", count: 4 },
      { label: "22 - Mortgage now fully paid", count: 2 },
    ],
  },
  rolling_committed_spend: { exOp: 288954, ts: 1871000, ws: 2227000 },
};

/** A stored payload, validated; a missing or malformed row falls back to her default. */
export function readSample<K extends SampleKey>(key: K, stored: unknown): SamplePayloads[K] {
  const parsed = SAMPLE_SCHEMAS[key].safeParse(stored);
  return (parsed.success ? parsed.data : SAMPLE_DEFAULTS[key]) as SamplePayloads[K];
}

export type RealOrSample<T> = { data: T; illustrative: boolean };

/** D-18: real data as soon as any exists; the sample only while the real count is zero. */
export function chooseRealOrSample<T>(realCount: number, real: T, sample: T): RealOrSample<T> {
  return realCount > 0 ? { data: real, illustrative: false } : { data: sample, illustrative: true };
}
