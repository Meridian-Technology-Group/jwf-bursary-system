## 4. Functional Requirements Mapping

This section traces every PRD functional requirement (Section 3.1) to its implementing component, data entities, and server action or API route. The mapping provides a completeness check: every requirement must have at least one implementing component and data entity.

**Key:**
- **Route** — Next.js page or route group that renders the feature
- **Component** — React component(s) that implement the UI
- **Server logic** — Server action or API route that executes the operation
- **Entities** — Prisma models / database tables involved
- **Module** — TDD Section 7.x module

### 4.1 Applicant Portal (AP-01 – AP-14)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| AP-01 | Invitation-only registration | `(auth)/register/page.tsx` | `verifyOtp()` via Supabase Auth; `createInvitation()` server action | Profile, Invitation, Application | 7.1 |
| AP-02 | Single-user access model | Edge middleware (`middleware.ts`) | Role check: `applicant` role sees own data only | Profile (RLS) | 3.4.2 |
| AP-03 | Multi-step application form | `(portal)/apply/[section]/page.tsx`, `SectionForm`, `ProgressBar` | `saveSection()` server action | ApplicationSection | 7.1 |
| AP-04 | Conditional logic | `ConditionalField` component, section schema `conditions` array | Client-side; schema-driven show/hide | ApplicationSection (JSONB) | 7.1 |
| AP-05 | Entry year collection | `childDetailsSchema` — `entry_year` field (select) | `saveSection()` | ApplicationSection, Application (`entry_year`) | 7.1 |
| AP-06 | Document upload | `FileUpload` component | `POST /api/documents` | Document, Supabase Storage | 7.1, 7.4 |
| AP-07 | Save and resume | `SectionForm` save button | `saveSection()` — upserts ApplicationSection per section | ApplicationSection | 7.1 |
| AP-08 | Progress tracking | `ProgressBar` component (sidebar desktop / stepper mobile) | Server component loads `is_complete` per section | ApplicationSection | 7.1 |
| AP-09 | Validation summary | `(portal)/apply/review/page.tsx`, `ValidationSummary` | Server component queries all sections' `is_complete` + Document slot completeness | ApplicationSection, Document | 7.1 |
| AP-10 | Declaration and submission | Declaration section form + `submitApplication()` | `submitApplication()` — sets `Application.status = SUBMITTED`, `submitted_at`; sends confirmation email | Application, AuditLog | 7.1, 7.5 |
| AP-11 | Re-assessment pre-population | `SectionForm` receives `defaultValues` from previous year | Server component loads prior year's ApplicationSection JSONB for `CHILD_DETAILS`, `PARENT_DETAILS` | ApplicationSection, Application (`is_reassessment`) | 7.1 |
| AP-12 | Mobile-responsive design | All portal components use Tailwind responsive classes; `ProgressBar` collapses to horizontal stepper | N/A (CSS) | — | 7.1 |
| AP-13 | Status visibility | `(portal)/status/page.tsx` | Server component reads `Application.status` | Application | 7.1 |
| AP-14 | In-app messaging / notifications | `(portal)/page.tsx` (dashboard), notification badge | Server component reads recent AuditLog entries for the user's application | AuditLog, Application | 7.1 |

### 4.2 Admin Console — Round & Application Management (AC-01 – AC-09)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| AC-01 | Round management | `(admin)/rounds/...` | `createRound()`, `updateRound()`, `closeRound()` server actions | Round | 7.2.4 |
| AC-02 | Applicant invitation | `(admin)/invitations/...` | `createInvitation()` — calls `supabase.auth.admin.inviteUserByEmail()`, creates Application record, sends email via Resend | Invitation, Profile, Application | 7.2, 7.5 |
| AC-03 | Application queue | `(admin)/queue/page.tsx`, `ApplicationTable` | Server component fetches Application list (names excluded — NM-01). Client-side filtering/sorting via Tanstack Table | Application | 7.2.1 |
| AC-04 | Application detail view | `(admin)/applications/[id]/page.tsx` (Tab 1: Applicant Data) | Server component loads all ApplicationSections + Documents. Names visible (NM-04 context) | Application, ApplicationSection, Document | 7.2.2 |
| AC-05 | Document verification | `DocumentViewer` + verify toggle per slot | `verifyDocument()` server action | Document, AuditLog | 7.4.3 |
| AC-06 | Missing documents workflow | Email action in application detail; admin upload | `sendEmail()` (MISSING_DOCS template), `POST /api/documents` (admin upload), `updateStatus()` to PAUSED | Application, Document, EmailTemplate, AuditLog | 7.2, 7.4.4, 7.5 |
| AC-07 | Application status management | Status dropdown / actions in application detail | `updateApplicationStatus()` server action; logs status change | Application, AuditLog | 7.2.2 |
| AC-08 | Bulk operations | Bulk select checkboxes in `ApplicationTable` | `sendBatchEmails()`, `batchUpdateStatus()` server actions | Application, EmailTemplate | 7.2.1 |
| AC-09 | Dashboard | `(admin)/page.tsx` | Server component runs aggregate COUNT queries grouped by `Application.status` | Application, Round | 7.2.6 |

