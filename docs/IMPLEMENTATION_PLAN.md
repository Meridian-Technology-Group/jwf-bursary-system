# John Whitgift Foundation — Bursary Assessment System
## Technical Implementation Plan

**Version:** 1.0 | **Date:** 2026-02-25 | **Purpose:** Phased work packages for Claude Code implementation
**Source docs:** `docs/TDD.md` v1.0, `docs/PRD.md` v1.2, `README.md`, `docs/planning/APPLICATION.md`, `docs/planning/ADMIN.md`

---

## How to Use This Plan

This plan breaks the TDD's four phases into **23 discrete work packages** (WP-01 through WP-23). Each is designed to be completable in a single Claude Code session.

- **Dependencies** — listed per WP; must be completed first
- **`[CREDENTIALS REQUIRED]`** — user must provide credentials before that WP can proceed
- **Status** — update as work progresses: `Not Started` → `In Progress` → `Complete`
- **Verification** — how to confirm each WP works

After completing each WP, update its status below and note any issues.

---

## Credentials Checklist

Before starting, gather these credentials and fill them in:

| Service | Required For | Value |
|---------|-------------|-------|
| **Supabase Project URL** | WP-01 | Store in `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` |
| **Supabase Anon Key** | WP-01 | Store in `.env.local` as `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **Supabase Service Role Key** | WP-01 | Store in `.env.local` as `SUPABASE_SERVICE_ROLE_KEY` |
| **Supabase Transaction Pooler URL** (runtime) | WP-01 | Store in `.env.local` as `DATABASE_URL` |
| **Supabase Direct Connection URL** (migrations) | WP-01 | Store in `.env.local` as `DIRECT_URL` |
| **Resend API Key** | WP-05 | Store in `.env.local` as `RESEND_API_KEY` |
| **Resend From Email** | WP-05 | Store in `.env.local` as `RESEND_FROM_EMAIL` |
| **Vercel Project ID** | WP-23 | Store in `.env.local` as `VERCEL_PROJECT_ID` |
| **Vercel Team** (if applicable) | WP-23 | Store in `.env.local` as `VERCEL_TEAM_ID` |
| **Domain** (for production URL) | WP-23 | Configure in Vercel dashboard |

> **All credentials belong in `.env.local` (gitignored) — never commit secrets to the repo.** See `.env.example` for the template.

> **Supabase:** Project already created in London (eu-west-2). Ensure Email/Password auth provider is enabled. Create a private storage bucket named `documents`.
> **Resend:** Create an account at resend.com. Add and verify a sending domain. Generate an API key.
> **Vercel:** Will deploy to Vercel for the demo. Link the GitHub repo to a Vercel project.
> **Charts:** Using **Recharts** for all report visualisations.

---

## Progress Summary

| Phase | Work Packages | Status |
|-------|--------------|--------|
| **Phase 1: Foundation** | WP-01 through WP-05 | Complete |
| **Phase 2: Core Application** | WP-06 through WP-16 | Complete |
| **Phase 3: Output & Polish** | WP-17 through WP-22 | Complete |
| **Phase 4: Demo Deployment** | WP-23 | Not Started |

---

## Phase 1: Foundation

### WP-01: Project Scaffolding & Database Schema

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Large |
| **Dependencies** | None |
| **Credentials** | `[CREDENTIALS REQUIRED]` — Supabase URL, keys, database URLs |

**Deliverables:**
1. Initialize Next.js 14 app with TypeScript, Tailwind CSS, App Router
2. Install and configure: Prisma, `@supabase/supabase-js`, `@supabase/ssr`, shadcn/ui
3. Create the complete Prisma schema (all entities from TDD Section 6)
4. Run initial migration against Supabase
5. Create `.env.local` with all environment variables (template from `.env.example`)
6. Configure `tsconfig.json` path aliases (`@/` → `src/`)

**Key files to create:**
```
.env.example                    # Template with all env vars (no secrets)
src/lib/db/prisma.ts           # Prisma client singleton
prisma/schema.prisma           # Complete schema (all entities below)
```

**Prisma Schema — all entities (from TDD Section 6):**

Enums: `Role` (APPLICANT, ASSESSOR, VIEWER, DELETED), `School` (TRINITY, WHITGIFT), `RoundStatus` (DRAFT, OPEN, CLOSED), `ApplicationStatus` (PRE_SUBMISSION, SUBMITTED, NOT_STARTED, PAUSED, COMPLETED, QUALIFIES, DOES_NOT_QUALIFY), `AssessmentStatus` (NOT_STARTED, PAUSED, COMPLETED), `AssessmentOutcome` (QUALIFIES, DOES_NOT_QUALIFY), `EarnerLabel` (PARENT_1, PARENT_2), `EmploymentStatus` (PAYE, BENEFITS, SELF_EMPLOYED_DIRECTOR, SELF_EMPLOYED_SOLE, OLD_AGE_PENSION, PAST_PENSION, UNEMPLOYED), `ChecklistTab` (BURSARY_DETAILS, LIVING_CONDITIONS, DEBT, OTHER_FEES, STAFF, FINANCIAL_PROFILE), `ApplicationSectionType` (CHILD_DETAILS, FAMILY_ID, PARENT_DETAILS, DEPENDENT_CHILDREN, DEPENDENT_ELDERLY, OTHER_INFO, PARENTS_INCOME, ASSETS_LIABILITIES, ADDITIONAL_INFO, DECLARATION), `InvitationStatus` (PENDING, ACCEPTED, EXPIRED), `EmailTemplateType` (INVITATION, CONFIRMATION, MISSING_DOCS, OUTCOME_QUALIFIES, OUTCOME_DNQ, REASSESSMENT, REMINDER), `BursaryAccountStatus` (ACTIVE, CLOSED)

Tables: Profile, Round, BursaryAccount, Application (unique: bursary_account_id + round_id), ApplicationSection (unique: application_id + section), Document, Assessment (unique: application_id), AssessmentEarner (unique: assessment_id + earner_label), AssessmentProperty (unique: assessment_id), AssessmentChecklist (unique: assessment_id + tab), Recommendation (unique: assessment_id), ReasonCode, RecommendationReasonCode (composite PK), SiblingLink (unique: family_group_id + bursary_account_id), FamilyTypeConfig (unique: category + effective_from), SchoolFees (unique: school + effective_from), CouncilTaxDefault, Invitation, EmailTemplate (unique: type), AuditLog

See TDD Section 6 for all field definitions, types, constraints, and relations.

**Verification:**
- `npx prisma migrate dev` succeeds
- `npx prisma studio` opens and shows all tables
- `.env.example` documents all required variables

---

### WP-02: Authentication & Middleware

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Medium |
| **Dependencies** | WP-01 |

**Deliverables:**
1. Supabase Auth client setup (server + browser)
2. Edge middleware for auth check and role-based route protection
3. Auth pages: login, registration (invitation-based), password reset
4. Role guard helpers
5. Profile creation on user registration (database trigger or webhook)

**Key files to create:**
```
src/lib/auth/supabase.ts          # createServerClient, createBrowserClient
src/lib/auth/roles.ts             # Role constants, guard helpers (requireRole, isAssessor, etc.)
src/lib/auth/middleware.ts         # Auth check + role resolution for Edge middleware
src/app/middleware.ts              # Edge middleware: verify session, enforce route access
src/app/(auth)/login/page.tsx     # Email + password login form
src/app/(auth)/register/page.tsx  # Invitation-based registration (reads token from URL)
src/app/(auth)/reset-password/page.tsx
src/app/(auth)/layout.tsx         # Minimal auth layout (centered card)
```

**Route protection rules (middleware.ts):**
- `/(portal)/*` → requires `APPLICANT` role
- `/(admin)/*` → requires `ASSESSOR` or `VIEWER` role
- `/(auth)/*` → public
- Unauthenticated → redirect to `/login`
- Wrong role → redirect to appropriate home

**Verification:**
- Can log in as assessor → redirected to admin dashboard shell
- Can log in as applicant → redirected to portal dashboard shell
- Unauthenticated access to `/admin` → redirected to `/login`
- Applicant accessing `/admin` → redirected to portal

---

### WP-03: Layout Shells & UI Foundation

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Medium |
| **Dependencies** | WP-02 |

**Deliverables:**
1. Root layout with providers (Supabase, theme)
2. Portal layout: minimal header, progress sidebar (mobile: collapsible stepper)
3. Admin layout: sidebar navigation, header with user menu, content area
4. Install shadcn/ui components: Button, Input, Label, Card, Table, Tabs, Dialog, Select, Checkbox, RadioGroup, Textarea, Badge, DropdownMenu, Sheet, Separator, Toast, Form (react-hook-form + zod)
5. Shared components: loading spinners, error boundaries, empty states

**Key files to create:**
```
src/app/layout.tsx                   # Root layout (providers, fonts, metadata)
src/app/(portal)/layout.tsx          # Portal shell
src/app/(portal)/page.tsx            # Portal dashboard (placeholder)
src/app/(admin)/layout.tsx           # Admin shell with sidebar nav
src/app/(admin)/page.tsx             # Admin dashboard (placeholder)
src/components/ui/...                # shadcn/ui components (via CLI)
src/components/shared/loading.tsx
src/components/shared/error-boundary.tsx
```

**Admin sidebar navigation items:**
- Dashboard, Application Queue, Rounds, Invitations, Settings, Reports

**Verification:**
- Portal layout renders with progress sidebar on desktop, mobile stepper on mobile
- Admin layout renders with sidebar navigation, all nav items visible
- Both layouts are responsive (test at 375px, 768px, 1280px)

---

### WP-04: Seed Data & Reference Tables

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Medium |
| **Dependencies** | WP-01 |

**Deliverables:**
1. Seed script that populates all reference tables and demo data
2. All 35 reason codes
3. Family type configs (categories 1-6) with notional rents, utility costs, food costs
4. School fees (Trinity: £30,702, Whitgift: £31,752 — 2026-27, pre-VAT)
5. Council tax default (Band D Croydon: £2,480)
6. All 7 email templates with realistic content and merge fields
7. Demo users (1 assessor, 3 applicants)
8. Demo bursary accounts, applications at various stages, and a completed assessment

**Key files to create:**
```
prisma/seed.ts                     # Main seed script
prisma/seed-data/reference.ts      # FamilyTypeConfig, SchoolFees, CouncilTaxDefault
prisma/seed-data/reason-codes.ts   # All 35 reason codes
prisma/seed-data/email-templates.ts # 7 email templates with merge fields
prisma/seed-data/demo-users.ts     # Test users (assessor + applicants)
prisma/seed-data/demo-applications.ts # Demo applications at various stages
```

**Seed data detail:**

*Family Type Configs (from README):*
| Cat | Description | Notional Rent | Utilities | Food |
|-----|-------------|--------------|-----------|------|
| 1 | Sole parent, 1 child | £13,000 | £1,200 | £5,000 |
| 2 | Parents, 1 child | £15,000 | £1,500 | £7,500 |
| 3 | Parents, 2 children | £18,000 | £2,000 | £8,500 |
| 4 | Parents, 3 children | £20,000 | £2,500 | £9,500 |
| 5 | Parents, 4 children | £23,000 | £3,000 | £10,500 |
| 6 | Parents, 5+ children | £26,000 | £3,300 | £12,000 |

*Reason Codes (all 35 from README):*
Codes 1-35 as documented (1=No real change, 2=Property increased, ... 35=Stopped qualifying for benefits)

*Demo Scenarios:*
1. **The Okafor Family** (new application, submitted, assessment complete, qualifies)
   - Two parents, 2 children, PAYE employed, renting
   - Child: Year 7 at Whitgift, ref WS-2601
   - Household income: £42,000 net, Category 3
   - Bursary award calculated, payable fees set
2. **The Patel Family** (re-assessment, pre-populated, submitted, assessment in progress)
   - Two parents, 3 children, one self-employed director
   - Child: Year 9 at Trinity (existing bursary from Year 7), ref TS-2401
   - Previous year data pre-populated
3. **The Williams Family** (sibling link example)
   - Sole parent, 2 children at different schools
   - Child 1: WS-2501 (Whitgift, Year 9, existing bursary)
   - Child 2: TS-2601 (Trinity, Year 7, new application)
   - Sibling link demonstrates sequential income absorption
4. **The Chen Family** (new application, submitted, not yet assessed)
   - Two parents, 1 child, Year 6 at Trinity
   - Application submitted but assessment not started

*Email Templates:*
- INVITATION: "You have been invited to apply for a bursary..."
- CONFIRMATION: "Your bursary application has been received..."
- MISSING_DOCS: "We require the following documents..."
- OUTCOME_QUALIFIES: "Following our assessment, we are pleased to inform you..."
- OUTCOME_DNQ: "Following our assessment, we regret to inform you..."
- REASSESSMENT: "It is time for your annual bursary re-assessment..."
- REMINDER: "This is a reminder that your bursary application is due..."

**Verification:**
- `npx prisma db seed` succeeds
- `npx prisma studio` shows populated reference tables, demo users, demo applications
- All 35 reason codes present
- All 7 email templates present with merge fields
- Demo assessment for Okafor family shows calculated bursary and payable fees

---

### WP-05: Email Service Integration

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Small |
| **Dependencies** | WP-01, WP-04 |
| **Credentials** | `[CREDENTIALS REQUIRED]` — Resend API key, from email |

**Deliverables:**
1. Resend client setup
2. Email sending function with merge field replacement
3. Template loading from database
4. Webhook endpoint for delivery status tracking

**Key files to create:**
```
src/lib/email/resend.ts            # Resend client singleton
src/lib/email/send.ts              # sendEmail(to, templateType, mergeData), sendBatchEmails()
src/lib/email/merge.ts             # Replace {{field}} merge tags in subject/body
src/app/api/webhooks/resend/route.ts  # Resend delivery webhook
```

**Verification:**
- Call `sendEmail()` with test data → email delivered via Resend
- Merge fields replaced correctly in subject and body
- Resend webhook endpoint responds 200 to test payload

---

## Phase 2: Core Application

### WP-06: Applicant Portal — Form Engine & Schemas

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Large |
| **Dependencies** | WP-03 |

**Deliverables:**
1. Zod schemas for all 10 application form sections (validation rules, conditional logic)
2. `SectionForm` component: generic form wrapper that renders fields from schema
3. Form field components: text, currency, date, dropdown, radio, checkbox, textarea, repeatable table (for dependents)
4. Conditional logic engine (show/hide fields based on answers)
5. Section navigation with progress tracking
6. Save/resume per section (server action → ApplicationSection JSONB upsert)
7. TypeScript types for all section data shapes

**Key files to create:**
```
src/types/application.ts           # Section data types
src/lib/schemas/                   # Zod schemas per section
  child-details.ts
  family-id.ts
  parent-details.ts
  dependent-children.ts
  dependent-elderly.ts
  other-info.ts
  parents-income.ts
  assets-liabilities.ts
  additional-info.ts
  declaration.ts
src/components/portal/section-form.tsx    # Generic section renderer
src/components/portal/form-fields/       # Field components
  currency-input.tsx
  conditional-field.tsx
  repeatable-table.tsx
src/components/portal/progress-bar.tsx    # Section progress indicator
src/app/(portal)/apply/[section]/page.tsx # Dynamic section route
src/app/(portal)/apply/actions.ts        # Server actions: saveSection, getSection
src/lib/db/queries/applications.ts       # Application CRUD queries
```

**Section schemas (from APPLICATION.md):**

| # | Section | Key Fields | Conditional Logic |
|---|---------|-----------|-------------------|
| 1 | Child Details | School (dropdown), entry year (Y6/7/9/12/Other), name, DOB, address, birth cert upload | Child address same as Parent 1 → hide address fields |
| 2 | Family ID | Passport/ILR uploads per family member (repeatable) | British citizen → UK passport only; Non-British → passport + ILR. Hidden for re-assessments |
| 3 | Parent Details | Sole parent (Y/N), relationship status, contact info, employment per parent | Sole parent = Yes → hide Parent 2. Employment status drives profession/director/evidence fields |
| 4 | Dependent Children | Children table (name, DOB, school, bursary) | Named child auto-populated |
| 5 | Dependent Elderly | At home (Y/N + count + details), in care (Y/N + count + details + fees) | Yes → show detail form |
| 6 | Other Info | Court orders, insurance policies, outstanding fees | Each Yes → show amount + evidence |
| 7 | Parents' Income | 14 income line items per parent, P60/tax doc uploads | Parent 2 visible only if not sole parent |
| 8 | Assets & Liabilities | Property, vehicles, investments, bank stmts, mortgages, overdrafts | Own/rent conditional, other properties conditional, HP conditional |
| 9 | Additional Info | Circumstances checklist (6 items each with Y/N + upload), free-text narrative | Each Yes → upload slot |
| 10 | Declaration | Legal text + checkbox + signature | Must accept to submit |

**Verification:**
- Navigate to each section → correct fields rendered
- Conditional logic works (toggle sole parent → Parent 2 hides/shows)
- Save section → data persisted in ApplicationSection table (JSONB)
- Navigate away and return → data restored from DB
- Progress bar shows complete/incomplete per section

---

### WP-07: Applicant Portal — Document Upload & Submission

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Medium |
| **Dependencies** | WP-06 |

**Deliverables:**
1. `FileUpload` component with drag-and-drop, file type/size validation
2. Document upload API route (multipart form → Supabase Storage)
3. Document listing per slot (show uploaded files, allow delete before submission)
4. Validation summary page (all incomplete fields/uploads listed, links to sections)
5. Submit action (locks application, sets status to SUBMITTED, sends confirmation email)
6. Post-submission read-only view
7. Applicant status page (Draft / Submitted / Under Review / Outcome Available)

**Key files to create:**
```
src/components/portal/file-upload.tsx          # Upload component with validation
src/app/api/documents/route.ts                 # POST: upload file
src/app/api/documents/[id]/route.ts            # DELETE: remove file
src/app/api/documents/[id]/url/route.ts        # GET: pre-signed URL (60-min expiry)
src/lib/storage/documents.ts                   # Upload, download URL, delete helpers
src/app/(portal)/apply/review/page.tsx         # Validation summary
src/app/(portal)/apply/actions.ts              # submitApplication() server action
src/app/(portal)/submitted/page.tsx            # Read-only post-submission view
src/app/(portal)/status/page.tsx               # Application status tracker
```

**File validation rules:**
- Accepted: PDF, JPEG, PNG
- Max size: 20 MB per file
- Storage path: `documents/{application_id}/{slot}/{uuid}_{filename}`

**Verification:**
- Upload a PDF → appears in Supabase Storage bucket
- Upload a 25MB file → rejected with error
- Upload a .exe file → rejected with error
- Validation summary shows all missing fields/uploads
- Submit with missing fields → blocked
- Submit with all complete → status changes to SUBMITTED, confirmation email sent
- Post-submission → form is read-only

---

### WP-08: Assessment Engine (Pure Business Logic)

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Medium |
| **Dependencies** | WP-01 |

**Deliverables:**
1. All pure TypeScript calculation functions (no DB, no UI — importable by both client and server)
2. Stage 1: `calculateHouseholdIncome(earners)` — sum net income by employment type
3. Stage 2: `calculateNetAssets(income, property, savings)` — property adjustments + savings annualisation
4. Stage 3: `calculateLivingCosts(netAssets, utilities, food)` — deduct living costs → HNDI after NS
5. Stage 4: `calculateBursaryImpact(hndiAfterNS, annualFees)` — required bursary
6. Payable fees: `calculatePayableFees(grossFees, scholarshipPct, bursaryAward, vatRate, manualAdjustment)`
7. Sibling: `applySiblingDeductions(hndiAfterNS, siblingPayableFees[])`
8. Orchestrator: `calculateAssessment(input)` → full output
9. Comprehensive unit tests

**Key files to create:**
```
src/lib/assessment/types.ts           # EarnerInput, AssessmentInput, AssessmentOutput, StageResults
src/lib/assessment/stage1-income.ts
src/lib/assessment/stage2-assets.ts
src/lib/assessment/stage3-living.ts
src/lib/assessment/stage4-bursary.ts
src/lib/assessment/payable-fees.ts
src/lib/assessment/sibling.ts
src/lib/assessment/calculator.ts      # Orchestrator
src/lib/assessment/__tests__/
  stage1-income.test.ts
  stage2-assets.test.ts
  stage3-living.test.ts
  stage4-bursary.test.ts
  payable-fees.test.ts
  sibling.test.ts
  calculator.test.ts                  # End-to-end with demo scenarios
```

**Calculation formulas (from TDD Section 7.3 / README):**

*Stage 1:* `totalHouseholdNetIncome = Σ earner.netPay + earner.netDividends + earner.netSelfEmployedProfit + earner.pensionAmount + earner.benefitsIncluded` (exclude benefitsExcluded)

*Stage 2:*
- Deduct notional rent
- If mortgage-free: add back notional rent
- If additional properties: add additional property income
- Deduct council tax (always Band D Croydon = £2,480)
- Savings: `(cashSavings + isasPepsShares) / schoolAgeChildrenCount / schoolingYearsRemaining`
- Add derived savings annual total

*Stage 3:* `hndiAfterNS = Stage2 result - utilityCosts - foodCosts`

*Stage 4:* `requiredBursary = annualFees - hndiAfterNS` (clamped 0 to annualFees)

*Payable Fees:*
- `scholarshipDeduction = grossFees × scholarshipPct/100`
- `netYearlyFees = grossFees - scholarshipDeduction - bursaryAward` (min 0)
- `yearlyPayableFees = netYearlyFees × (1 + vatRate/100)`
- Apply manual adjustment (min 0)
- `monthlyPayableFees = adjustedYearly / 12`

**Test cases (using seed data families):**
- Okafor family: 2 parents PAYE, renting, Cat 3, Year 7 Whitgift → expected bursary + payable fees
- Williams family: sole parent, sibling link → Child 1 absorbs income, Child 2 gets full bursary
- Edge cases: zero income, high income (no bursary), mortgage-free, large savings, single parent

**Verification:**
- `npx vitest run src/lib/assessment/` — all tests pass
- Each stage function tested independently
- Orchestrator tested end-to-end
- Payable fees match formula to the penny
- Sibling deduction correctly chains through multiple children

---

### WP-09: Admin — Application Queue & Detail View

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Medium |
| **Dependencies** | WP-03, WP-04 |

**Deliverables:**
1. Application queue page (filterable, sortable DataTable)
2. Name masking by default (NM-01): reference, school, status, submission date visible; names hidden
3. "Show Names" toggle with audit logging (NAME_REVEAL)
4. Application detail page with tabbed view
5. Tab 1 (Applicant Data): read-only view of all submitted form sections
6. Inline document viewer (PDF/images)
7. Document verification checklist (green tick per slot)

**Key files to create:**
```
src/app/(admin)/queue/page.tsx                    # Application queue
src/components/admin/application-table.tsx         # DataTable with name masking
src/app/api/applications/route.ts                 # GET: list applications (no names by default)
src/app/api/applications/names/route.ts           # GET: reveal names (audit-logged)
src/app/(admin)/applications/[id]/page.tsx        # Application detail (Tab 1: Applicant Data)
src/app/(admin)/applications/[id]/layout.tsx      # Tabbed layout (Applicant Data | Assessment | Recommendation | History)
src/components/admin/document-viewer.tsx           # PDF/image inline viewer
src/components/admin/document-checklist.tsx         # Verification status per slot
src/app/api/documents/[id]/verify/route.ts        # POST: mark document verified
src/lib/audit/log.ts                              # createAuditLog() helper
src/lib/db/queries/audit.ts                       # Audit log queries
```

**Verification:**
- Queue shows applications from seed data with reference, school, status
- Names hidden by default; toggle reveals them
- Click application → detail view with all submitted data read-only
- Document viewer renders PDFs and images inline
- Mark document as verified → green tick appears
- Audit log entry created for name reveal

---

### WP-10: Admin — Assessment Form (Split-Screen)

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Large |
| **Dependencies** | WP-08, WP-09 |

**Deliverables:**
1. Split-screen layout: left panel = document viewer, right panel = data entry form
2. Resizable split (drag handle)
3. Document selector (dropdown to switch between uploaded documents)
4. Assessment data entry form with anonymised labels ("Parent 1", "Parent 2")
5. Family type category selector → auto-populates notional rent, utility, food costs
6. School selection → auto-populates annual fees
7. Entry year → auto-populates schooling years remaining
8. Income entry per earner (employment status drives which fields appear)
9. Benefit fields: separate sections for included vs. excluded benefits
10. Property adjustments (mortgage-free, additional properties)
11. Savings fields (cash, ISAs, school-age children count)
12. Live client-side calculation (runs on every field change, displays all 4 stage outputs)
13. Payable fees display (yearly + monthly) with scholarship %, VAT, manual adjustment
14. Save assessment server action (validates, calculates server-side, stores to Assessment + related tables)
15. Assessment status management (Not Started → Paused → Completed)

**Key files to create:**
```
src/app/(admin)/applications/[id]/assess/page.tsx  # Split-screen assessment
src/components/admin/split-screen.tsx               # Resizable split layout
src/components/admin/assessment-form.tsx             # Data entry form (right panel)
src/components/admin/calculation-display.tsx         # Live calculation results
src/components/admin/earner-form.tsx                 # Per-earner income entry
src/app/(admin)/applications/[id]/assess/actions.ts  # saveAssessment(), completeAssessment()
src/lib/db/queries/assessments.ts                   # Assessment CRUD
src/lib/db/queries/reference-tables.ts              # Lookup family type, school fees, council tax
```

**Verification:**
- Open Okafor family assessment → split-screen with documents on left, form on right
- Select family type category 3 → notional rent auto-fills to £18,000
- Enter Parent 1 income → live calculation updates all stages
- Stage 4 shows required bursary amount
- Payable fees display shows yearly and monthly amounts
- Save → data persisted in Assessment, AssessmentEarner, AssessmentProperty tables
- Re-open → all saved values restored

---

### WP-11: Admin — Round Management & Invitations

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Medium |
| **Dependencies** | WP-03, WP-05 |

**Deliverables:**
1. Round management page: create, edit, close rounds
2. Round detail view: academic year, dates, status, application counts
3. Single invitation form (email, name, child name, school, round)
4. Batch re-assessment invitation (select all active bursary holders)
5. Invitation sends email via Resend with registration link
6. Supabase Auth `inviteUserByEmail()` integration
7. Invitation tracking (status: Pending / Accepted / Expired)

**Key files to create:**
```
src/app/(admin)/rounds/page.tsx             # Round list
src/app/(admin)/rounds/[id]/page.tsx        # Round detail
src/app/(admin)/rounds/actions.ts           # createRound, updateRound, closeRound
src/app/(admin)/invitations/page.tsx        # Invitation management
src/app/(admin)/invitations/actions.ts      # createInvitation, batchInvite
src/lib/db/queries/rounds.ts
src/lib/db/queries/invitations.ts
```

**Verification:**
- Create a round with 2026/27 academic year, open/close dates → appears in list
- Send invitation to test email → email received with registration link
- Click registration link → registration page with email pre-filled
- Register → account created, application appears in portal
- Invitation status updated to ACCEPTED

---

### WP-12: Admin — Recommendation & Reason Codes

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Medium |
| **Dependencies** | WP-10 |

**Deliverables:**
1. Recommendation form (Tab 3 in application detail)
2. Family synopsis fields (auto-suggested from assessment data)
3. Accommodation status, income category, property category (1-12) dropdown
4. Bursary award and payable fees (auto-populated from calculation)
5. Red flag checkboxes (dishonesty, credit risk)
6. Year-on-year reason code multi-select (all 35 codes from seed data)
7. Free-text summary field
8. Set application outcome (Qualifies / Does Not Qualify)
9. Send outcome notification email
10. Property exceeds threshold advisory flag (> £750K)

**Key files to create:**
```
src/app/(admin)/applications/[id]/recommend/page.tsx  # Recommendation form
src/components/admin/recommendation-form.tsx
src/components/admin/reason-code-selector.tsx          # Multi-select checkboxes
src/app/(admin)/applications/[id]/recommend/actions.ts # saveRecommendation()
src/lib/db/queries/recommendations.ts
src/lib/db/queries/reason-codes.ts
```

**Verification:**
- Open recommendation for assessed Okafor family
- Bursary award and payable fees auto-populated from assessment
- Select reason codes → stored in junction table
- Toggle dishonesty flag → prominently displayed
- Set outcome to "Qualifies" → application status updates, outcome email sent
- Re-open → all saved data restored

---

### WP-13: Sibling Linking

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Medium |
| **Dependencies** | WP-10 |

**Deliverables:**
1. "Link Sibling" button in application detail
2. Search for related applications (by reference, child name, or applicant email)
3. Create sibling link (family_group_id, priority_order)
4. Display linked siblings with their payable fees and status
5. Sequential income absorption: Child 1's payable fees auto-deducted from Child 2's HNDI
6. Assessment form picks up sibling payable fees and feeds into calculation
7. Re-ordering sibling priority

**Key files to create:**
```
src/components/admin/sibling-linker.tsx        # Search + link UI
src/components/admin/sibling-list.tsx           # Display linked siblings
src/app/api/siblings/route.ts                  # POST: create link, GET: list siblings
src/app/api/siblings/[id]/route.ts             # DELETE: unlink, PATCH: reorder
src/lib/db/queries/siblings.ts
```

**Verification:**
- Open Williams Child 2 → link to Williams Child 1
- Child 1's payable fees appear as deduction in Child 2's assessment
- Child 2 qualifies for near-full bursary (income absorbed by Child 1)
- Sibling list shows both children with priority order

---

### WP-14: Re-assessment Flow

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Medium |
| **Dependencies** | WP-06, WP-11 |

**Deliverables:**
1. Re-assessment invitation (resets application to PRE_SUBMISSION)
2. Application pre-population (address, child details, family names from previous year)
3. ID section hidden/disabled for re-assessments
4. Financial sections blank (must be completed fresh)
5. Year-on-year comparison view in assessment form (previous year's figures alongside current)
6. Schooling years remaining auto-decremented
7. Benchmark display (first year's payable fees as floor)

**Key files to create:**
```
src/lib/db/queries/reassessment.ts             # Pre-population, previous year lookup
src/components/admin/year-comparison.tsx         # Side-by-side previous vs current
src/components/admin/benchmark-display.tsx       # Original payable fees benchmark
```

**Verification:**
- Trigger re-assessment for Patel family → application resets to PRE_SUBMISSION
- Patel logs in → address and child details pre-populated
- ID section hidden
- Financial sections are blank
- Assessor opens assessment → previous year figures displayed alongside
- Benchmark from first year shown

---

### WP-15: Admin — Status Management & Missing Documents Workflow

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Small |
| **Dependencies** | WP-09, WP-05 |

**Deliverables:**
1. Full status lifecycle implementation (PRE_SUBMISSION → SUBMITTED → NOT_STARTED → PAUSED → COMPLETED → QUALIFIES / DOES_NOT_QUALIFY)
2. Status change actions with logging
3. "Pause" action: set to PAUSED, send missing documents email
4. "Resume" action: set back to NOT_STARTED
5. Assessor can attach documents on behalf of applicant
6. Status badge component (color-coded)
7. Application queue filter by status

**Key files to create:**
```
src/app/(admin)/applications/[id]/actions.ts      # Status change actions
src/components/admin/status-badge.tsx
src/components/admin/missing-docs-dialog.tsx        # Select missing docs + send email
src/components/admin/admin-upload.tsx               # Assessor uploads on behalf of applicant
```

**Verification:**
- Change status from NOT_STARTED to PAUSED → missing docs email sent
- Attach document as assessor → document appears in application
- Resume → status back to NOT_STARTED
- Complete assessment → status to COMPLETED
- Set outcome → status to QUALIFIES or DOES_NOT_QUALIFY
- All status changes logged in audit trail

---

### WP-16: Assessment Checklist Tabs (Qualitative Notes)

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Small |
| **Dependencies** | WP-10 |

**Deliverables:**
1. Six qualitative checklist tabs in assessment detail
2. Each tab has a notes/context textarea (not calculation-affecting)
3. Auto-save on tab change
4. Tabs: Bursary Assessment Details, Living Conditions / Other JWF Children, Debt Situation, Other Fees with the Foundation, Staff Situation, Financial Profile Impact

**Key files to create:**
```
src/components/admin/assessment-checklist.tsx    # Tab interface with 6 tabs
src/app/(admin)/applications/[id]/assess/checklist-actions.ts  # Save checklist notes
```

**Verification:**
- Open assessment → 6 tabs visible alongside the financial form
- Enter notes in each tab → saved to AssessmentChecklist table
- Re-open → notes restored

---

## Phase 3: Output, Reporting & Polish

### WP-17: Exports (XLSX & CSV)

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Medium |
| **Dependencies** | WP-12 |

**Deliverables:**
1. Recommendation export as XLSX (one row per application for a round/school)
2. Field-level data export (filtered CSV/XLSX of application/assessment data)
3. Export columns: Reference, Child Name, School, Family Synopsis, Accommodation, Income Category, Property Category, Bursary Award, Yearly Payable Fees, Monthly Payable Fees, Reason Codes, Red Flags
4. Export button on queue page and recommendation page

**Key files to create:**
```
src/lib/export/xlsx.ts                         # ExcelJS helpers (worksheet creation, formatting)
src/app/api/exports/recommendations/route.ts   # GET: XLSX recommendation export
src/app/api/exports/applications/route.ts      # GET: CSV/XLSX field-level export
src/components/admin/export-button.tsx
```

**Verification:**
- Click "Export Recommendations" for 2026/27 round → XLSX downloads
- XLSX contains correct columns, data from completed assessments
- Currency columns formatted, headers bold
- Field-level export with filters → CSV/XLSX with filtered data

---

### WP-18: Reports & Dashboard

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Medium |
| **Dependencies** | WP-10, WP-12 |

**Deliverables:**
1. Admin dashboard with round summary tiles (counts by status)
2. Round summary report (table + bar/pie charts)
3. Bursary awards report (totals, averages per school)
4. Income distribution report (histogram by income bands)
5. Property category distribution (bar chart by category 1-12)
6. Reason code frequency report (ranked list)
7. Active bursaries approaching final year
8. Sibling bursary summary
9. Chart export as PNG
10. Report data export as CSV/XLSX

**Key files to create:**
```
src/app/(admin)/page.tsx                       # Dashboard with summary tiles
src/app/(admin)/reports/page.tsx               # Report list
src/app/(admin)/reports/[type]/page.tsx        # Individual report view
src/components/admin/dashboard-tiles.tsx
src/components/admin/charts/                   # Chart components (Recharts)
  bar-chart.tsx
  pie-chart.tsx
  histogram.tsx
src/lib/db/queries/reports.ts                  # Report data aggregation queries
src/app/api/exports/report/route.ts            # Export report data
```

**Verification:**
- Dashboard shows correct counts for seed data round
- Each of 7 reports renders with data from seed scenarios
- Charts render correctly
- Export buttons produce CSV/XLSX with matching data

---

### WP-19: Admin Settings (Reference Tables & Email Templates)

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Medium |
| **Dependencies** | WP-03, WP-04 |

**Deliverables:**
1. Settings page with tabbed interface
2. Tabs: Family Type Configs, School Fees, Council Tax Default, Property Classifications, Reason Codes, Email Templates
3. Each tab: editable table of current values with "Save" button
4. Email template editor with merge field preview
5. Reason code management (add, deprecate, edit labels)
6. Changes take effect for current and future rounds; historical values preserved

**Key files to create:**
```
src/app/(admin)/settings/page.tsx              # Settings tabs
src/app/(admin)/settings/family-types/page.tsx
src/app/(admin)/settings/school-fees/page.tsx
src/app/(admin)/settings/council-tax/page.tsx
src/app/(admin)/settings/reason-codes/page.tsx
src/app/(admin)/settings/email-templates/page.tsx
src/app/(admin)/settings/actions.ts            # Save settings server actions
src/components/admin/settings/editable-table.tsx
src/components/admin/settings/email-template-editor.tsx
```

**Verification:**
- Update notional rent for Category 3 → new value shows
- Update school fees → assessment auto-populates new fee
- Edit email template → preview shows merged content
- Add new reason code → appears in recommendation form
- Deprecate reason code → hidden from new assessments, visible on historical records

---

### WP-20: Audit Trail

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Small |
| **Dependencies** | WP-09 |

**Deliverables:**
1. Audit log entries throughout all create/update/delete operations
2. Per-application history tab (Tab 4: History)
3. Global audit log view in admin
4. Log entries: timestamp, user, action, entity, old/new values
5. Immutable — no update or delete on audit log table

**Key files to create:**
```
src/app/(admin)/applications/[id]/history/page.tsx  # Per-application audit trail
src/components/admin/audit-timeline.tsx
src/lib/audit/log.ts                                # Enhanced createAuditLog() with metadata
```

**Verification:**
- Save an assessment → audit entry with action `ASSESSMENT_SAVED`
- Change status → audit entry with old/new status
- Name reveal → audit entry with `NAME_REVEAL`
- History tab shows chronological audit trail for application
- Audit entries cannot be modified or deleted

---

### WP-21: PDF Generation

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Small |
| **Dependencies** | WP-12 |

**Deliverables:**
1. Recommendation PDF (structured summary for archival)
2. Application summary PDF (all submitted data)
3. Download button on recommendation and application detail pages

**Key files to create:**
```
src/lib/export/pdf.ts                          # @react-pdf/renderer templates
src/lib/export/pdf-templates/
  recommendation.tsx                           # Recommendation PDF layout
  application-summary.tsx                      # Application summary PDF layout
src/app/api/exports/pdf/route.ts               # GET: generate and stream PDF
```

**Verification:**
- Click "Download PDF" on Okafor recommendation → PDF downloads
- PDF contains: family synopsis, categories, bursary award, payable fees, reason codes
- Application summary PDF contains all submitted form data

---

### WP-22: UI Polish & GDPR Compliance

| Field | Value |
|-------|-------|
| **Status** | `Complete` |
| **Complexity** | Medium |
| **Dependencies** | WP-06, WP-09, WP-10 |

**Deliverables:**
1. Mobile responsiveness testing and fixes (portal at 375px must be fully functional)
2. Loading states for all async operations (skeleton loaders, spinners)
3. Error handling for all forms and API calls (toast notifications)
4. Empty states for all list views
5. GDPR: data deletion action (assessor can delete all data for an applicant)
6. GDPR: retention expiry flag on closed bursary accounts (7-year)
7. GDPR: rejected application purge flag (4-week appeal window)
8. Internal bursary request flow (ad-hoc application creation outside standard round)

**Key files to create:**
```
src/components/shared/skeleton-loaders.tsx
src/components/admin/data-deletion-dialog.tsx     # GDPR deletion with confirmation
src/app/(admin)/applications/[id]/delete/actions.ts  # Permanent deletion
src/components/admin/internal-bursary-dialog.tsx   # Ad-hoc application creation
```

**Verification:**
- Portal usable on mobile (375px viewport)
- All forms show loading states during save
- Error toast shown on failed operations
- Delete applicant data → all personal data, documents, assessments removed
- Audit log entry for deletion exists (no personal data in log)
- Create internal bursary request → application created outside standard round

---

## Phase 4: Demo Deployment

### WP-23: Deployment & Demo Preparation

| Field | Value |
|-------|-------|
| **Status** | `Not Started` |
| **Complexity** | Small |
| **Dependencies** | All previous WPs |
| **Credentials** | `[CREDENTIALS REQUIRED]` — Vercel project ID, domain |

**Deliverables:**
1. Production-ready build (`next build` succeeds with no errors)
2. Environment variable documentation for Vercel
3. Deploy to Vercel with production environment variables
4. Seed data loaded in demo Supabase project
5. Demo walkthrough script (step-by-step for the Foundation presentation)
6. Verify all features work on the deployed URL

**Demo walkthrough script:**
1. **Assessor creates a round** → "Bursary Assessment 2026/27"
2. **Assessor sends invitation** → email arrives for demo applicant
3. **Applicant registers and fills application** → walk through each section, upload sample documents
4. **Applicant submits** → confirmation email, status changes
5. **Assessor opens queue** → sees submitted application (names masked)
6. **Assessor opens assessment** → split-screen with documents and data entry
7. **Assessor enters figures** → live calculation shows bursary and payable fees
8. **Assessor completes recommendation** → reason codes, synopsis, export
9. **Assessor exports XLSX** → recommendation spreadsheet for school
10. **Dashboard** → round summary with charts
11. **Sibling linking demo** → link Williams children, show fee absorption
12. **Re-assessment demo** → pre-populated form, year-on-year comparison
13. **Settings** → update reference tables, edit email templates

**Verification:**
- Full demo walkthrough completes without errors
- All seed data scenarios work as expected
- XLSX export contains correct data
- Dashboard shows accurate counts

---

## Dependency Graph

```
WP-01 (Schema) ─────┬──► WP-02 (Auth) ──► WP-03 (Layouts) ──┬──► WP-06 (Forms) ──► WP-07 (Upload/Submit)
                     │                                         │                            │
                     ├──► WP-04 (Seed) ──► WP-05 (Email) ─────┤                    WP-14 (Re-assessment)
                     │                                         │
                     └──► WP-08 (Calc Engine) ─────────────────┤
                                                               │
                     WP-09 (Queue/Detail) ◄────────────────────┘
                           │
                     ┌─────┼──────────┬────────────┐
                     ▼     ▼          ▼            ▼
                 WP-10   WP-15    WP-20        WP-22
                (Assess) (Status) (Audit)     (Polish)
                   │
              ┌────┼────┬──────┐
              ▼    ▼    ▼      ▼
          WP-12  WP-13 WP-16  WP-18
         (Rec)  (Sib) (Check) (Reports)
           │
      ┌────┼────┐
      ▼    ▼    ▼
  WP-17  WP-21  WP-19
 (Export) (PDF) (Settings)

All ──► WP-23 (Deploy)
```

---

## Quick Reference: Key Source Documents

| Document | Path | What it contains |
|----------|------|-----------------|
| **TDD** | `docs/TDD.md` | Architecture, data model (17 entities), component specs, calculation engine, API routes, deployment |
| **PRD** | `docs/PRD.md` | 104 functional requirements, user stories, wireframe descriptions, metrics |
| **README** | `README.md` | Domain model, calculation formulas, reference tables, lifecycle, scope |
| **Application Spec** | `docs/planning/APPLICATION.md` | Field-by-field applicant form spec (10 sections, conditional logic, upload slots) |
| **Admin Spec** | `docs/planning/ADMIN.md` | Current Grant Tracker admin console structure (for replacement reference) |
| **Open Questions** | `docs/planning/OPEN_QUESTIONS.md` | 30 Q&As with Foundation assessor clarifying business logic |
| **Assessment Spreadsheet** | `docs/planning/Assessment Model Notional Calculations - BW.xlsx` | Source spreadsheet for calculation model and reference values |
