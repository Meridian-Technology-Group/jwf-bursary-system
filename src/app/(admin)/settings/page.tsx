/**
 * WP-19 + CALC-11: Admin Settings — Reference Data Management
 *
 * Eight tabs:
 *   1. Family Types      — notional rent, utilities, food costs per category
 *   2. School Fees       — annual fees per school
 *   3. Council Tax       — Band D Croydon default
 *   4. Notional Costs    — CALC-01 NotionalCostConfig matrix + FamilyCategoryMeta
 *   5. Benchmark Bands   — CALC-01 profiling bands (Appendix B, C.1–C.5)
 *   6. Reason Codes      — full CRUD + deprecation, plus Gap Reasons (Appendix E)
 *   7. Close Reasons     — full CRUD + purge-on-close toggle + deprecation (item 4.3)
 *   8. Email Templates   — subject + body editor with merge field hints
 */

import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import {
  getFamilyTypeConfigs,
  getAllSchoolFees,
  getCouncilTaxDefault,
  getAllReasonCodes,
  getAllGapReasons,
  getAllCloseReasons,
  getAllEmailTemplates,
  getNotionalCostConfigs,
  getFamilyCategoryMetas,
  getAffordabilityBands,
  getIncomeCategoryBands,
  getPropertyEquityBands,
  getFinancialEquityBands,
  getDebtRatioBands,
  getLifestyleSqueezeBands,
} from "@/lib/db/queries/reference-tables";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FamilyTypeRow } from "@/components/admin/settings/family-type-form";
import { SchoolFeesRow } from "@/components/admin/settings/school-fees-form";
import { AddSchoolFeesYearForm } from "@/components/admin/settings/add-school-fees-year-form";
import { CouncilTaxForm } from "@/components/admin/settings/council-tax-form";
import { ReasonCodeTable } from "@/components/admin/settings/reason-code-table";
import { GapReasonTable } from "@/components/admin/settings/gap-reason-table";
import { CloseReasonTable } from "@/components/admin/settings/close-reason-table";
import { EmailTemplateEditor } from "@/components/admin/settings/email-template-editor";
import { NotionalCostTab } from "@/components/admin/settings/notional-cost-tab";
import { BenchmarkBandsTab } from "@/components/admin/settings/benchmark-bands-tab";

export const metadata = {
  title: "Settings",
};