### 4.3 Admin Console — Assessment Engine (AE-01 – AE-17)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| AE-01 | Two-layer data model | Architecture: separate tables (ApplicationSection vs Assessment/AssessmentEarner) | `calculateAssessment()` input types accept only assessor-layer fields — compile-time enforcement | Application, ApplicationSection (layer 1); Assessment, AssessmentEarner, AssessmentProperty (layer 2) | 3.5, 7.3 |
| AE-02 | Assessor data entry form | `AssessmentForm` component (right panel of split-screen) | `saveAssessment()` server action | Assessment, AssessmentEarner | 7.2.3, 7.3 |
| AE-03 | Stage 1: Total Household Net Income | `calculateHouseholdIncome()` in `lib/assessment/stage1-income.ts` | Runs client-side (live) and server-side (on save) | AssessmentEarner | 7.3 |
| AE-04 | Benefit inclusion/exclusion | `AssessmentForm` — separate benefit fields per earner (included vs excluded) | `calculateHouseholdIncome()` sums only `benefitsIncluded` | AssessmentEarner (`benefits_included`, `benefits_excluded`) | 7.3 |
| AE-05 | Stage 2: Net Assets Position | `calculateNetAssets()` in `lib/assessment/stage2-assets.ts` | Runs client-side and server-side | Assessment, AssessmentProperty | 7.3 |
| AE-06 | Stage 3: Family Living Costs | `calculateLivingCosts()` in `lib/assessment/stage3-living.ts` | Runs client-side and server-side | Assessment (`utility_costs`, `food_costs`) | 7.3 |
| AE-07 | Stage 4: Bursary Impact | `calculateBursaryImpact()` in `lib/assessment/stage4-bursary.ts` | Runs client-side and server-side | Assessment (`annual_fees`, `required_bursary`) | 7.3 |
| AE-08 | Payable fees calculation | `calculatePayableFees()` in `lib/assessment/payable-fees.ts` | Runs client-side and server-side | Assessment (payable fees columns) | 7.3 |
| AE-09 | Auto-lookup of reference values | `AssessmentForm` — `onChange` handler for Family Type Category, School, Entry Year selects | Client-side: fetch current FamilyTypeConfig/SchoolFees/CouncilTaxDefault, populate form fields | FamilyTypeConfig, SchoolFees, CouncilTaxDefault → snapshotted to Assessment | 7.2.3, 7.3 |
| AE-10 | Manual adjustment field | `AssessmentForm` — `manual_adjustment` and `manual_adjustment_reason` fields | `saveAssessment()` stores values; `calculatePayableFees()` applies adjustment | Assessment (`manual_adjustment`, `manual_adjustment_reason`) | 7.2.3 |
| AE-11 | Schooling years remaining | `AssessmentForm` — auto-calculated from entry year, displayed in editable field | Calculated client-side; stored on Assessment | Assessment (`schooling_years_remaining`), Application (`entry_year`) | 7.2.3 |
| AE-12 | Configurable reference tables | `(admin)/settings/...` — tabbed interface | Server actions per table: `updateFamilyTypeConfig()`, `updateSchoolFees()`, `updateCouncilTax()`, `updateReasonCodes()` | FamilyTypeConfig, SchoolFees, CouncilTaxDefault, ReasonCode, AuditLog | 7.2.5 |
| AE-13 | Property classification | `AssessmentForm` — property category dropdown (1–12), threshold flag | Client-side: flag when category > threshold. `saveAssessment()` stores value | Assessment (`property_category`, `property_exceeds_threshold`) | 7.2.3 |
| AE-14 | Qualitative checklist tabs | `AssessmentForm` or separate sub-tabs within assessment view | `saveChecklist()` server action per tab | AssessmentChecklist | 7.2.3 |
| AE-15 | Year-on-year comparison | Assessment form shows prior year's values alongside current fields | Server action loads previous Assessment for same BursaryAccount | Assessment (current + previous year) | 7.2.3 |
| AE-17 | Split-screen document viewer | `SplitScreen` + `DocumentViewer` (left) + `AssessmentForm` (right) | `GET /api/documents/[id]/url` for pre-signed URLs | Document, Supabase Storage | 7.2.3 |
| AE-16 | Automatic change flagging (Phase 2) | Comparison logic in assessment form | Server action computes delta between prior and current year values | Assessment (two years) | — |

