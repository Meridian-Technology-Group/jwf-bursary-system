## 6. Data Design

### 6.1 Design Principles

**Two-layer enforcement at the database level (DG-2):** Applicant-entered data and assessor-entered data live in separate tables. The assessment engine's input type references only assessor-layer tables. There is no view, join, or query path that feeds applicant-declared financial figures into the calculation.

**Hybrid storage for applicant data:** The application form has ~100 fields across 10 sections with complex conditional logic. Core identifiable fields (child name, parent names, school, address) are stored as structured columns for search, pre-population, and name masking. Section-level detail (income table rows, asset breakdowns, circumstances checklist) is stored as JSONB — flexible, evolvable, and only read for display purposes.

**Assessment data is fully normalised:** Every field the calculation reads is a typed column. No JSON parsing in the calculation path.

**Reference table snapshots:** When an assessment is created, current reference values (notional rent, food, utilities, fees, council tax) are copied onto the assessment record. The assessor can override them. The reference configuration tables provide defaults for new assessments — they are not joined at calculation time. This means historical assessments are self-contained: changing a reference table value does not retroactively alter past calculations.

### 6.2 Entity-Relationship Diagram

```
                            ┌──────────────┐
                            │    Round     │
                            │──────────────│
                            │ id           │
                            │ academic_year│
                            │ open_date    │
                            │ close_date   │
                            │ status       │
                            └──────┬───────┘
                                   │ 1
                                   │
                                   │ *
┌──────────────┐           ┌───────┴───────┐           ┌──────────────────┐
│   Profile    │ 1      *  │  Application  │ *      1  │  BursaryAccount  │
│──────────────│──────────►│───────────────│◄──────────│──────────────────│
│ id (=auth)   │           │ id            │           │ id               │
│ role         │           │ reference     │           │ reference        │
│ first_name   │           │ round_id    ──┘           │ school           │
│ last_name    │           │ bursary_      │           │ child_name       │
│ email        │           │  account_id ──────────────┘ entry_year       │
│ phone        │           │ lead_         │           │ benchmark_fees   │
│              │           │  applicant_id │           │ lead_applicant_id│
│              │           │ school        │           │ status           │
│              │           │ status        │           └─────────┬────────┘
│              │           │ child_name    │                     │
│              │           │ submitted_at  │                     │ *
│              │           └───┬───┬───┬───┘           ┌────────┴────────┐
│              │               │   │   │               │  SiblingLink    │
└──────────────┘               │   │   │               │─────────────────│
                               │   │   │               │ family_group_id │
           ┌───────────────────┘   │   └──────────┐    │ bursary_acct_id │
           │                       │              │    │ priority_order  │
           │ *                     │ *            │ *  └─────────────────┘
  ┌────────┴──────────┐   ┌───────┴────────┐ ┌───┴──────────┐
  │ ApplicationSection│   │   Document     │ │  Assessment  │
  │───────────────────│   │────────────────│ │──────────────│
  │ id                │   │ id             │ │ id           │──────────────┐
  │ application_id    │   │ application_id │ │ application_ │              │
  │ section           │   │ slot           │ │  id          │              │
  │ data (JSONB)      │   │ filename       │ │ assessor_id  │              │
  │ is_complete       │   │ storage_path   │ │ family_type  │              │
  └───────────────────┘   │ verified       │ │ [income,     │              │
                          └────────────────┘ │  assets,     │              │
          ┌──────────────────────┐            │  calc fields]│              │
          │  APPLICANT LAYER     │            │ status       │              │
          │  (document           │            │ outcome      │              │
          │   collection)        │            └──┬───┬───┬───┘              │
          └──────────────────────┘               │   │   │                  │
                                                 │   │   │                  │
          ┌──────────────────────┐    ┌──────────┘   │   └──────────┐      │
          │  ASSESSOR LAYER      │    │ *            │ *            │ *    │
          │  (calculation        │ ┌──┴───────────┐ ┌┴────────────┐┌┴─────┴──────┐
          │   input)             │ │ Assessment   │ │ Assessment  ││Recommendation│
          └──────────────────────┘ │ Earner       │ │ Checklist   ││──────────────│
                                   │──────────────│ │─────────────││ id           │
                                   │ id           │ │ id          ││ assessment_id│
                                   │ assessment_id│ │ assessment_ ││ family_      │
                                   │ earner_label │ │  id         ││  synopsis    │
                                   │ employment_  │ │ tab         ││ bursary_award│
                                   │  status      │ │ notes       ││ payable_fees │
                                   │ net_pay      │ └─────────────┘│ reason_codes │
                                   │ benefits_    │                │ red_flags    │
                                   │  included    │                └──────────────┘
                                   │ total_income │
                                   └──────────────┘

  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │ REFERENCE CONFIG │  │ SYSTEM           │  │ AUDIT            │
  │──────────────────│  │──────────────────│  │──────────────────│
  │ FamilyTypeConfig │  │ Invitation       │  │ AuditLog         │
  │ SchoolFees       │  │ EmailTemplate    │  │ (immutable)      │
  │ CouncilTaxDefault│  │                  │  │                  │
  │ ReasonCode       │  │                  │  │                  │
  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

### 6.3 Key Entities

#### 6.3.1 Profile

Extends Supabase Auth's `auth.users` table with application-specific fields. The `id` is the same UUID as the Supabase Auth user.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, = auth.users.id | Supabase Auth manages the account; this table adds profile data |
| `role` | ENUM | NOT NULL | `applicant`, `assessor`, `viewer` |
| `first_name` | TEXT | | Masked in assessment contexts (NM-01–NM-05) |
| `last_name` | TEXT | | Masked in assessment contexts |
| `email` | TEXT | NOT NULL, UNIQUE | From auth.users, denormalised for query convenience |
| `phone` | TEXT | | |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

**RLS policies:**
- Applicants: can read/update their own profile only
- Assessors: can read all profiles
- Viewers: can read all profiles

#### 6.3.2 Round

An assessment cycle for one academic year.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `academic_year` | TEXT | NOT NULL, UNIQUE | e.g., "2026/27" |
| `open_date` | DATE | NOT NULL | Applications accepted from this date |
| `close_date` | DATE | NOT NULL | Application deadline |
| `decision_date` | DATE | | Target date for funding decisions |
| `status` | ENUM | NOT NULL, DEFAULT 'DRAFT' | `DRAFT`, `OPEN`, `CLOSED` |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

#### 6.3.3 BursaryAccount

A persistent account per child, spanning multiple assessment years. Created when a child first qualifies for a bursary.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `reference` | TEXT | NOT NULL, UNIQUE | Format: `WS-xxx` or `TS-xxx`. Persists across years. |
| `school` | ENUM | NOT NULL | `TRINITY`, `WHITGIFT` |
| `child_name` | TEXT | NOT NULL | Display purposes and pre-population |
| `child_dob` | DATE | | |
| `entry_year` | INT | NOT NULL | Original year group at entry (6, 7, 9, 12, or other) |
| `first_assessment_year` | TEXT | NOT NULL | Academic year of first assessment, e.g., "2026/27" |
| `benchmark_payable_fees` | DECIMAL(10,2) | | Payable fees from first year's assessment (floor) |
| `lead_applicant_id` | UUID | FK → Profile | |
| `status` | ENUM | NOT NULL, DEFAULT 'ACTIVE' | `ACTIVE`, `CLOSED` |
| `closed_at` | TIMESTAMPTZ | | When the child left school or bursary ended |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

**Index:** `(lead_applicant_id)` — for looking up a family's accounts.

#### 6.3.4 Application

One application per child per round. This is the central entity linking applicant data, documents, and assessments.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `reference` | TEXT | NOT NULL, UNIQUE | Format during assessment: `YY/YY_School_Child_Seq` |
| `round_id` | UUID | FK → Round, NOT NULL | |
| `bursary_account_id` | UUID | FK → BursaryAccount, NULLABLE | NULL for first-time applications until outcome is decided |
| `lead_applicant_id` | UUID | FK → Profile, NOT NULL | |
| `school` | ENUM | NOT NULL | `TRINITY`, `WHITGIFT` |
| `child_name` | TEXT | NOT NULL | Applicant-entered; used for display and queue search |
| `child_dob` | DATE | | |
| `entry_year` | INT | | Year 6/7/9/12/Other |
| `is_reassessment` | BOOLEAN | NOT NULL, DEFAULT false | |
| `is_internal` | BOOLEAN | NOT NULL, DEFAULT false | Internal bursary request (ad-hoc, outside round) |
| `status` | ENUM | NOT NULL, DEFAULT 'PRE_SUBMISSION' | See status enum below |
| `submitted_at` | TIMESTAMPTZ | | NULL until applicant submits |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

**Application status enum:** `PRE_SUBMISSION`, `SUBMITTED`, `NOT_STARTED`, `PAUSED`, `COMPLETED`, `QUALIFIES`, `DOES_NOT_QUALIFY`

**Indexes:** `(round_id, status)`, `(lead_applicant_id)`, `(bursary_account_id)`

**Unique constraint:** `(round_id, lead_applicant_id, child_name)` — one application per child per round.

#### 6.3.5 ApplicationSection

Stores applicant-entered form data per section as JSONB. Each section's data structure is defined by the form specification in APPLICATION.md.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `application_id` | UUID | FK → Application, NOT NULL | |
| `section` | ENUM | NOT NULL | See section enum below |
| `data` | JSONB | NOT NULL, DEFAULT '{}' | Section-specific field values |
| `is_complete` | BOOLEAN | NOT NULL, DEFAULT false | All required fields present and valid |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

**Section enum:** `CHILD_DETAILS`, `FAMILY_ID`, `PARENT_DETAILS`, `DEPENDENT_CHILDREN`, `DEPENDENT_ELDERLY`, `OTHER_INFO`, `PARENTS_INCOME`, `ASSETS_LIABILITIES`, `ADDITIONAL_INFO`, `DECLARATION`

**Unique constraint:** `(application_id, section)` — one row per section per application.

**Why JSONB?** The form has ~100 fields with deep conditional logic. Normalising every field into columns would create a rigid schema that's painful to evolve. The assessor never queries these fields for calculation — they look at the uploaded documents instead. JSONB gives us:
- Flexibility to adjust form fields without migrations
- Simple save/load per section (one row per section)
- Ability to add validation at the application level via JSON Schema
- Pre-population for re-assessments: copy the JSON and let the applicant edit

#### 6.3.6 Document

Metadata for uploaded files. The file itself lives in Supabase Storage.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `application_id` | UUID | FK → Application, NOT NULL | |
| `slot` | TEXT | NOT NULL | Named upload slot, e.g., `BIRTH_CERTIFICATE`, `P60_PARENT_1`, `BANK_STMT_PARENT_1_1` |
| `filename` | TEXT | NOT NULL | Original filename |
| `mime_type` | TEXT | NOT NULL | `application/pdf`, `image/jpeg`, `image/png` |
| `file_size` | INT | NOT NULL | Bytes |
| `storage_path` | TEXT | NOT NULL | Path in Supabase Storage bucket |
| `is_verified` | BOOLEAN | NOT NULL, DEFAULT false | Assessor marks as verified (green tick) |
| `uploaded_by` | UUID | FK → Profile, NOT NULL | Applicant or assessor (for email-received docs) |
| `uploaded_at` | TIMESTAMPTZ | NOT NULL | |

**Storage path convention:** `documents/{application_id}/{slot}/{uuid}_{filename}`

**Index:** `(application_id, slot)` — for listing documents per application and checking slot completeness.

#### 6.3.7 Assessment (Assessor Layer)

The core assessor workspace. Stores all assessor-entered financial data and calculation results. This is the **only** table the calculation engine reads.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `application_id` | UUID | FK → Application, NOT NULL, UNIQUE | One assessment per application |
| `assessor_id` | UUID | FK → Profile, NOT NULL | |
| **Reference value snapshots** | | | |
| `family_type_category` | INT | | 1–6 |
| `notional_rent` | DECIMAL(10,2) | | Snapshotted from config, overridable |
| `utility_costs` | DECIMAL(10,2) | | |
| `food_costs` | DECIMAL(10,2) | | |
| `annual_fees` | DECIMAL(10,2) | | |
| `council_tax` | DECIMAL(10,2) | | Default: Band D Croydon |
| `schooling_years_remaining` | INT | | Auto-calculated from entry year, overridable |
| **Calculation results** | | | |
| `total_household_net_income` | DECIMAL(10,2) | | Stage 1 output |
| `net_assets_yearly_valuation` | DECIMAL(10,2) | | Stage 2 output |
| `hndi_after_ns` | DECIMAL(10,2) | | Stage 3 output |
| `required_bursary` | DECIMAL(10,2) | | Stage 4 output |
| **Payable fees** | | | |
| `gross_fees` | DECIMAL(10,2) | | |
| `scholarship_pct` | DECIMAL(5,2) | DEFAULT 0 | |
| `bursary_award` | DECIMAL(10,2) | | = required_bursary (may differ if adjusted) |
| `net_yearly_fees` | DECIMAL(10,2) | | |
| `vat_rate` | DECIMAL(5,2) | DEFAULT 20.00 | |
| `yearly_payable_fees` | DECIMAL(10,2) | | |
| `monthly_payable_fees` | DECIMAL(10,2) | | |
| **Manual adjustment** | | | |
| `manual_adjustment` | DECIMAL(10,2) | DEFAULT 0 | Positive or negative |
| `manual_adjustment_reason` | TEXT | | Required if adjustment ≠ 0 |
| **Property** | | | |
| `property_category` | INT | | 1–12 |
| `property_exceeds_threshold` | BOOLEAN | DEFAULT false | Advisory flag (> £750K) |
| **Red flags** | | | |
| `dishonesty_flag` | BOOLEAN | DEFAULT false | |
| `credit_risk_flag` | BOOLEAN | DEFAULT false | |
| **Status** | | | |
| `status` | ENUM | NOT NULL, DEFAULT 'NOT_STARTED' | `NOT_STARTED`, `PAUSED`, `COMPLETED` |
| `outcome` | ENUM | | `QUALIFIES`, `DOES_NOT_QUALIFY`. NULL until completed. |
| `completed_at` | TIMESTAMPTZ | | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### 6.3.8 AssessmentEarner

Assessor-entered income breakdown per earner. Typically two rows per assessment (Parent 1, Parent 2), or one for sole parents.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `assessment_id` | UUID | FK → Assessment, NOT NULL | |
| `earner_label` | ENUM | NOT NULL | `PARENT_1`, `PARENT_2` |
| `employment_status` | ENUM | NOT NULL | `PAYE`, `BENEFITS`, `SELF_EMPLOYED_DIRECTOR`, `SELF_EMPLOYED_SOLE`, `OLD_AGE_PENSION`, `PAST_PENSION`, `UNEMPLOYED` |
| `net_pay` | DECIMAL(10,2) | DEFAULT 0 | PAYE net salary |
| `net_dividends` | DECIMAL(10,2) | DEFAULT 0 | Self-employed director |
| `net_self_employed_profit` | DECIMAL(10,2) | DEFAULT 0 | Sole trader / partner |
| `pension_amount` | DECIMAL(10,2) | DEFAULT 0 | Old age or past employment |
| `benefits_included` | DECIMAL(10,2) | DEFAULT 0 | DLA, ESA, PIP, Carer's (parent) |
| `benefits_included_detail` | JSONB | DEFAULT '{}' | Breakdown of included benefits |
| `benefits_excluded` | DECIMAL(10,2) | DEFAULT 0 | Child disability benefits |
| `benefits_excluded_detail` | JSONB | DEFAULT '{}' | Breakdown of excluded benefits |
| `total_income` | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | Sum of applicable fields |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

**Unique constraint:** `(assessment_id, earner_label)` — one row per earner per assessment.

#### 6.3.9 AssessmentProperty

Property and savings data entered by the assessor for Stage 2 calculations.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `assessment_id` | UUID | FK → Assessment, NOT NULL, UNIQUE | One row per assessment |
| `is_mortgage_free` | BOOLEAN | DEFAULT false | If true, notional rent is added back |
| `additional_property_count` | INT | DEFAULT 0 | Properties beyond primary residence |
| `additional_property_income` | DECIMAL(10,2) | DEFAULT 0 | Yearly income from additional properties |
| `cash_savings` | DECIMAL(10,2) | DEFAULT 0 | |
| `isas_peps_shares` | DECIMAL(10,2) | DEFAULT 0 | |
| `school_age_children_count` | INT | NOT NULL, DEFAULT 1 | Divisor for savings calculation |
| `derived_savings_annual_total` | DECIMAL(10,2) | DEFAULT 0 | Calculated: (cash + ISAs) / children / years |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### 6.3.10 AssessmentChecklist

Qualitative context tabs. Free-text notes that inform the recommendation but do not feed into the calculation.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `assessment_id` | UUID | FK → Assessment, NOT NULL | |
| `tab` | ENUM | NOT NULL | `BURSARY_DETAILS`, `LIVING_CONDITIONS`, `DEBT`, `OTHER_FEES`, `STAFF`, `FINANCIAL_PROFILE` |
| `notes` | TEXT | DEFAULT '' | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

**Unique constraint:** `(assessment_id, tab)`

#### 6.3.11 Recommendation

The structured output per assessment, stored for longitudinal history.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `assessment_id` | UUID | FK → Assessment, NOT NULL, UNIQUE | |
| `bursary_account_id` | UUID | FK → BursaryAccount | Set when outcome is QUALIFIES |
| `round_id` | UUID | FK → Round, NOT NULL | |
| `family_synopsis` | TEXT | | Single/married, children, employment roles |
| `accommodation_status` | TEXT | | Rent / mortgage / mortgage-free |
| `income_category` | TEXT | | Category label, not precise figure |
| `property_category` | INT | | 1–12 (same as assessment) |
| `bursary_award` | DECIMAL(10,2) | | Nominal £ |
| `yearly_payable_fees` | DECIMAL(10,2) | | |
| `monthly_payable_fees` | DECIMAL(10,2) | | |
| `dishonesty_flag` | BOOLEAN | DEFAULT false | |
| `credit_risk_flag` | BOOLEAN | DEFAULT false | |
| `summary` | TEXT | | Free-text recommendation narrative |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### 6.3.12 ReasonCode & RecommendationReasonCode

Configurable year-on-year change codes. Junction table links selected codes to a recommendation.

**ReasonCode:**

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `code` | INT | NOT NULL, UNIQUE | Display code (1, 2, ... 35) |
| `label` | TEXT | NOT NULL | e.g., "Salary increase" |
| `is_deprecated` | BOOLEAN | DEFAULT false | Hidden from new assessments, visible on historical records |
| `sort_order` | INT | NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

**RecommendationReasonCode:**

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `recommendation_id` | UUID | FK → Recommendation, NOT NULL | |
| `reason_code_id` | UUID | FK → ReasonCode, NOT NULL | |

**PK:** `(recommendation_id, reason_code_id)`

#### 6.3.13 SiblingLink

Links bursary accounts as siblings. The priority order determines income absorption sequence.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `family_group_id` | UUID | NOT NULL | Groups all siblings in a family |
| `bursary_account_id` | UUID | FK → BursaryAccount, NOT NULL | |
| `priority_order` | INT | NOT NULL | 1 = primary (absorbs income first), 2 = second child, etc. |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

**Unique constraint:** `(family_group_id, bursary_account_id)`, `(family_group_id, priority_order)`

This design allows querying "all siblings in a family" by `family_group_id`, and determining the deduction chain by `priority_order`.

#### 6.3.14 Reference Configuration Tables

These store the current default values for new assessments. They are **not** joined at calculation time — values are snapshotted onto the Assessment record.

**FamilyTypeConfig:**

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `category` | INT | NOT NULL | 1–6 |
| `description` | TEXT | NOT NULL | e.g., "Parents with 2 children" |
| `notional_rent` | DECIMAL(10,2) | NOT NULL | |
| `utility_costs` | DECIMAL(10,2) | NOT NULL | |
| `food_costs` | DECIMAL(10,2) | NOT NULL | |
| `effective_from` | DATE | NOT NULL | When these values took effect |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

**Unique constraint:** `(category, effective_from)` — allows storing historical configs.

**SchoolFees:**

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `school` | ENUM | NOT NULL | `TRINITY`, `WHITGIFT` |
| `annual_fees` | DECIMAL(10,2) | NOT NULL | Pre-VAT |
| `effective_from` | DATE | NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

**CouncilTaxDefault:**

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `amount` | DECIMAL(10,2) | NOT NULL | Band D Croydon |
| `description` | TEXT | DEFAULT 'Band D Croydon' | |
| `effective_from` | DATE | NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

#### 6.3.15 Invitation

Tracks invitations sent by assessors.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `email` | TEXT | NOT NULL | |
| `applicant_name` | TEXT | | Optional — assessor may provide |
| `child_name` | TEXT | | |
| `school` | ENUM | | `TRINITY`, `WHITGIFT` |
| `round_id` | UUID | FK → Round | |
| `bursary_account_id` | UUID | FK → BursaryAccount | For re-assessment invitations |
| `auth_user_id` | UUID | | Supabase Auth user ID once invitation is accepted |
| `status` | ENUM | NOT NULL, DEFAULT 'PENDING' | `PENDING`, `ACCEPTED`, `EXPIRED` |
| `expires_at` | TIMESTAMPTZ | NOT NULL | |
| `accepted_at` | TIMESTAMPTZ | | |
| `created_by` | UUID | FK → Profile, NOT NULL | Assessor who sent it |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

#### 6.3.16 EmailTemplate

Configurable email templates with merge fields.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `type` | ENUM | NOT NULL, UNIQUE | `INVITATION`, `CONFIRMATION`, `MISSING_DOCS`, `OUTCOME_QUALIFIES`, `OUTCOME_DNQ`, `REASSESSMENT`, `REMINDER` |
| `subject` | TEXT | NOT NULL | Supports merge tags: `{{applicant_name}}`, `{{child_name}}`, etc. |
| `body` | TEXT | NOT NULL | Supports merge tags |
| `merge_fields` | JSONB | NOT NULL | List of available merge tags for this template |
| `updated_by` | UUID | FK → Profile | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### 6.3.17 AuditLog

Immutable append-only log for GDPR accountability and operational traceability.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → Profile | NULL for system actions |
| `action` | TEXT | NOT NULL | e.g., `NAME_REVEAL`, `ASSESSMENT_SAVED`, `APPLICATION_SUBMITTED`, `DATA_DELETED` |
| `entity_type` | TEXT | NOT NULL | e.g., `Application`, `Assessment`, `Profile` |
| `entity_id` | UUID | | The affected record |
| `context` | TEXT | | e.g., `application_queue`, `assessment_form` |
| `metadata` | JSONB | DEFAULT '{}' | Additional context (old/new values for changes, IP address) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**This table has no UPDATE or DELETE operations.** Rows are only ever inserted. RLS policy: assessors can read; no role can update or delete.

**Index:** `(entity_type, entity_id)` — for viewing audit history per record. `(user_id, created_at)` — for reviewing a user's activity.

### 6.4 Data Migration Strategy

Data migration from Symplectic Grant Tracker is the **highest-risk dependency** (PRD D-1). The strategy accounts for Grant Tracker's uncertain export capabilities.

#### 6.4.1 What Must Be Migrated

| Data | Priority | Volume | Notes |
|------|----------|--------|-------|
| Active bursary accounts | Must Have | ~100–200 | Reference numbers, school, child details, entry year, benchmark payable fees |
| Historical assessments | Must Have | 1–2 years per account | Assessor-entered figures, calculation results, recommendations |
| Sibling linkages | Must Have | ~20–40 families | Which accounts are linked and in what order |
| Uploaded documents | Must Have | ~2000–4000 files | PDFs and images from current and recent applications |
| Applicant accounts | Must Have | ~100–200 | Email, name — needed for re-assessment invitations |
| Reason codes per assessment | Should Have | | Year-on-year change codes |
| Historical rounds | Should Have | 2–3 years | For longitudinal reporting |

#### 6.4.2 Migration Approach

1. **Investigation phase** (first priority): Determine Grant Tracker's export capabilities — REST API v7.0, database export, CSV export, or manual extraction.
2. **ETL scripts**: TypeScript scripts that read from the export format and write to the new Prisma schema. Run as a one-time migration job.
3. **Document migration**: Download all documents from Grant Tracker, re-upload to Supabase Storage with the new path convention.
4. **Verification**: Spot-check 20% of migrated accounts. Compare key figures (payable fees, bursary award, benchmark) against Grant Tracker.
5. **Parallel run**: If timeline allows, run both systems in parallel for one round to verify the new system produces correct results.

#### 6.4.3 Migration Timeline

Migration must complete before Grant Tracker's sunset (31 Dec 2026), with margin for verification. Per the Phase 4 timeline (Section 8.1), migration runs during Weeks 10–12+ of the project, with feature-complete code available from Week 9.

### 6.5 Retention & Deletion

GDPR compliance is enforced at the database level.

| Scenario | Retention | Implementation |
|----------|-----------|---------------|
| **Active bursary** | Indefinite while active | No automated action. Data persists as long as `BursaryAccount.status = ACTIVE`. |
| **Bursary ended** (child left school) | 7 years from closure | A `retention_expires_at` column on BursaryAccount, set to `closed_at + 7 years`. A scheduled job flags expired accounts for deletion review. |
| **Rejected application** (Does Not Qualify) | 4 weeks from outcome | `retention_expires_at` set to `completed_at + 28 days`. Auto-flagged for deletion after appeal window. |
| **Right-to-deletion request** | Immediate | Assessor triggers deletion via admin console. All personal data, documents, and assessment records are permanently deleted. An anonymised audit log entry records that a deletion occurred (date, admin user, anonymised reference — not the deleted data). |

**Deletion cascade:** When an applicant's data is deleted:
1. All `ApplicationSection` rows → deleted
2. All `Document` rows → deleted, files removed from Supabase Storage
3. All `Assessment`, `AssessmentEarner`, `AssessmentProperty`, `AssessmentChecklist` rows → deleted
4. All `Recommendation`, `RecommendationReasonCode` rows → deleted
5. `Application` row → deleted
6. `BursaryAccount` row → deleted (if no other applications reference it)
7. `Profile` row → personal fields nulled, `role` set to `DELETED`
8. Supabase Auth user → deleted via admin API
9. `AuditLog` entry created: `action: DATA_DELETED`, `entity_type: Profile`, no personal data in the log

---
