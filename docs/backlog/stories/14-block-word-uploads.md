# Item 14: Block / discourage Word document uploads

> Source: `docs/backlog/post-demo-change-list.md` — item 14. Status: Not started.

Parents currently upload supporting documents (e.g. payslips, bank statements) in the portal. Word files (`.doc`/`.docx`) cause problems for assessors — inconsistent rendering, no reliable preview, and editability concerns — so the portal should reject them at the point of upload and steer the parent toward converting to PDF, with a defence-in-depth server-side check to catch anything the browser control misses.

## Story 14.1 — Reject Word documents at the upload control (client-side)
**As a** parent/applicant uploading supporting documents, **I want** the portal to stop me before it accepts a Word file, **so that** I find out immediately that the format is not usable rather than after submitting.

**Acceptance criteria**
- [ ] Given the upload control (file picker and drag-and-drop), When it is presented, Then it advertises only the accepted types so the OS file dialog defaults to filtering those.
- [ ] Given I select or drag a `.doc` or `.docx` file, When the portal validates my choice, Then the file is not added to the upload list and no upload begins.
- [ ] Given a blocked Word file, When it is rejected, Then an inline error appears near the control naming the file and explaining Word documents are not accepted.
- [ ] Given I select multiple files where some are valid and one is a Word file, When validation runs, Then the valid files are still accepted and only the Word file is rejected with its own message.
- [ ] Given a file whose extension has been changed to `.pdf` but is actually a Word document, Then client-side blocking is best-effort only and Story 14.2 is relied on as the authoritative check.

**Notes / dependencies**
- Match both the extensions (`.doc`, `.docx`) and the corresponding MIME types (`application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`).
- Accepted-types list must be sourced from the single allowlist agreed in Story 14.4.

## Story 14.2 — Reject Word documents at the server (defence in depth)
**As a** Foundation assessor relying on the document set, **I want** the upload server action to reject Word files regardless of the browser, **so that** no `.doc`/`.docx` ever lands in storage even if client validation is bypassed.

**Acceptance criteria**
- [ ] Given an upload request containing a Word file (by extension or MIME type), When the server action processes it, Then the file is rejected and not written to Supabase Storage or recorded as a document.
- [ ] Given a rejected upload, When the server responds, Then it returns a clear error identifying the format problem so the portal can surface the convert-to-PDF guidance from Story 14.3.
- [ ] Given a mixed batch, When one file is a Word document, Then the server rejects that file while allowing valid files (or rejects the batch atomically — behaviour to be confirmed with the Foundation), and the outcome is communicated per file.
- [ ] Given the rejection, Then it is validated against the same allowlist used client-side (Story 14.4), not a separately maintained list.

**Notes / dependencies**
- This is the authoritative check; client-side (14.1) is a UX convenience only.
- Reuse existing upload validation / error-handling patterns in the portal upload action.

## Story 14.3 — Show convert-to-PDF instructions on a blocked Word upload
**As a** parent/applicant who tried to upload a Word file, **I want** clear instructions on how to turn it into a PDF, **so that** I can complete my upload without contacting support.

**Acceptance criteria**
- [ ] Given a Word file is blocked (client or server), When the error is shown, Then it includes short step-by-step guidance for converting to PDF.
- [ ] Given the guidance, Then it covers the common paths: in Word use File → Save As (or Export) and choose PDF; alternatively use print-to-PDF ("Save as PDF" printer).
- [ ] Given the guidance, Then it also names the accepted formats so the parent knows what to upload instead.
- [ ] Given the message, Then it is written in plain, non-technical language and is reachable by keyboard and screen reader (associated with the upload control, not a transient toast only).

**Notes / dependencies**
- Wording is short and reusable; the same helper text applies to both client- and server-triggered rejections.
- Confirm final wording with the Foundation alongside Story 14.4.

## Story 14.4 — Confirm and centralise the accepted-types allowlist
**As a** Foundation administrator, **I want** the list of accepted upload formats agreed and applied consistently, **so that** parents are blocked/allowed by one authoritative rule and assessors receive files they can actually read.

**Acceptance criteria**
- [ ] Given the accepted-types question, When reviewed with the Foundation, Then a definitive allowlist is confirmed (expected: PDF plus common image types — JPG/PNG — to be confirmed).
- [ ] Given the confirmed allowlist, Then client-side (14.1) and server-side (14.2) validation both derive from the same single source of truth.
- [ ] Given a file whose type is not on the allowlist, Then it is rejected with a message naming the accepted formats (Word files fall out of this naturally).
- [ ] Given the allowlist is later changed, Then only one place needs updating for both layers to reflect it.

**Notes / dependencies**
- Blocking Word specifically (14.1/14.2) and defining a positive allowlist are complementary; the allowlist is the durable rule and Word rejection is the headline behaviour the Foundation asked for.
- Open question for the Foundation: images allowed or PDF-only? Per-file vs whole-batch rejection on a mixed upload.
