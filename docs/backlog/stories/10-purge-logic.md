# Item 10: Purge logic (PII + documents out, financials retained)

> Source: `docs/backlog/post-demo-change-list.md` — item 10. Status: Not started.

When an application is closed with a close reason whose "purge on close" toggle is set (items 2 and 4), the system anonymises the application: PII fields are nulled/scrubbed and uploaded documents are deleted from Supabase Storage, while financial figures, the bursary reference, key dates, the assessment synopsis, and the close reason are retained. This is anonymisation — the row and its retained fields survive — not row deletion, and it must stay aligned with the existing GDPR deletion routine.

## Story 10.1 — Purge runs only for purge-flagged close reasons
**As an** ADMIN, **I want** the purge routine to run automatically only when I close an application with a reason whose "purge on close" toggle is on, **so that** closing under an ordinary (non-purge) reason retains all data under the normal retention policy.

**Acceptance criteria**
- [ ] Given an application being closed and the selected close reason has `purgeOnClose = true`, when the close is confirmed, then the purge routine runs as part of the same operation.
- [ ] Given the selected close reason has `purgeOnClose = false`, when the close is confirmed, then no PII or documents are removed and all data is retained.
- [ ] Given a purge-flagged close from either path — per-row (item 2) or bulk (item 3) — then the purge behaviour is identical (same fields scrubbed, same documents removed, same audit entry).
- [ ] Given the close operation fails before completion, then no partial purge is left behind — the close and the purge succeed or fail together (atomic).
- [ ] Given an application that has already been purged, when a close/purge is attempted again, then the routine is idempotent (no error, nothing further to scrub).

**Notes / dependencies**
- Depends on item 4 (`purgeOnClose` flag on close reasons) and item 2 (single Closed state, reason-driven).
- The close reason itself is retained on the application (item 4) and must survive the purge.

## Story 10.2 — Precise PII-vs-retained field split
**As a** data controller (Charlotte / ADMIN), **I want** an explicit, documented split between PII fields (scrubbed) and retained fields (kept), **so that** purge removes personal data while preserving the financial and audit record the Foundation must keep.

**Acceptance criteria**
- [ ] Given a purge runs, then all PII fields are anonymised/nulled, including at minimum: applicant and child first/last names, contact details (email, phone), postal address, date of birth, and free-text fields that may contain personal data (e.g. notes, comments, circumstance narratives).
- [ ] Given a purge runs, then the following are RETAINED unchanged: financial figures (income, assessed contribution, award/bursary amounts), the bursary reference, key dates (received/submitted, decision, close date), the assessment synopsis, and the close reason.
- [ ] Given household/related people and dual-parent records associated with the application, then their PII is scrubbed on the same basis while any retained financial figures they contribute are preserved.
- [ ] Given the field split is defined, then it is documented in one canonical place (a scrub map) so the same list drives implementation, tests, and the GDPR routine.
- [ ] Given a scrubbed field, then it holds a clear anonymised marker (e.g. null or a fixed redaction token) rather than being left with stale personal data.

**Notes / dependencies**
- Free-text is the highest-risk category (may contain names/addresses embedded in prose) — treat any free-text captured against the application as PII unless explicitly classified otherwise.
- The retained assessment synopsis must itself be free of PII, or be scrubbed of it, so retaining it does not re-introduce personal data.

## Story 10.3 — Delete uploaded documents from Supabase Storage
**As a** data controller, **I want** all uploaded documents for a purged application removed from Supabase Storage, **so that** no personal documents (payslips, benefit letters, etc.) remain after purge.

**Acceptance criteria**
- [ ] Given a purge runs, then every document object associated with the application is deleted from the Storage `documents` bucket.
- [ ] Given a Storage object is deleted, then the corresponding document metadata rows are anonymised/removed consistently (no dangling references, no retained original filenames that leak PII).
- [ ] Given a Storage deletion fails for one or more objects, then the failure is surfaced/logged and the purge does not silently report success with documents still present.
- [ ] Given documents are deleted, then any retained financial figures that were derived from those documents remain intact (the figures live on the application, not only in the files).

**Notes / dependencies**
- Reuse the same Storage-deletion mechanism the existing GDPR routine uses (Story 10.5) to avoid divergent deletion paths.

## Story 10.4 — Append-only audit entry for each purge
**As an** auditor / ADMIN, **I want** every purge recorded as an append-only audit entry, **so that** the Foundation can evidence what was purged, when, by whom, and under which close reason.

**Acceptance criteria**
- [ ] Given a purge completes, then an `audit_logs` entry is written recording: the application/bursary reference, the actor, the timestamp, the close reason, and that a purge (anonymisation) occurred.
- [ ] Given `audit_logs` is append-only, then the audit write is an insert only — the routine never updates or deletes audit rows.
- [ ] Given the audit entry is written, then it contains no re-introduced PII (log the reference and counts, not the scrubbed personal values).
- [ ] Given a bulk close that purges multiple rows, then each purged application produces its own audit entry (per-application traceability).

**Notes / dependencies**
- `audit_logs` is append-only — DELETE is denied even under service_role (project gotcha). The audit entry must be insert-only.

## Story 10.5 — Alignment with the existing GDPR deletion routine
**As a** maintainer, **I want** the purge routine to share the field-scrub map and Storage-deletion logic with the existing GDPR deletion routine, **so that** the two paths cannot diverge over time.

**Acceptance criteria**
- [ ] Given both routines run, then they resolve "what counts as PII" from the same single source (the scrub map from Story 10.2).
- [ ] Given both routines delete documents, then they use the same Storage-deletion helper.
- [ ] Given the two routines differ intentionally (e.g. GDPR deletes/anonymises more broadly across the profile; purge is scoped to one closed application and retains financials), then the differences are documented so the intent is clear.
- [ ] Given a new PII field is later added to the schema, then updating the shared scrub map causes both routines to cover it (no field silently missed by one path).

**Notes / dependencies**
- A GDPR deletion routine already exists (7-year retention check, 2-step confirmation, profile/audit anonymisation, Storage document deletion) — this story is about consolidating shared logic, not rebuilding it.
- Purge is application-scoped and retention-neutral (retains financials/reference/dates/synopsis/reason); GDPR deletion is profile-scoped and driven by retention expiry. Keep both, share the primitives.