### 4.4 Sibling Linking (SL-01 – SL-05)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| SL-01 | Manual sibling linking | `(admin)/applications/[id]` — "Link Sibling" action, search dialog | `linkSiblings()` server action — search by reference/name/email, create SiblingLink rows | SiblingLink, BursaryAccount, AuditLog | 7.2, 7.3.3 |
| SL-02 | Sequential income absorption | `AssessmentForm` calculation display | `calculateAssessment()` receives `siblingPayableFees[]` from linked siblings' completed assessments | Assessment, SiblingLink | 7.3.3 |
| SL-03 | Sibling fee deduction | `applySiblingDeductions()` in `lib/assessment/sibling.ts` | Automatically loads older siblings' `yearlyPayableFees` on assessment form mount | Assessment, SiblingLink | 7.3.3 |
| SL-04 | Cross-school sibling support | Sibling search is not filtered by school | `linkSiblings()` does not enforce same-school constraint | SiblingLink, BursaryAccount | 7.3.3 |
| SL-05 | Sibling succession | Admin action to re-order priority | `updateSiblingPriority()` server action — updates `priority_order` | SiblingLink | 7.3.3 |

### 4.5 Assessment Output & Recommendations (AO-01 – AO-07)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| AO-01 | Structured recommendation | `(admin)/applications/[id]/recommend/page.tsx`, `RecommendationForm` | `saveRecommendation()` server action | Recommendation | 7.2.2 |
| AO-02 | Recommendation stored per account per year | Recommendation table FK to Assessment + BursaryAccount + Round | `saveRecommendation()` sets `bursary_account_id` and `round_id` | Recommendation, BursaryAccount, Round | 7.2.2 |
| AO-03 | Year-on-year reason codes | `RecommendationForm` — multi-select checkbox list | `saveRecommendation()` inserts RecommendationReasonCode junction rows | Recommendation, ReasonCode, RecommendationReasonCode | 7.2.2 |
| AO-04 | Reason code configuration | `(admin)/settings/` — Reason Codes tab | `updateReasonCodes()`, `createReasonCode()`, `deprecateReasonCode()` server actions | ReasonCode, AuditLog | 7.2.5 |
| AO-05 | Red flags | `RecommendationForm` — dishonesty + credit risk checkboxes | `saveRecommendation()` stores flags; `saveAssessment()` stores on Assessment too | Assessment, Recommendation (`dishonesty_flag`, `credit_risk_flag`) | 7.2.2 |
| AO-06 | Export for schools | Export button on reports page / recommendation tab | `GET /api/exports/recommendations?round_id=&school=` — `generateRecommendationExport()` (ExcelJS) | Recommendation, Assessment, Application (names included — NM-04) | 7.6.3 |
| AO-07 | PDF summary | Export button on application detail | `GET /api/exports/pdf/[assessment_id]` — `generateRecommendationPDF()` (@react-pdf/renderer) | Assessment, Recommendation, Application | 7.6.4 |

