## 8. Implementation Strategy

### 8.1 Development Phases

The project is structured in four phases, building from foundation to feature-complete. Each phase produces deployable, testable output. Timelines are expressed in weeks from project start (Week 0) so they can be anchored to any actual start date.

**Development approach:** The bulk of implementation work will be performed using AI-assisted development tools (code generation, pair programming, test generation). This significantly compresses the timeline compared to traditional engineering effort — particularly for boilerplate-heavy work (form rendering, CRUD operations, data tables, API routes) and for generating test suites. The estimates below reflect this AI-assisted pace. Human effort focuses on architecture decisions, business logic validation, UX refinement, and stakeholder coordination.

#### Phase 1: Foundation (Weeks 1–2)

**Goal:** Project scaffolding, data model, authentication, and core layouts deployed to staging.

| Deliverable | Detail |
|-------------|--------|
| Project setup | Next.js app, Tailwind, shadcn/ui, Prisma, Supabase project (London region), Vercel project, GitHub repo |
| Prisma schema | All entities from Section 6 defined. Initial migration run against Supabase. |
| Supabase Auth | Configuration: email/password provider, custom claims for roles, MFA enabled for assessor role. |
| Edge middleware | Auth check + role-based route protection (`(portal)`, `(admin)`, `(auth)` route groups). |
| Auth pages | Login, registration (invitation-based), password reset, MFA verification. |
| Layout shells | Portal layout (progress sidebar, mobile stepper) and Admin layout (sidebar nav, header). |
| Seed data | Reference tables seeded (family type configs, school fees, council tax, reason codes). Test users for each role. |
| CI/CD | GitHub Actions pipeline with lint, type-check, test, deploy to Vercel preview/staging. |

**Exit criteria:** A user can log in as applicant or assessor and see the correct layout shell. Prisma schema is deployed and seeded.

#### Phase 2: Core Application (Weeks 3–6)

**Goal:** The full end-to-end assessment workflow works: applicant submits, assessor reviews, assesses, and produces a recommendation.

| Deliverable | Detail |
|-------------|--------|
| **Applicant portal — form engine** | Section schemas for all 10 form sections. `SectionForm` component renders fields from schema, handles conditional logic. Save/resume per section (JSONB). Progress tracking. |
| **Applicant portal — document upload** | `FileUpload` component. `/api/documents` endpoint. Supabase Storage bucket configured (encrypted, private). |
| **Applicant portal — validation & submit** | Validation summary page. Declaration section. Submit action (locks application, sets status). |
| **Admin — application queue** | Filterable, sortable table with name masking (NM-01). Pagination. |
| **Admin — application detail** | Tab 1 (Applicant Data): read-only section display + inline document viewer. |
| **Assessment engine** | All pure functions implemented (`calculator.ts`, stage 1–4, `payable-fees.ts`). Validated against spreadsheet test cases. |
| **Admin — assessment form** | Split-screen layout (document viewer + data entry). Live client-side calculation. Save server action. |
| **Admin — round management** | Create/edit/close rounds. |
| **Invitation management** | Invitation form (single + batch for re-assessments). Supabase Auth `inviteUserByEmail()` integration. |
| **Email service** | Resend integration. All 7 email templates (configurable in admin). Send from assessment workflow (missing docs, outcome). |
| **Status management** | Full status lifecycle (PRE_SUBMISSION → SUBMITTED → NOT_STARTED → PAUSED → COMPLETED → QUALIFIES / DNQ). Status change logging. |
| **Document verification** | Assessor can mark each document slot as verified. Completeness summary. |
| **Recommendation form** | Structured recommendation (Tab 3). Family synopsis, categories, reason codes (multi-select), red flags. |
| **Sibling linking** | Search + link interface. Sequential income absorption. Payable fees deduction for child 2+. |
| **Re-assessment flow** | Pre-population from previous year. ID section hidden. Year-on-year comparison (side-by-side). |

**Exit criteria:** Full assessment lifecycle works for new applications, re-assessments, and sibling applications. Emails are sent at all workflow touchpoints. An end-to-end test passes: create round → invite applicant → applicant registers, fills form, uploads documents, submits → assessor sees application in queue → opens split-screen, enters figures, sees live calculation → saves assessment → completes recommendation → exports.

#### Phase 3: Output, Reporting & Polish (Weeks 7–9)

**Goal:** Exports, reports, audit trail, and UI refinement.

