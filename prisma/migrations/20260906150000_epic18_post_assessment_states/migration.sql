-- Epic 18 (WP-B2..B5) — Charlotte's post-assessment lifecycle: three new
-- final states on the assessment. COMPLETED stays what it was ("stored as
-- complete" is a relabel, not a new state). CLOSED_PURGED is deliberately
-- absent until Q10b (purge vs the 7-year retention guard and append-only
-- audit_logs) is agreed in writing (WP-B6).
ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'NEW_AWARD';
ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'WAITING_LIST';
ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'CLOSED_ARCHIVED';
