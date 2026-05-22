---
title: Inline document preview blocked by CSP (default-src 'self', no frame-src for Supabase Storage)
status: open
severity: medium
area: build
opened: 2026-05-20
opened_by: walkthrough-verification-pass
related:
  - docs/walkthroughs/assessors/06-verify-uploaded-documents.md
  - docs/walkthroughs/assessors/09-set-up-assessment-workspace.md
  - docs/backlog/csp-blocks-dev-mode-hydration.md
---

## Context

Found verifying `assessors/06-verify-uploaded-documents` and the
assessment workspace's left-hand document panel (`assessors/09`) against
the **production build** on localhost:3100.

Both the "View" document-viewer dialog (Applicant Data tab) and the
split-screen document panel (Assessment tab) embed the presigned
Supabase Storage URL in an `<iframe>` for inline PDF/JPEG/PNG preview.
The production Content-Security-Policy is `default-src 'self'` with no
`frame-src` directive, so the browser blocks the frame:

```
Framing 'https://lmkmgoqezgeeyjodbvzn.supabase.co/' violates the
following Content Security Policy directive: "default-src 'self'".
... 'frame-src' was not explicitly set, so 'default-src' is used as a
fallback.
```

The iframe renders "This content is blocked. Contact the site owner to
fix the issue." The dialog/panel chrome (filename, size, Download,
Open in new tab) all work; only the **inline preview** is dead.

This is distinct from `csp-blocks-dev-mode-hydration.md` (that one is
about dev-mode hydration scripts). This is a missing `frame-src`
allowance for the Supabase Storage origin in the prod CSP.

## Why it matters

Guide 06 step 2 instructs the assessor to "open the file in the inline
document viewer dialog. The dialog supports PDF / JPEG / PNG" and then
read it to verify it matches the slot. With the iframe blocked, the
assessor cannot preview documents in-app — they must Download or
Open-in-new-tab each one. The verify-checkbox flow itself works
(DOCUMENT_VERIFIED audit entry confirmed), and the assessment
calculation is unaffected, so this is a UX/workflow degradation rather
than a hard blocker — hence medium.

## Proposed approach

fix code. Add the Supabase Storage origin to the CSP `frame-src`
directive in the security headers (next.config / middleware where the
CSP is built):

```
frame-src 'self' https://<project-ref>.supabase.co;
```

Use the project-ref env var rather than hardcoding. Verify against both
nonprod and prod Supabase URLs. Confirm the document dialog and the
assessment doc panel render the embedded PDF after the change.

## Out of scope

Whether to switch from iframe embedding to a dedicated PDF.js viewer —
larger refactor; the CSP allowance is the minimal fix.