### 4.6 Annual Re-assessment Cycle (RA-01 – RA-08)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| RA-01 | Re-assessment invitation | `(admin)/invitations/` — batch invite button | `sendBatchReassessmentInvitations()` — iterates active BursaryAccounts, creates new Applications, sends REASSESSMENT emails | BursaryAccount, Application, Invitation, EmailTemplate | 7.2, 7.5 |
| RA-02 | Selective invitation | `(admin)/invitations/` — single invite form | `createInvitation()` with `bursary_account_id` set | Invitation, Application | 7.2 |
| RA-03 | Application pre-population | `SectionForm` receives `defaultValues` for address, child, family fields | Server component loads prior year's ApplicationSection JSONB | ApplicationSection, Application | 7.1 |
| RA-04 | ID section hidden | `SectionForm` schema — `FAMILY_ID` section hidden when `is_reassessment = true` | Conditional in server component: skip rendering `FAMILY_ID` section | Application (`is_reassessment`), ApplicationSection | 7.1 |
| RA-05 | Bursary account reference | Displayed in queue, assessment header, recommendation | Reference generated on BursaryAccount creation (`WS-xxx` / `TS-xxx`) | BursaryAccount (`reference`) | 7.2 |
| RA-06 | Progress schedule | `(admin)/applications/[id]/history/page.tsx` — year-by-year schedule | Server component queries all Applications for a BursaryAccount ordered by Round | Application, BursaryAccount, Round | 7.2.2 |
| RA-07 | Benchmark display | `AssessmentForm` — benchmark callout alongside calculation results | Server action loads `BursaryAccount.benchmark_payable_fees` | BursaryAccount, Assessment | 7.2.3 |
| RA-08 | Benchmark tracking dashboard (Phase 2) | `(admin)/reports/` — longitudinal benchmark chart | Server component loads all Assessments for an account across rounds | Assessment, BursaryAccount | 7.6 |

### 4.7 Internal Bursary Requests (IB-01 – IB-03)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| IB-01 | Ad-hoc application creation | `(admin)/invitations/` — "Create Application" action with no round constraint | `createInvitation()` with `is_internal = true`, `round_id` nullable or current round | Application (`is_internal`), Invitation | 7.2 |
| IB-02 | Non-standard entry year | `AssessmentForm` — `schooling_years_remaining` editable field accepts any value | `saveAssessment()` stores override | Assessment (`schooling_years_remaining`), Application (`entry_year`) | 7.2.3 |
| IB-03 | Conversion to rolling bursary | When assessment outcome = QUALIFIES, create BursaryAccount | `completeAssessment()` server action creates BursaryAccount if none exists, links Application | BursaryAccount, Application | 7.2 |

### 4.8 Document Management (DM-01 – DM-06)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| DM-01 | Structured upload slots | `FileUpload` component per slot in `SectionForm` | `POST /api/documents` with `slot` parameter | Document (`slot`) | 7.1, 7.4 |
| DM-02 | Admin document attachment | Upload control in application detail view | `POST /api/documents` — authorised for assessor; `uploaded_by` = assessor | Document (`uploaded_by`), Supabase Storage | 7.4.4 |
| DM-03 | Inline viewing | `DocumentViewer` component (iframe for PDF, img for images) | `GET /api/documents/[id]/url` — returns pre-signed URL (60-min expiry) | Document, Supabase Storage | 7.4.2 |
| DM-04 | Encrypted storage | Supabase Storage bucket configured as private + encrypted | N/A (infrastructure) — AES-256 SSE-S3 at rest, TLS in transit | Supabase Storage | 3.4.5 |
| DM-05 | Retention and deletion | Deletion cascade (Section 6.5); scheduled retention check | `deleteApplicantData()` server action triggers cascade; scheduled job flags expired records | All entities (cascade), AuditLog | 6.5, 7.7 |
| DM-06 | ID document carry-forward | Documents from prior application visible to assessor; `FAMILY_ID` section hidden for re-assessments | Server component loads Documents from prior Application for same BursaryAccount | Document, Application, BursaryAccount | 7.1, 7.4 |

### 4.9 User Management & Authentication (UM-01 – UM-05)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| UM-01 | Invitation-based applicant registration | `(auth)/register/page.tsx` — password form (email pre-filled from invite token) | `verifyOtp(token)`, `updateUser(password)` via Supabase Auth | Profile, Invitation | 3.4.1 |
| UM-02 | Applicant authentication | `(auth)/login/page.tsx`, `(auth)/reset-password/page.tsx` | `signInWithPassword()`, `resetPasswordForEmail()` via Supabase Auth | Profile (session) | 3.4.1 |
| UM-03 | Admin authentication | `(auth)/login/page.tsx` + `(auth)/verify/page.tsx` (MFA) | `signInWithPassword()` + `verifyMFA()` via Supabase Auth (TOTP) | Profile (session, `mfa_verified`) | 3.4.1 |
| UM-04 | Admin roles | Edge middleware role check; RLS policies | `app_metadata.role` set on user creation (assessor, viewer) | Profile (`role`) | 3.4.2 |
| UM-05 | Account persistence across rounds | No account deletion between rounds; re-assessment re-uses existing Profile | `sendBatchReassessmentInvitations()` resets Application, does not create new Profile | Profile, Application | 7.2 |

