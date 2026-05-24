-- Backlog #9 (step 1 of 2): backfill first_name / last_name from the legacy
-- single-string applicant_name, so the derived display name survives once the
-- applicant_name column is dropped in step 2 (a later migration).
--
-- Heuristic split: first whitespace-delimited token -> first_name, the
-- remainder -> last_name. A single-word name leaves last_name NULL. Only rows
-- that don't already have a structured first_name are touched, so this never
-- clobbers names captured via the first/last fields.
--
-- Forward-only, idempotent (re-running changes nothing once first_name is set).

UPDATE public.invitations
SET first_name = split_part(btrim(applicant_name), ' ', 1),
    last_name = CASE
        WHEN position(' ' IN btrim(applicant_name)) > 0
        THEN NULLIF(btrim(substr(btrim(applicant_name),
                                 position(' ' IN btrim(applicant_name)) + 1)), '')
        ELSE NULL
    END
WHERE (first_name IS NULL OR btrim(first_name) = '')
  AND applicant_name IS NOT NULL
  AND btrim(applicant_name) <> '';