| Deliverable | Detail |
|-------------|--------|
| **Recommendation export** | XLSX export for schools (ExcelJS). Per-round, per-school. |
| **Field-level data export** | Generic CSV/XLSX export for filtered application/assessment data. |
| **Canned reports** | All 7 reports from Section 7.6.1 with charts (Recharts) and export buttons. |
| **Ad-hoc report builder** | Filter/group/visualise interface. |
| **PDF generation** | Recommendation PDF and application summary PDF (@react-pdf/renderer). Should Have — deprioritise if behind schedule. |
| **Audit trail** | Audit log writes throughout the codebase. Per-application history tab. Global audit view. |
| **Dashboard** | Admin dashboard with round summary tiles. |
| **Email template editor** | Admin UI for editing email template subject/body. Merge field preview. |
| **Reference table editor** | Full settings UI for all reference tables. |
| **Applicant status view** | Portal status page (Draft / Submitted / Under Review / Outcome Available). |
| **UI polish** | Mobile responsiveness testing, accessibility pass (WCAG 2.1 AA), loading states, error handling, empty states. |

**Exit criteria:** All Must Have PRD requirements are implemented. All Should Have reporting features are implemented. The system is feature-complete for launch.

#### Phase 4: Migration, UAT & Launch (Weeks 10–12+)

**Goal:** Data migration from Grant Tracker, user acceptance testing, and production launch.

| Deliverable | Detail |
|-------------|--------|
| **Grant Tracker investigation** | Determine export capabilities (API, CSV, database). Note: this task should be started in Phase 1 and run in parallel — it has no code dependency and is the highest-risk item. |
| **Migration scripts** | TypeScript ETL scripts: extract from Grant Tracker, transform to new schema, load via Prisma. |
| **Document migration** | Download all documents from Grant Tracker, re-upload to Supabase Storage. |
| **Migration verification** | Spot-check 20% of accounts. Compare payable fees and bursary awards against Grant Tracker. |
| **UAT with assessor** | End-to-end testing of all workflows with the Foundation's assessor using real (anonymised) test data. |
| **Calculation verification** | Side-by-side comparison of 10+ historical cases between the new engine and the existing spreadsheet model. |
| **Bug fixes** | Address issues found during UAT. |
| **Production deployment** | DNS, SSL, production Supabase + Vercel configuration, monitoring setup. |
| **Go-live** | Switch over from Grant Tracker. Assessor begins using the new system. |

**Exit criteria:** All launch criteria from PRD Section 6.1 are met. The assessor has signed off on UAT.

#### Phase Summary

```
Week  1    2    3    4    5    6    7    8    9    10   11   12+
      │    │    │    │    │    │    │    │    │    │    │    │
      ├─ Phase 1 ─┤                                        │
      │ Foundation │                                        │
      │            ├────────── Phase 2 ──────────┤          │
      │            │ Core Application             │          │
      │            │                              ├─ Phase 3┤
      │            │                              │ Output  │
      │            │                              │ Reports │
      │            │                              │ Polish  ├─ Phase 4 ──►
      │            │                              │         │ Migration  │
      │            │                              │         │ UAT        │
      │            │                              │         │ Launch     │
      │                                                                  │
      ├── Grant Tracker investigation (parallel) ────────────────────────┤
      │                                                                  │
      │                                    Feature-complete ──► Week 9   │
      │                                    System live ──────► Week 12+  │
```

**Total estimated timeline:** ~12 weeks to system live. Grant Tracker investigation runs in parallel from Week 1 as it has no code dependency and is the highest-risk item. Feature-complete by Week 9 allows 3+ weeks for migration, UAT, and buffer.

### 8.2 Testing Strategy

#### 8.2.1 Testing Pyramid

| Layer | Tool | Scope | Coverage Target |
|-------|------|-------|----------------|
| **Unit tests** | Vitest | Assessment engine (pure functions), utility functions, form validation schemas | 100% of calculation logic; high coverage of business rules |
| **Integration tests** | Vitest + Prisma (test DB) | Server actions, API routes, database queries, email sending (mocked) | All CRUD operations, status transitions, role-based access |
| **Component tests** | Vitest + Testing Library | UI components in isolation — form rendering, conditional logic, data display | Key interactive components (SectionForm, AssessmentForm, DataTable) |
| **End-to-end tests** | Playwright | Full user workflows through the browser | Critical paths (see below) |
| **Accessibility tests** | axe-core + Playwright | WCAG 2.1 AA compliance | All portal pages, key admin pages |

#### 8.2.2 Assessment Engine Test Cases

The assessment engine is the highest-risk component. It must produce **identical results** to the existing spreadsheet model.

| Test Category | Approach |
|---------------|----------|
| **Known historical cases** | The Foundation assessor provides 10+ anonymised historical assessments with known correct outcomes. Each becomes a unit test: input values → expected output values to the penny. |
| **Boundary cases** | Zero income (full bursary), very high income (no bursary), single parent, two parents, each employment status, mortgage-free, additional properties, large savings, zero savings. |
| **Sibling deductions** | Two siblings, three siblings, cross-school siblings, sibling succession (child 1 leaves). |
| **Payable fees formula** | Scholarship + bursary + VAT combinations. 0% scholarship. 100% scholarship. Manual adjustment positive and negative. |
| **Reference value overrides** | Override notional rent, override years remaining, override council tax. Verify the override propagates correctly through all stages. |