// ─── Section wrapper ──────────────────────────────────────────────────────────

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold text-primary-900">{title}</h2>
      <p className="mt-0.5 text-sm text-slate-500">{description}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SettingsPage() {
  const user = await requireRole([Role.ADMIN]);

  // Parallel data fetches
  const [
    familyTypeConfigs,
    schoolFees,
    councilTax,
    reasonCodes,
    gapReasons,
    closeReasons,
    emailTemplates,
    notionalCosts,
    familyCategoryMetas,
    affordabilityBands,
    incomeCategoryBands,
    propertyEquityBands,
    financialEquityBands,
    debtRatioBands,
    lifestyleSqueezeBands,
  ] = await withUserContext(user.id, user.role as RlsRole, (tx) =>
    Promise.all([
      getFamilyTypeConfigs(tx),
      getAllSchoolFees(tx),
      getCouncilTaxDefault(tx),
      getAllReasonCodes(tx),
      getAllGapReasons(tx),
      getAllCloseReasons(tx),
      getAllEmailTemplates(tx),
      getNotionalCostConfigs(tx),
      getFamilyCategoryMetas(tx),
      getAffordabilityBands(tx),
      getIncomeCategoryBands(tx),
      getPropertyEquityBands(tx),
      getFinancialEquityBands(tx),
      getDebtRatioBands(tx),
      getLifestyleSqueezeBands(tx),
    ])
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage reference data used in bursary assessments.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="family-types" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8 h-auto gap-0 bg-slate-100 p-1 rounded-lg">
          <TabsTrigger
            value="family-types"
            className="text-xs sm:text-sm rounded-md"
          >
            Family Types
          </TabsTrigger>
          <TabsTrigger
            value="school-fees"
            className="text-xs sm:text-sm rounded-md"
          >
            School Fees
          </TabsTrigger>
          <TabsTrigger
            value="council-tax"
            className="text-xs sm:text-sm rounded-md"
          >
            Council Tax
          </TabsTrigger>
          <TabsTrigger
            value="notional-costs"
            className="text-xs sm:text-sm rounded-md"
          >
            Notional Costs
          </TabsTrigger>
          <TabsTrigger
            value="benchmark-bands"
            className="text-xs sm:text-sm rounded-md"
          >
            Benchmark Bands
          </TabsTrigger>
          <TabsTrigger
            value="reason-codes"
            className="text-xs sm:text-sm rounded-md"
          >
            Reason Codes
          </TabsTrigger>
          <TabsTrigger
            value="close-reasons"
            className="text-xs sm:text-sm rounded-md"
          >
            Close Reasons
          </TabsTrigger>
          <TabsTrigger
            value="email-templates"
            className="text-xs sm:text-sm rounded-md"
          >
            Email Templates
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Family Types ─────────────────────────────────────────── */}
        <TabsContent value="family-types">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <SectionHeader
              title="Family Type Configurations"
              description="Notional rent, utility costs, and food costs per family category. Saving creates a new versioned record effective today."
            />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs">Family Type</TableHead>
                    <TableHead className="text-xs">Notional Rent</TableHead>
                    <TableHead className="text-xs">Utility Costs</TableHead>
                    <TableHead className="text-xs">Food Costs</TableHead>
                    <TableHead className="w-28 text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {familyTypeConfigs.map((config) => (
                    <FamilyTypeRow key={config.id} config={config} />
                  ))}
                  {familyTypeConfigs.length === 0 && (
                    <TableRow>
                      <TableHead
                        colSpan={5}
                        className="py-8 text-center text-sm text-slate-400 font-normal"
                      >
                        No family type configurations found. Run the seed script to populate.
                      </TableHead>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Changes are versioned. The most recent entry per category is used in new assessments.
            </p>
          </div>
        </TabsContent>

        {/* ── Tab 2: School Fees ──────────────────────────────────────────── */}
        <TabsContent value="school-fees">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <SectionHeader
              title="School Annual Fees"
              description="Pre-VAT annual fees for each school, per academic year. Editing a row updates that year; add the next year below when the Foundation confirms it."
            />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs">School</TableHead>
                    <TableHead className="text-xs">
                      Annual Fees (excluding VAT)
                    </TableHead>
                    <TableHead className="text-xs">
                      Max Payable Fees (including VAT)
                    </TableHead>
                    <TableHead className="text-xs">Academic Year</TableHead>
                    <TableHead className="w-28 text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schoolFees.map((fees) => (
                    <SchoolFeesRow key={fees.id} fees={fees} />
                  ))}
                  {schoolFees.length === 0 && (
                    <TableRow>
                      <TableHead
                        colSpan={5}
                        className="py-8 text-center text-sm text-slate-400 font-normal"
                      >
                        No school fee records found.
                      </TableHead>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <AddSchoolFeesYearForm />
            <p className="mt-3 text-xs text-slate-400">
              Fees are held excluding VAT. The maximum payable figure is the same
              fee with VAT (currently 20%) applied — what a parent would pay with
              no scholarship and no bursary — and is the ceiling the
              affordability calculation caps against. An assessment reads the fee
              for the academic year of its round, plus the following
              year&apos;s fee when recorded.
            </p>
          </div>
        </TabsContent>

        {/* ── Tab 3: Council Tax ──────────────────────────────────────────── */}
        <TabsContent value="council-tax">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <SectionHeader
              title="Council Tax Default"
              description="The default annual council tax figure used in living costs calculations (Band D, Croydon). Saving creates a new versioned record."
            />
            <CouncilTaxForm current={councilTax} />
          </div>
        </TabsContent>

        {/* ── Tab: Notional Costs (CALC-11) ──────────────────────────────── */}
        <TabsContent value="notional-costs">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <SectionHeader
              title="Notional Costs"
              description="The CALC-01 notional cost-of-living figures per family category feeding the v2 notional-spend engine. Creating a new version inserts a whole new generation of rows — the current version is kept, never mutated."
            />
            <NotionalCostTab
              notionalCosts={notionalCosts}
              familyCategoryMetas={familyCategoryMetas}
            />
          </div>
        </TabsContent>

        {/* ── Tab: Benchmark Bands (CALC-11) ─────────────────────────────── */}
        <TabsContent value="benchmark-bands">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <SectionHeader
              title="Benchmark Bands"
              description="The CALC-01 profiling band tables (Appendix B, C.1–C.5) driving the affordability grid and the income/property/financial/debt/lifestyle-squeeze categorisations. Creating a new version inserts a whole new generation of rows."
            />
            <BenchmarkBandsTab
              affordabilityBands={affordabilityBands}
              incomeCategoryBands={incomeCategoryBands}
              propertyEquityBands={propertyEquityBands}
              financialEquityBands={financialEquityBands}
              debtRatioBands={debtRatioBands}
              lifestyleSqueezeBands={lifestyleSqueezeBands}
            />
          </div>
        </TabsContent>

        {/* ── Tab 4: Reason Codes ─────────────────────────────────────────── */}
        <TabsContent value="reason-codes">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <SectionHeader
              title="Reason Codes"
              description="Codes used in assessment recommendations to explain year-on-year changes. Deprecated codes are hidden from assessors but retained for historical records."
            />
            <ReasonCodeTable reasonCodes={reasonCodes} />
          </div>
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
            <SectionHeader
              title="Gap Reasons"
              description="Reasons for a gap between the recommended (min-of-three) and confirmed payable fees (Appendix E), required whenever a recommendation's gap amount is non-zero. Same deprecate-never-delete convention as reason codes."
            />
            <GapReasonTable gapReasons={gapReasons} />
          </div>
        </TabsContent>

        {/* ── Tab 5: Close Reasons ────────────────────────────────────────── */}
        <TabsContent value="close-reasons">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <SectionHeader
              title="Close Reasons"
              description="Reasons offered when closing an application. The purge-on-close toggle decides whether closing with that reason purges the applicant's data or retains it under the normal retention policy. Deprecated reasons are hidden from the close dropdown but retained for historical records."
            />
            <CloseReasonTable closeReasons={closeReasons} />
          </div>
        </TabsContent>

        {/* ── Tab 6: Email Templates ──────────────────────────────────────── */}
        <TabsContent value="email-templates">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <SectionHeader
              title="Email Templates"
              description="Edit the subject line and body for each system email. Use merge fields (shown below) which are substituted with real values when emails are sent."
            />
            <EmailTemplateEditor templates={emailTemplates} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
