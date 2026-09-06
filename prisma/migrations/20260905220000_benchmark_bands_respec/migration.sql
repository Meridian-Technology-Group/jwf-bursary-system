-- Benchmark-bands respec (Charlotte, 5 Sep 2026 21:27): new generations of
-- the three commentary tables, effective 2026-09-07. Mirrors the *Respec
-- exports in prisma/seed-data/profiling-reference.ts (keep the two in sync).
-- Each block inserts its whole generation only if that generation is absent —
-- idempotent alongside the reference seed, and safe with the nullable
-- open-ended floors/ceilings that ON CONFLICT cannot key on.

-- C.3 — financial equity: "within default cushion savings" now runs to
-- £37,000 (aligned with the new category-1 savings cushion); "fair savings"
-- starts there. Other rows carry forward verbatim.
INSERT INTO "financial_equity_bands" ("id", "band_floor", "band_ceiling", "label", "effective_from")
SELECT gen_random_uuid(), v.floor, v.ceiling, v.label, DATE '2026-09-07'
FROM (VALUES
  (NULL::numeric, -0.01::numeric, 'in debt'),
  (0, 0, 'no debt, no equity'),
  (0, 3000, 'negligible savings'),
  (3000, 37000, 'within default cushion savings'),
  (37000, 50000, 'fair savings'),
  (50000, 75000, 'decent savings'),
  (75000, 100000, 'comfortable savings'),
  (100000, 150000, 'large savings'),
  (150000, 250000, 'high savings'),
  (250000, 400000, 'very high savings'),
  (400000, 600000, 'extremely high savings'),
  (600000, 900000, 'stratospheric savings - level 1'),
  (900000, 1200000, 'stratospheric savings - level 2'),
  (1200000, 1600000, 'stratospheric savings - level 3'),
  (1600000, NULL, 'stratospheric savings - level 4')
) AS v(floor, ceiling, label)
WHERE NOT EXISTS (
  SELECT 1 FROM "financial_equity_bands" WHERE "effective_from" = DATE '2026-09-07'
);

-- C.4 — debt-over-NDI: her full re-banding, "- level N" suffixes gone.
-- Repayment months derived by the old table's implicit floor(ratioFloor × 12)
-- rule (her email gives none); flagged to her for correction.
INSERT INTO "debt_ratio_bands" ("id", "ratio_floor", "ratio_ceiling", "min_repayment_months", "status_label", "effective_from")
SELECT gen_random_uuid(), v.floor, v.ceiling, v.months, v.label, DATE '2026-09-07'
FROM (VALUES
  (NULL::numeric, 0::numeric, NULL::int, 'ZERO DEBT, NO CREDIT RISK'),
  (0, 0.01, 0, 'SMALL DEBT LEVEL, NEGLIGIBLE CREDIT RISK'),
  (0.01, 0.03, 0, 'MANAGEABLE DEBT, LOW CREDIT RISK'),
  (0.03, 0.07, 0, 'MANAGEABLE DEBT, MEDIUM CREDIT RISK'),
  (0.07, 0.1, 0, 'MATERIAL DEBT IMPACT, FAIR CREDIT RISK'),
  (0.1, 0.15, 1, 'MATERIAL DEBT IMPACT, HIGH CREDIT RISK'),
  (0.15, 0.2, 1, 'HEAVILY IN DEBT, FAIR CREDIT RISK'),
  (0.2, 0.3, 2, 'HEAVILY IN DEBT, HIGH CREDIT RISK'),
  (0.3, 0.4, 3, 'VERY HEAVILY IN DEBT, HIGH CREDIT RISK'),
  (0.4, 0.5, 4, 'VERY HEAVILY IN DEBT, VERY HIGH CREDIT RISK'),
  (0.5, 1, 6, 'DEBT GETTING OUT OF CONTROL, NO SAFETY NET'),
  (1, NULL, 12, 'AT RISK OF BANKRUPTCY')
) AS v(floor, ceiling, months, label)
WHERE NOT EXISTS (
  SELECT 1 FROM "debt_ratio_bands" WHERE "effective_from" = DATE '2026-09-07'
);

-- C.5 — lifestyle squeeze: nine bands for the reworked ratio (denominator is
-- now NDI − totalDebt/5). Negative ratio = survival mode.
INSERT INTO "lifestyle_squeeze_bands" ("id", "ratio_floor", "ratio_ceiling", "status_label", "effective_from")
SELECT gen_random_uuid(), v.floor, v.ceiling, v.label, DATE '2026-09-07'
FROM (VALUES
  (NULL::numeric, 0::numeric, 'IN FINANCIAL SURVIVAL MODE, WARNING DEBT RED FLAG, NO MONEY FOR FEES'),
  (0, 40, 'AFFORDABLE, NEGLIGIBLE IMPACT ON LIFESTYLE'),
  (40, 50, 'AFFORDABLE, SOME IMPACT ON LIFESTYLE'),
  (50, 60, 'FAMILY LIFESTYLE IMPACTED, SOME RESTRICTIONS'),
  (60, 80, 'IMPORTANT LIFESTYLE SQUEEZE, MAIN SPEND RESTRICTIONS DUE TO FEES'),
  (80, 90, 'VERY HIGH LIFESTYLE SQUEEZE, FEES WILL FEEL LIKE A SACRIFICE'),
  (90, 100, 'SEVERE LIFESTYLE SQUEEZE, LIKELY STRUGGLES AHEAD'),
  (100, 200, 'LIFESTYLE ONLY MAINTAINED BY INCREASING DEBT, CREDIT RISK FLAG'),
  (200, NULL, 'LIFESTYLE FRUSTRATINGLY PLAGUED BY UNUSUALLY HIGH LEVEL OF DEBT, HIGH RISK')
) AS v(floor, ceiling, label)
WHERE NOT EXISTS (
  SELECT 1 FROM "lifestyle_squeeze_bands" WHERE "effective_from" = DATE '2026-09-07'
);
