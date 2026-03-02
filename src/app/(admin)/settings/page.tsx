/**
 * WP-19: Admin Settings — Reference Data Management
 *
 * Five tabs:
 *   1. Family Types     — notional rent, utilities, food costs per category
 *   2. School Fees      — annual fees per school
 *   3. Council Tax      — Band D Croydon default
 *   4. Reason Codes     — full CRUD + deprecation
 *   5. Email Templates  — subject + body editor with merge field hints
 */

import { requireRole, Role } from "@/lib/auth/roles";
import {
  getFamilyTypeConfigs,
  getSchoolFees,
  getCouncilTaxDefault,
  getAllReasonCodes,
  getAllEmailTemplates,
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
import { CouncilTaxForm } from "@/components/admin/settings/council-tax-form";
import { ReasonCodeTable } from "@/components/admin/settings/reason-code-table";
import { EmailTemplateEditor } from "@/components/admin/settings/email-template-editor";

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
  await requireRole([Role.ADMIN]);

  // Parallel data fetches
  const [familyTypeConfigs, schoolFees, councilTax, reasonCodes, emailTemplates] =
    await Promise.all([
      getFamilyTypeConfigs(),
      getSchoolFees(),
      getCouncilTaxDefault(),
      getAllReasonCodes(),
      getAllEmailTemplates(),
    ]);

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
        <TabsList className="grid w-full grid-cols-5 h-auto gap-0 bg-slate-100 p-1 rounded-lg">
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
            value="reason-codes"
            className="text-xs sm:text-sm rounded-md"
          >
            Reason Codes
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
              description="Pre-VAT annual fees for each school. Saving creates a new versioned record effective today."
            />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs">School</TableHead>
                    <TableHead className="text-xs">Annual Fees</TableHead>
                    <TableHead className="text-xs">Effective From</TableHead>
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
                        colSpan={4}
                        className="py-8 text-center text-sm text-slate-400 font-normal"
                      >
                        No school fee records found.
                      </TableHead>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              VAT (currently 20%) is applied on top during calculations. Only the current (most recent) fee
              per school is used in new assessments.
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

        {/* ── Tab 4: Reason Codes ─────────────────────────────────────────── */}
        <TabsContent value="reason-codes">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <SectionHeader
              title="Reason Codes"
              description="Codes used in assessment recommendations to explain year-on-year changes. Deprecated codes are hidden from assessors but retained for historical records."
            />
            <ReasonCodeTable reasonCodes={reasonCodes} />
          </div>
        </TabsContent>

        {/* ── Tab 5: Email Templates ──────────────────────────────────────── */}
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