Every stage function is tested independently (`calculateHouseholdIncome`, `calculateNetAssets`, etc.) and the orchestrator `calculateAssessment` is tested end-to-end.

#### 8.2.3 Critical E2E Paths

| # | Path | Steps |
|---|------|-------|
| 1 | **New application** | Assessor creates invitation → applicant registers → fills all sections → uploads documents → submits → assessor opens queue → opens assessment → enters figures → saves → completes → exports recommendation |
| 2 | **Re-assessment** | Assessor opens new round → triggers re-assessment invitations → applicant logs in → sees pre-populated data → completes financial sections → submits → assessor assesses with year-on-year comparison → selects reason codes |
| 3 | **Sibling application** | Assessor links two applications → verifies Child 1's payable fees appear as deduction in Child 2's calculation |
| 4 | **Missing documents** | Assessor pauses application → sends missing docs email → assessor attaches doc on behalf of applicant → resumes assessment |
| 5 | **Data deletion** | Assessor processes deletion → all personal data, documents, and assessments removed → audit log entry exists → applicant can no longer log in |

#### 8.2.4 Continuous Integration

Tests run on every pull request via GitHub Actions:

```
PR opened / updated
    │
    ├── Lint (ESLint) ──────────────────┐
    ├── Type check (tsc --noEmit) ──────┤
    ├── Unit tests (Vitest) ────────────┤──► All must pass to merge
    ├── Integration tests (Vitest) ─────┤
    └── Build (next build) ─────────────┘

Merge to main
    │
    ├── All above ──────────────────────┐
    ├── E2E tests (Playwright) ─────────┤──► Deploy to staging
    └── Accessibility audit (axe) ──────┘

Manual trigger (pre-release)
    │
    └── Full E2E suite against staging ──► Deploy to production
```

### 8.3 Data Migration Plan

This section expands on the migration strategy outlined in Section 6.4 with operational detail.

#### 8.3.1 Investigation (Parallel from Week 1)

| Task | Detail |
|------|--------|
| Assess Grant Tracker API | Test REST API v7.0 endpoints for reading applications, assessments, documents. Document available endpoints, pagination, rate limits. |
| Assess export options | Check for CSV/XLSX bulk export, database backup download, or admin data dump feature. |
| Map source to target | Create a field-by-field mapping from Grant Tracker's data model to the new Prisma schema. Identify gaps and transformation rules. |
| Document inventory | Count total documents per application. Determine download mechanism (API, bulk download, manual). |

If the Grant Tracker API is insufficient, escalate to Digital Science for a database export or work with the Foundation to extract data manually (this is the risk mitigation for the highest-risk dependency).

#### 8.3.2 ETL Implementation (Phase 4, Weeks 10–11)

Migration scripts live in `scripts/migration/`:

```
scripts/migration/
├── extract/
│   ├── grant-tracker-api.ts    # API client for Grant Tracker
│   └── grant-tracker-csv.ts    # CSV parser (fallback if API is limited)
├── transform/
│   ├── accounts.ts             # Map GT accounts → BursaryAccount
│   ├── applications.ts         # Map GT applications → Application + sections
│   ├── assessments.ts          # Map GT assessments → Assessment + earners
│   ├── documents.ts            # Map GT document metadata → Document
│   └── siblings.ts             # Map GT sibling links → SiblingLink
├── load/
│   ├── database.ts             # Prisma bulk inserts
│   └── storage.ts              # Upload documents to Supabase Storage
├── verify/
│   ├── spot-check.ts           # Compare random 20% of accounts against source
│   └── calculation-check.ts    # Re-run calculation on migrated data, compare results
└── run-migration.ts            # Orchestrator: extract → transform → load → verify
```

#### 8.3.3 Execution (Phase 4, Weeks 11–12)

| Step | Detail |
|------|--------|
| 1. Dry run | Run full migration against staging environment. Log all warnings and errors. |
| 2. Verification | Run `spot-check.ts` (random 20% of accounts). Run `calculation-check.ts` (all migrated assessments). Flag mismatches. |
| 3. Fix and re-run | Address data quality issues found in dry run. Re-run migration. |
| 4. Production migration | Run against production environment during a maintenance window. |
| 5. Final verification | Assessor manually verifies 10 accounts in the production system against Grant Tracker. |

#### 8.3.4 Rollback

If critical issues are found post-migration:
- The Supabase database can be restored from a point-in-time backup taken immediately before the migration
- Documents in Supabase Storage are not affected by database rollback (they must be cleaned up separately if needed)
- Grant Tracker remains available as the fallback system until 31 Dec 2026

---
