-- Fix email template merge-field convention drift (B13).
--
-- The canonical merge-field convention is snake_case, matching every
-- `sendEmail` call site in `src/app/**/actions.ts`. The original seed
-- migration (`20260513220100_seed_email_templates`) already inserts the
-- 8 transactional templates with snake_case tokens, and
-- `prisma/seed-data/email-templates.ts` is aligned.
--
-- The misleading hint chips in the admin email-template editor previously
-- advertised camelCase examples (`{{applicantName}}`, `{{childName}}`,
-- `{{loginUrl}}`, `{{academicYear}}`). If an admin copied any of those
-- chips into a template body via the editor, those literal camelCase
-- tokens would survive `replaceMergeFields()` and reach the recipient.
-- This migration scrubs any such drift in-place.
--
-- The UPDATEs use `regexp_replace(..., 'g')`, which is a no-op once the
-- tokens are already snake_case — safe to re-run, safe to merge into prod
-- when no drift exists.

-- ── subject ────────────────────────────────────────────────────────────────
UPDATE public.email_templates
SET subject = regexp_replace(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      regexp_replace(
                        regexp_replace(
                          regexp_replace(
                            subject,
                            '\{\{\s*applicantName\s*\}\}', '{{applicant_name}}', 'g'
                          ),
                          '\{\{\s*childName\s*\}\}', '{{child_name}}', 'g'
                        ),
                        '\{\{\s*academicYear\s*\}\}', '{{academic_year}}', 'g'
                      ),
                      '\{\{\s*loginUrl\s*\}\}', '{{registration_link}}', 'g'
                    ),
                    '\{\{\s*registrationLink\s*\}\}', '{{registration_link}}', 'g'
                  ),
                  '\{\{\s*roundYear\s*\}\}', '{{round_year}}', 'g'
                ),
                '\{\{\s*firstName\s*\}\}', '{{first_name}}', 'g'
              ),
    updated_at = now()
WHERE subject ~ '\{\{\s*(applicantName|childName|academicYear|loginUrl|registrationLink|roundYear|firstName)\s*\}\}';

-- ── body ───────────────────────────────────────────────────────────────────
UPDATE public.email_templates
SET body = regexp_replace(
             regexp_replace(
               regexp_replace(
                 regexp_replace(
                   regexp_replace(
                     regexp_replace(
                       regexp_replace(
                         regexp_replace(
                           regexp_replace(
                             regexp_replace(
                               body,
                               '\{\{\s*applicantName\s*\}\}', '{{applicant_name}}', 'g'
                             ),
                             '\{\{\s*childName\s*\}\}', '{{child_name}}', 'g'
                           ),
                           '\{\{\s*academicYear\s*\}\}', '{{academic_year}}', 'g'
                         ),
                         '\{\{\s*loginUrl\s*\}\}', '{{registration_link}}', 'g'
                       ),
                       '\{\{\s*registrationLink\s*\}\}', '{{registration_link}}', 'g'
                     ),
                     '\{\{\s*roundYear\s*\}\}', '{{round_year}}', 'g'
                   ),
                   '\{\{\s*firstName\s*\}\}', '{{first_name}}', 'g'
                 ),
                 '\{\{\s*lastName\s*\}\}', '{{last_name}}', 'g'
               ),
               '\{\{\s*submissionDate\s*\}\}', '{{submission_date}}', 'g'
             ),
             '\{\{\s*missingDocuments\s*\}\}', '{{missing_documents}}', 'g'
           ),
    updated_at = now()
WHERE body ~ '\{\{\s*(applicantName|childName|academicYear|loginUrl|registrationLink|roundYear|firstName|lastName|submissionDate|missingDocuments)\s*\}\}';