### 4.10 Email Notifications (EN-01 – EN-07)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| EN-01 | Invitation email | Triggered from `(admin)/invitations/` | `sendEmail(to, 'INVITATION', mergeData)` via Resend | EmailTemplate, Invitation | 7.5 |
| EN-02 | Submission confirmation | Auto-triggered on `submitApplication()` | `sendEmail(to, 'CONFIRMATION', mergeData)` | EmailTemplate, Application | 7.5 |
| EN-03 | Missing documents request | Triggered from application detail — "Request Documents" action | `sendEmail(to, 'MISSING_DOCS', mergeData)` | EmailTemplate, Document | 7.5 |
| EN-04 | Outcome notification | Triggered on `completeAssessment()` | `sendEmail(to, 'OUTCOME_QUALIFIES' or 'OUTCOME_DNQ', mergeData)` | EmailTemplate, Assessment | 7.5 |
| EN-05 | Re-assessment invitation | Triggered from batch re-assessment invitations | `sendEmail(to, 'REASSESSMENT', mergeData)` | EmailTemplate, BursaryAccount | 7.5 |
| EN-06 | Templated and configurable | `(admin)/settings/` — Email Templates tab, `EmailTemplatePreview` component | Server action `updateEmailTemplate()` | EmailTemplate | 7.5 |
| EN-07 | Reminder emails | Bulk action in application queue — "Send Reminders" | `sendBatchEmails(recipients, 'REMINDER')` via Resend batch API | EmailTemplate, Application | 7.5 |

### 4.11 Data Export & Reporting (DE-01 – DE-04)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| DE-01 | Recommendation export | Export button on reports / recommendation tab | `GET /api/exports/recommendations` — `generateRecommendationExport()` (ExcelJS) | Recommendation, Assessment, Application | 7.6.3 |
| DE-02 | Field-level data export | Export button on queue / report views | `GET /api/exports/data?filters=...` — `generateReportExport()` (ExcelJS) | Application, Assessment (filtered) | 7.6.3 |
| DE-03 | Report export | "Export" button on every canned/ad-hoc report | `GET /api/exports/report?type=...&format=xlsx` | Report-specific entities | 7.6.3 |
| DE-04 | Audit trail | `(admin)/applications/[id]/history/page.tsx` (Tab 4), `(admin)/audit/` (global) | Server component queries AuditLog filtered by entity or user | AuditLog | 7.7 |

### 4.12 Reporting & Analytics (RP-01 – RP-09)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| RP-01 | Round summary report | `(admin)/reports/round-summary` — Recharts bar/pie + table | Server component: `COUNT(Application) GROUP BY status, school` | Application, Round | 7.6.1 |
| RP-02 | Bursary awards report | `(admin)/reports/bursary-awards` — trend line + table | Server component: `SUM/AVG(Assessment.yearly_payable_fees) GROUP BY school, round` | Assessment, Round | 7.6.1 |
| RP-03 | Income distribution report | `(admin)/reports/income-distribution` — histogram | Server component: banded aggregation of `Assessment.total_household_net_income` | Assessment | 7.6.1 |
| RP-04 | Property category distribution | `(admin)/reports/property-categories` — bar chart | Server component: `COUNT(Assessment) GROUP BY property_category` | Assessment | 7.6.1 |
| RP-05 | Reason code frequency | `(admin)/reports/reason-codes` — ranked list | Server component: `COUNT(RecommendationReasonCode) GROUP BY reason_code_id` | RecommendationReasonCode, ReasonCode | 7.6.1 |
| RP-06 | Active bursaries approaching final year | `(admin)/reports/approaching-final-year` — table | Server component: BursaryAccount where `entry_year + elapsed ≥ 12` | BursaryAccount, Assessment | 7.6.1 |
| RP-07 | Sibling bursary summary | `(admin)/reports/sibling-summary` — table (reference numbers, not names — NM-03) | Server component: SiblingLink join BursaryAccount + Assessment | SiblingLink, BursaryAccount, Assessment | 7.6.1 |
| RP-08 | Ad-hoc report builder | `(admin)/reports/builder/page.tsx` — client component with filter/group/chart selectors | `buildReport()` server action: runs parameterised query, returns aggregated data | Application, Assessment, BursaryAccount (filtered) | 7.6.2 |
| RP-09 | Report scheduling (Phase 2) | Scheduled job (cron) | Cloud function or Vercel cron job | — | — |

