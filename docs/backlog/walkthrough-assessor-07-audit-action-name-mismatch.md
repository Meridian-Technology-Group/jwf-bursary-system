---
title: Guide 07 names the wrong audit action for assessor document uploads
status: open
severity: low
area: docs
opened: 2026-05-20
opened_by: walkthrough-verification-pass
related:
  - docs/walkthroughs/assessors/07-upload-document-on-behalf-of-applicant.md
---

## Context

Verifying `assessors/07-upload-document-on-behalf-of-applicant`. The
upload flow works end to end: selecting a slot, picking a PDF, and
clicking Upload Document produced the green "… uploaded successfully"
banner, bumped Documents (4) → (5), and added the new
`SELF_ASSESSMENT_PARENT_1` row.

The guide's Verification section says: "The audit log records
`DOCUMENT_UPLOADED` attributed to you (not the lead applicant)." The
actual audit action written is **`DOCUMENT_UPLOADED_BY_ASSESSOR`** (no
plain `DOCUMENT_UPLOADED` row is created for assessor uploads).

## Why it matters

Cosmetic / documentation accuracy only. Anyone grepping the audit log
for `DOCUMENT_UPLOADED` per the guide would miss assessor uploads. The
distinct action name is arguably better (it already encodes the
attribution the guide describes), so the doc is the thing to fix.

## Proposed approach

fix doc. Change the guide's Verification line to reference
`DOCUMENT_UPLOADED_BY_ASSESSOR`.

## Out of scope

n/a
