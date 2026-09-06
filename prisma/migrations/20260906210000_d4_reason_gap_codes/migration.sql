-- D4 CLOSED (Charlotte, "Reason & Gap Codes", 6 Sep 2026): her reviewed,
-- definitive listings replace both taxonomies under the deprecate-never-delete
-- convention. Historic recommendations keep rendering the old labels; she
-- re-picks codes on the 3 completed live assessments herself. Mirrors
-- prisma/seed-data/reason-codes.ts and gap-reasons.ts (this file is generated
-- from those arrays — keep them in sync).

-- 1. Retire the 24 Aug reason-code generation (101–137).
UPDATE "reason_codes" SET "is_deprecated" = true WHERE "code" BETWEEN 101 AND 137;

-- 2. Her 41-code list, DB codes 201–241 (display = code − 200).
INSERT INTO "reason_codes" ("id", "code", "label", "is_deprecated", "sort_order")
VALUES
  (gen_random_uuid(), 201, '1 - No year on year comparison, first assessment', false, 1),
  (gen_random_uuid(), 202, '2 - No real change', false, 2),
  (gen_random_uuid(), 203, '3 - Additional family member since last year', false, 3),
  (gen_random_uuid(), 204, '4 - One of their children has left school since last year', false, 4),
  (gen_random_uuid(), 205, '5 - Divorce or separation', false, 5),
  (gen_random_uuid(), 206, '6 - Bereavement', false, 6),
  (gen_random_uuid(), 207, '7 - Severe Illness', false, 7),
  (gen_random_uuid(), 208, '8 - Sudden unemployment', false, 8),
  (gen_random_uuid(), 209, '9 - Self-employed net profit increase', false, 9),
  (gen_random_uuid(), 210, '10 - Self-employed net profit decrease', false, 10),
  (gen_random_uuid(), 211, '11 - Bonus change year on year', false, 11),
  (gen_random_uuid(), 212, '12 - Increase in Benefits', false, 12),
  (gen_random_uuid(), 213, '13 - Stopped qualifying for some benefits', false, 13),
  (gen_random_uuid(), 214, '14 - Salary increase', false, 14),
  (gen_random_uuid(), 215, '15 - New job and decreased pay', false, 15),
  (gen_random_uuid(), 216, '16 - New job and increased pay', false, 16),
  (gen_random_uuid(), 217, '17 - Increased savings', false, 17),
  (gen_random_uuid(), 218, '18 - Decreased savings', false, 18),
  (gen_random_uuid(), 219, '19 - Inheritance', false, 19),
  (gen_random_uuid(), 220, '20 - Early Pension drawing', false, 20),
  (gen_random_uuid(), 221, '21 - More Profitable or New Investments', false, 21),
  (gen_random_uuid(), 222, '22 - Additional income not disclosed last year', false, 22),
  (gen_random_uuid(), 223, '23 - Stopped work to study', false, 23),
  (gen_random_uuid(), 224, '24 - Legal claim impact', false, 24),
  (gen_random_uuid(), 225, '25 - Changed from working FT to PT', false, 25),
  (gen_random_uuid(), 226, '26 - Increased working hours / Got a second job', false, 26),
  (gen_random_uuid(), 227, '27 - Mortgage now fully paid', false, 27),
  (gen_random_uuid(), 228, '28 - New property asset acquired', false, 28),
  (gen_random_uuid(), 229, '29 - Property asset has increased in value', false, 29),
  (gen_random_uuid(), 230, '30 - Property asset sold', false, 30),
  (gen_random_uuid(), 231, '31 - Additional asset not disclosed last year', false, 31),
  (gen_random_uuid(), 232, '32 - Re-mortgage agreement', false, 32),
  (gen_random_uuid(), 233, '33 - Change in accommodation arrangements', false, 33),
  (gen_random_uuid(), 234, '34 - Failure to meet the deadline', false, 34),
  (gen_random_uuid(), 235, '35 - Out of date documents used last year', false, 35),
  (gen_random_uuid(), 236, '36 - Forged or tampered with documents', false, 36),
  (gen_random_uuid(), 237, '37 - Failure to provide required documents', false, 37),
  (gen_random_uuid(), 238, '38 - Reduced Payable fees due to new scholarship offer', false, 38),
  (gen_random_uuid(), 239, '39 - Out of sync due to Internal/ Pastoral Bursary', false, 39),
  (gen_random_uuid(), 240, '40 - Sibling on full/partial fees taking up most or all of NDI', false, 40),
  (gen_random_uuid(), 241, '41 - Other', false, 41)
ON CONFLICT ("code") DO UPDATE
  SET "label" = EXCLUDED."label", "sort_order" = EXCLUDED."sort_order", "is_deprecated" = false;

-- 3. Retire the original gap codes (1–10).
UPDATE "gap_reasons" SET "is_deprecated" = true WHERE "code" BETWEEN 1 AND 10;

-- 4. Her 11-code gap list, DB codes 101–111 (display = code − 100).
INSERT INTO "gap_reasons" ("id", "code", "label", "is_deprecated", "sort_order")
VALUES
  (gen_random_uuid(), 101, 'Out of sync due to scholarship applied on place offer', false, 1),
  (gen_random_uuid(), 102, 'Out of sync due to new scholarship offered mid cursus', false, 2),
  (gen_random_uuid(), 103, 'Original Old Assessment Benchmark (year 2020)', false, 3),
  (gen_random_uuid(), 104, 'Pastoral Exceptional Leniency - Social Services/ Police', false, 4),
  (gen_random_uuid(), 105, 'Pastoral Exceptional Leniency - Fostering', false, 5),
  (gen_random_uuid(), 106, 'Pastoral Exceptional Leniency - Homed Boarder', false, 6),
  (gen_random_uuid(), 107, 'Internal Bursary Bias - Bereavement', false, 7),
  (gen_random_uuid(), 108, 'Internal Bursary Bias - Severe Illness', false, 8),
  (gen_random_uuid(), 109, 'Internal Bursary Bias - Family crippled with debt, top pupil', false, 9),
  (gen_random_uuid(), 110, 'Affordability Adjusted Calculation Preferred', false, 10),
  (gen_random_uuid(), 111, 'Theoretical Benchmark Calculation Preferred', false, 11)
ON CONFLICT ("code") DO UPDATE
  SET "label" = EXCLUDED."label", "sort_order" = EXCLUDED."sort_order", "is_deprecated" = false;