### 4.13 GDPR & Data Governance (GD-01 – GD-05)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| GD-01 | 7-year retention | Scheduled job (Vercel cron or Supabase pg_cron) flags expired accounts | Queries BursaryAccount where `closed_at + 7 years < now()`, sets `retention_expired` flag | BursaryAccount (`retention_expires_at`) | 6.5 |
| GD-02 | Rejected application purge | Scheduled job flags DNQ applications past appeal window | Queries Application where `status = DOES_NOT_QUALIFY` and `completed_at + 28 days < now()` | Application, Assessment | 6.5 |
| GD-03 | Right-to-deletion | `(admin)/applications/[id]` — "Delete Applicant Data" action with confirmation dialog | `deleteApplicantData()` server action — full cascade (Section 6.5) + Supabase Auth user deletion | All entities (cascade), AuditLog | 6.5, 7.7 |
| GD-04 | No school access | Architecture: no school-facing routes, no school role | Edge middleware has no `school` role. Exports are file downloads, not live access. | — | 3.4.2 |
| GD-05 | Data encryption | Supabase (AES-256 at rest), Vercel (TLS 1.2+ in transit) | N/A (infrastructure) | — | 3.4.5 |

### 4.14 Data Minimisation & Name Masking (NM-01 – NM-05)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| NM-01 | Default name masking in queue | `ApplicationTable` — name columns absent by default; "Show Names" toggle | Toggle calls `GET /api/applications/names?ids=...` (separate fetch, audit-logged). Default query selects `reference, school, status, submitted_at` only. | Application, AuditLog | 7.2.1, 3.4.3 |
| NM-02 | Anonymised labels in assessment form | `AssessmentForm` header shows reference number; earner labels "Parent 1"/"Parent 2" | Query for assessment data does not join Profile names. Reference from BursaryAccount/Application. | Assessment, AssessmentEarner | 7.2.3, 3.4.3 |
| NM-03 | Anonymised reports and analytics | All report components use reference numbers; no name columns in report queries | Report queries join on reference, not name. Only recommendation export includes names (NM-04). | Varies by report | 7.6, 3.4.3 |
| NM-04 | Name-revealed contexts | Application detail (Tab 1), communication screens, recommendation export | These queries include Profile name fields. No audit log for these contexts (names are required). | Profile, Application, Recommendation | 7.2.2, 7.5, 7.6.3 |
| NM-05 | Audit logging of name reveal | Name toggle in queue logs to AuditLog | `GET /api/applications/names` handler calls `auditLog({ action: 'NAME_REVEAL', context: 'application_queue' })` | AuditLog | 7.7 |

### 4.15 Coverage Summary

| PRD Section | Requirement Count | All Mapped? |
|-------------|------------------|-------------|
| 3.1.1 Applicant Portal | 14 (AP-01 – AP-14) | Yes |
| 3.1.2 Round & Application Management | 9 (AC-01 – AC-09) | Yes |
| 3.1.3 Assessment Engine | 17 (AE-01 – AE-17, incl. AE-16 Phase 2) | Yes |
| 3.1.4 Sibling Linking | 5 (SL-01 – SL-05) | Yes |
| 3.1.5 Assessment Output | 7 (AO-01 – AO-07) | Yes |
| 3.1.6 Re-assessment Cycle | 8 (RA-01 – RA-08) | Yes |
| 3.1.7 Internal Bursary Requests | 3 (IB-01 – IB-03) | Yes |
| 3.1.8 Document Management | 6 (DM-01 – DM-06) | Yes |
| 3.1.9 User Management | 5 (UM-01 – UM-05) | Yes |
| 3.1.10 Email Notifications | 7 (EN-01 – EN-07) | Yes |
| 3.1.11 Data Export | 4 (DE-01 – DE-04) | Yes |
| 3.1.13 Reporting & Analytics | 9 (RP-01 – RP-09) | Yes |
| 3.1.12 GDPR & Data Governance | 5 (GD-01 – GD-05) | Yes |
| 3.1.14 Data Minimisation | 5 (NM-01 – NM-05) | Yes |
| **Total** | **104** | **Yes** |

Phase 2 items (AE-16, RA-08, RP-09) are noted but not architecturally detailed — they will be designed when prioritised.

---
