-- Epic 21 #2 (CR-002 Phase 4) — gap ranking.
--
-- Charlotte's 11 Oct 2026 email (13:03 UTC): when an assessment carries more
-- than one gap code, the highest-ranked code takes the full justification of
-- the gap. The rank is separate from the display order (`sort_order`), so the
-- assessment picker keeps its grouped order (D-3) and a new code can be slotted
-- in at any rank from Settings.
--
-- Additive: one nullable column; deprecated codes 1–10 stay unranked (NULL).
-- No RLS change: gap_reasons policies are row-level (20260710205004).

ALTER TABLE "gap_reasons" ADD COLUMN "rank" INTEGER;

UPDATE "gap_reasons" SET "rank" = v.rank FROM (VALUES
  (101, 1), (102, 2), (103, 3), (110, 4), (111, 5),
  (107, 6), (108, 7), (104, 8), (105, 9), (106, 10),
  (119, 11), (109, 12), (112, 13), (120, 14), (113, 15),
  (114, 16), (115, 17), (116, 18), (117, 19), (118, 20)
) AS v(code, rank)
WHERE "gap_reasons"."code" = v.code;
