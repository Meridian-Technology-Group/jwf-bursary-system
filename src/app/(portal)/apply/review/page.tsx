/**
 * Review page — applicant reviews all sections before submitting.
 *
 * Server component. Shows:
 *   - Issues panel (when error-severity gaps exist) — blocks submit, each gap
 *     has a deep-link to the offending section + optional #fieldRef hash.
 *   - Positive empty state when zero gaps (all sections fully valid).
 *   - Per-section summary cards with concise data summaries.
 *   - Submit button (links to /apply/declaration when no blocking gaps).
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, Edit2, XCircle, ChevronRight } from "lucide-react";
import { ApplicationSectionType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getSectionGapStatuses } from "@/lib/portal/section-gaps";
import { cn } from "@/lib/utils";
import type {
  ChildDetailsData,
  FamilyIdData,
  ParentDetailsData,
  DependentChildrenData,
  DependentElderlyData,
  OtherInfoData,
  ParentsIncomeData,
  AssetsLiabilitiesData,
  AdditionalInfoData,
} from "@/types/application";

export const metadata = {
  title: "Review Your Application",
};

// ─── Section metadata ─────────────────────────────────────────────────────────

const SECTION_ORDER: ApplicationSectionType[] = [
  "CHILD_DETAILS",
  "FAMILY_ID",
  "PARENT_DETAILS",
  "DEPENDENT_CHILDREN",
  "DEPENDENT_ELDERLY",
  "OTHER_INFO",
  "PARENTS_INCOME",
  "ASSETS_LIABILITIES",
  "ADDITIONAL_INFO",
  "DECLARATION",
];

// DECLARATION is excluded from summary cards (that's where submit lives)
const SUMMARY_SECTIONS: ApplicationSectionType[] = SECTION_ORDER.filter(
  (s) => s !== "DECLARATION"
);

const SECTION_TITLES: Record<ApplicationSectionType, string> = {
  CHILD_DETAILS: "Details of Child",
  FAMILY_ID: "Family Identification",
  PARENT_DETAILS: "Parent / Guardian Details",
  DEPENDENT_CHILDREN: "Dependent Children",
  DEPENDENT_ELDERLY: "Dependent Elderly",
  OTHER_INFO: "Other Information Required",
  PARENTS_INCOME: "Parents' Income",
  ASSETS_LIABILITIES: "Parents' Assets & Liabilities",
  ADDITIONAL_INFO: "Additional Information",
  DECLARATION: "Declaration",
};

const SECTION_SLUGS: Record<ApplicationSectionType, string> = {
  CHILD_DETAILS: "child-details",
  FAMILY_ID: "family-id",
  PARENT_DETAILS: "parent-details",
  DEPENDENT_CHILDREN: "dependent-children",
  DEPENDENT_ELDERLY: "dependent-elderly",
  OTHER_INFO: "other-info",
  PARENTS_INCOME: "parents-income",
  ASSETS_LIABILITIES: "assets-liabilities",
  ADDITIONAL_INFO: "additional-info",
  DECLARATION: "declaration",
};

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB"); // DD/MM/YYYY
}

function fmtCurrency(value: number | undefined | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtSchool(school: string | undefined | null): string {
  if (!school) return "—";
  if (school === "TRINITY") return "Trinity School";
  if (school === "WHITGIFT") return "Whitgift School";
  return school;
}

function totalIncome(inc: ParentsIncomeData["parent1Income"]): number {
  return (
    (inc.salaryWagesPension ?? 0) +
    (inc.supplementsAndBonus ?? 0) +
    (inc.otherBenefitsAndCommissions ?? 0) +
    (inc.amountFromPartner ?? 0) +
    (inc.workingTaxCredits ?? 0) +
    (inc.grossInterestReceived ?? 0) +
    (inc.allDividendIncome ?? 0) +
    (inc.grossRentsReceived ?? 0) +
    (inc.allIncomeBonds ?? 0) +
    (inc.otherGrossIncomes ?? 0) +
    (inc.maintenanceOrEquivalents ?? 0) +
    (inc.bursariesOrSponsorships ?? 0) +
    (inc.otherIncomeNotIncluded ?? 0) +
    (inc.otherIncome ?? 0)
  );
}

function totalAssets(d: AssetsLiabilitiesData): number {
  return (
    (d.residenceValue ?? 0) +
    (d.carValue ?? 0) +
    (d.otherPossessionsValue ?? 0) +
    (d.stocksAndSharesValue ?? 0) +
    (d.investmentsValue ?? 0) +
    (d.otherAssetsValue ?? 0) +
    (d.otherPropertiesTotalValue ?? 0)
  );
}

function totalLiabilities(d: AssetsLiabilitiesData): number {
  return (
    (d.outstandingMainMortgage ?? 0) +
    (d.totalOtherMortgages ?? 0) +
    (d.currentOverdraft ?? 0) +
    (d.hirePurchaseBalance ?? 0) +
    (d.otherMortgageBalance ?? 0)
  );
}

function parseSafe<T>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return null;
  return raw as T;
}

// ─── Section summary renderers ────────────────────────────────────────────────

type SummaryRow = { label: string; value: string };

function renderChildDetails(raw: unknown): SummaryRow[] {
  const d = parseSafe<ChildDetailsData>(raw);
  if (!d) return [];
  const rows: SummaryRow[] = [
    { label: "Name", value: d.childFullName || "—" },
    { label: "Date of birth", value: fmtDate(d.dateOfBirth) },
    { label: "School applying for", value: fmtSchool(d.school) },
    { label: "Current school", value: d.currentSchool || "—" },
    { label: "Place of birth", value: d.placeOfBirth || "—" },
  ];
  if (!d.sameAddressAsParent1 && d.childAddress) {
    rows.push({
      label: "Child's address",
      value: [d.childAddress.addressLine1, d.childAddress.city, d.childAddress.postcode]
        .filter(Boolean)
        .join(", "),
    });
  }
  return rows;
}

function renderFamilyId(raw: unknown): SummaryRow[] {
  const d = parseSafe<FamilyIdData>(raw);
  if (!d || !Array.isArray(d.familyMembers) || d.familyMembers.length === 0) return [];
  return d.familyMembers.map((m) => ({
    label: m.familyMemberName || "Member",
    value: m.isBritishCitizen ? "British citizen" : "Non-British citizen",
  }));
}

function renderParentDetails(raw: unknown): SummaryRow[] {
  const d = parseSafe<ParentDetailsData>(raw);
  if (!d) return [];
  const rows: SummaryRow[] = [];
  const p1 = d.parent1Contact;
  if (p1) {
    rows.push({
      label: "Parent / Guardian 1",
      value: [p1.firstName, p1.lastName].filter(Boolean).join(" ") || "—",
    });
    if (p1.addressLine1) {
      rows.push({
        label: "Address",
        value: [p1.addressLine1, p1.city, p1.postcode].filter(Boolean).join(", "),
      });
    }
    if (d.parent1Employment?.status) {
      rows.push({ label: "Employment", value: d.parent1Employment.status.replace(/_/g, " ") });
    }
  }
  if (!d.isSoleParent && d.parent2Contact) {
    const p2 = d.parent2Contact;
    rows.push({
      label: "Parent / Guardian 2",
      value: [p2.firstName, p2.lastName].filter(Boolean).join(" ") || "—",
    });
    if (d.parent2Employment?.status) {
      rows.push({ label: "P2 Employment", value: d.parent2Employment.status.replace(/_/g, " ") });
    }
  }
  if (d.isSoleParent) {
    rows.push({ label: "Sole parent / guardian", value: "Yes" });
  }
  return rows;
}

function renderDependentChildren(raw: unknown): { rows: SummaryRow[]; childTable: { name: string; dob: string; isNamed: boolean }[] } {
  const d = parseSafe<DependentChildrenData>(raw);
  if (!d) return { rows: [], childTable: [] };
  const children = Array.isArray(d.children) ? d.children : [];
  const rows: SummaryRow[] = [
    { label: "Number of dependent children", value: String(children.length || d.numberOfDependentChildren || 0) },
  ];
  const childTable = children.map((c) => ({
    name: c.name || "—",
    dob: fmtDate(c.dependentStatusDate),
    isNamed: c.isNamedChild === true,
  }));
  return { rows, childTable };
}

function renderDependentElderly(raw: unknown): SummaryRow[] {
  const d = parseSafe<DependentElderlyData>(raw);
  if (!d) return [];
  const rows: SummaryRow[] = [];
  if (d.hasElderlyAtHome) {
    rows.push({ label: "Elderly at home", value: `Yes — ${d.elderlyAtHome?.length ?? 0} person(s)` });
  } else if (d.hasElderlyAtHome === false) {
    rows.push({ label: "Elderly at home", value: "No" });
  }
  if (d.hasElderlyInCare) {
    rows.push({ label: "Elderly in care", value: `Yes — ${d.elderlyInCare?.length ?? 0} person(s)` });
  } else if (d.hasElderlyInCare === false) {
    rows.push({ label: "Elderly in care", value: "No" });
  }
  return rows;
}

function renderOtherInfo(raw: unknown): SummaryRow[] {
  const d = parseSafe<OtherInfoData>(raw);
  if (!d) return [];
  const rows: SummaryRow[] = [];
  if (d.hasCOurtOrder) {
    const amt = d.courtOrderYearAmount ? fmtCurrency(d.courtOrderYearAmount) + "/year" : "";
    rows.push({ label: "Court order / maintenance", value: `Yes${amt ? ` — ${amt}` : ""}` });
  }
  if (d.hasInsurancePolicy) {
    rows.push({ label: "Insurance policy", value: `Yes${d.insurancePolicyAmount ? ` — ${fmtCurrency(d.insurancePolicyAmount)}` : ""}` });
  }
  if (d.hasOutstandingFees) {
    rows.push({ label: "Outstanding school fees", value: `Yes${d.outstandingFeesAmount ? ` — ${fmtCurrency(d.outstandingFeesAmount)}` : ""}` });
  }
  if (rows.length === 0) {
    rows.push({ label: "No special circumstances", value: "" });
  }
  return rows;
}

interface IncomeSection {
  label: string;
  total: string;
  itemised: { label: string; value: string }[];
}

function buildIncomeSection(
  inc: ParentsIncomeData["parent1Income"],
  parentLabel: string
): IncomeSection {
  const items: { label: string; value: number }[] = [
    { label: "Salary / wages / pension", value: inc.salaryWagesPension ?? 0 },
    { label: "Supplements & bonus", value: inc.supplementsAndBonus ?? 0 },
    { label: "Benefits & commissions", value: inc.otherBenefitsAndCommissions ?? 0 },
    { label: "Amount from partner", value: inc.amountFromPartner ?? 0 },
    { label: "Working tax credits", value: inc.workingTaxCredits ?? 0 },
    { label: "Gross interest", value: inc.grossInterestReceived ?? 0 },
    { label: "Dividend income", value: inc.allDividendIncome ?? 0 },
    { label: "Rental income", value: inc.grossRentsReceived ?? 0 },
    { label: "Income bonds", value: inc.allIncomeBonds ?? 0 },
    { label: "Other gross income", value: inc.otherGrossIncomes ?? 0 },
    { label: "Maintenance / equivalents", value: inc.maintenanceOrEquivalents ?? 0 },
    { label: "Bursaries / sponsorships", value: inc.bursariesOrSponsorships ?? 0 },
    { label: "Other income", value: (inc.otherIncomeNotIncluded ?? 0) + (inc.otherIncome ?? 0) },
  ].filter((i) => i.value > 0);

  return {
    label: parentLabel,
    total: fmtCurrency(totalIncome(inc)),
    itemised: items.map((i) => ({ label: i.label, value: fmtCurrency(i.value) })),
  };
}

function renderParentsIncome(raw: unknown): { rows: SummaryRow[]; incomeSections: IncomeSection[] } {
  const d = parseSafe<ParentsIncomeData>(raw);
  if (!d) return { rows: [], incomeSections: [] };
  const incomeSections: IncomeSection[] = [];
  if (d.parent1Income) {
    incomeSections.push(buildIncomeSection(d.parent1Income, "Parent / Guardian 1"));
  }
  if (d.parent2Income) {
    incomeSections.push(buildIncomeSection(d.parent2Income, "Parent / Guardian 2"));
  }
  const combinedTotal = incomeSections.reduce(
    (acc, s) => acc + parseInt(s.total.replace(/[£,]/g, ""), 10),
    0
  );
  const rows: SummaryRow[] = [
    { label: "Combined total income", value: fmtCurrency(combinedTotal) },
  ];
  return { rows, incomeSections };
}

function renderAssetsLiabilities(raw: unknown): SummaryRow[] {
  const d = parseSafe<AssetsLiabilitiesData>(raw);
  if (!d) return [];
  const rows: SummaryRow[] = [
    { label: "Property ownership", value: d.propertyOwnership === "OWN" ? "Owns home" : d.propertyOwnership === "RENT" ? "Rents home" : "—" },
    { label: "Total assets", value: fmtCurrency(totalAssets(d)) },
    { label: "Total liabilities", value: fmtCurrency(totalLiabilities(d)) },
    { label: "Net assets", value: fmtCurrency(totalAssets(d) - totalLiabilities(d)) },
  ];
  if (d.hasOtherProperties && d.otherProperties?.length) {
    rows.push({ label: "Other properties", value: String(d.otherProperties.length) });
  }
  return rows;
}

function renderAdditionalInfo(raw: unknown): SummaryRow[] {
  const d = parseSafe<AdditionalInfoData>(raw);
  if (!d) return [];
  const circumstances: string[] = [];
  if (d.divorced?.applies) circumstances.push("Divorced");
  if (d.separated?.applies) circumstances.push("Separated");
  if (d.sickUnableToWork?.applies) circumstances.push("Sick / unable to work");
  if (d.rent?.applies) circumstances.push("Paying rent");
  if (d.madeRedundant?.applies) circumstances.push("Made redundant");
  if (d.receivingBenefits?.applies) circumstances.push("Receiving benefits");
  if (circumstances.length === 0) {
    return [{ label: "Special circumstances", value: "None declared" }];
  }
  const rows: SummaryRow[] = [
    { label: "Circumstances", value: circumstances.join(", ") },
  ];
  if (d.additionalNarrative) {
    rows.push({ label: "Narrative", value: d.additionalNarrative.slice(0, 120) + (d.additionalNarrative.length > 120 ? "…" : "") });
  }
  return rows;
}

// ─── Section card ─────────────────────────────────────────────────────────────

function StatusPill({ isFullyValid, isStarted, hasErrors }: { isFullyValid: boolean; isStarted: boolean; hasErrors: boolean }) {
  if (isFullyValid) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Complete
      </span>
    );
  }
  if (!isStarted) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
        Not started
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      {hasErrors ? "Needs attention" : "In progress"}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Load application with full section data (needed for summary cards)
  const application = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      tx.application.findFirst({
        where: { leadApplicantId: user.id },
        orderBy: { updatedAt: "desc" },
        include: {
          sections: {
            select: { section: true, isComplete: true, data: true },
          },
          documents: {
            select: { slot: true, filename: true },
          },
        },
      })
  );

  if (!application) redirect("/");

  if (application.status === "SUBMITTED") {
    redirect("/submitted");
  }

  // ── Gap analysis ───────────────────────────────────────────────────────────
  const gapStatuses = await getSectionGapStatuses(application.id);

  const allErrorGaps = gapStatuses.flatMap((gs) =>
    gs.gaps.filter((g) => g.severity === "error")
  );
  const hasBlockingGaps = allErrorGaps.length > 0;

  const validMap = new Map<ApplicationSectionType, boolean>();
  const startedMap = new Map<ApplicationSectionType, boolean>();
  const gapMap = new Map<ApplicationSectionType, typeof allErrorGaps>();
  for (const gs of gapStatuses) {
    validMap.set(gs.sectionType as ApplicationSectionType, gs.isFullyValid);
    startedMap.set(gs.sectionType as ApplicationSectionType, gs.isStarted);
    gapMap.set(
      gs.sectionType as ApplicationSectionType,
      gs.gaps.filter((g) => g.severity === "error")
    );
  }

  // Build data map from sections
  const sectionDataMap = new Map<ApplicationSectionType, unknown>();
  for (const s of application.sections) {
    sectionDataMap.set(s.section as ApplicationSectionType, s.data);
  }

  const completedCount = SECTION_ORDER.filter((s) => validMap.get(s) === true).length;

  const totalSatisfied = gapStatuses.reduce((acc, gs) => acc + gs.progress.satisfied, 0);
  const totalItems = gapStatuses.reduce((acc, gs) => acc + gs.progress.total, 0);
  const progressPct =
    totalItems > 0
      ? parseFloat(((totalSatisfied / totalItems) * 100).toFixed(1))
      : 0;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
          Step 10 of 11 — Review
        </div>
        <h1 className="text-2xl font-semibold text-primary-900">
          Review Your Application
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Check each section below, then click &ldquo;Proceed to Declaration&rdquo; when ready.
          You can edit any section using the Edit button.
        </p>
      </div>

      {/* Progress summary */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Sections fully complete</span>
          <span className="font-semibold text-primary-900">
            {completedCount} of {SECTION_ORDER.length}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-accent-600 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progressPct}% of required items complete`}
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-400 text-right">{progressPct}%</p>
      </div>

      {/* ── Issues panel OR positive empty state ─────────────────────────────── */}
      {hasBlockingGaps ? (
        <section
          aria-labelledby="issues-heading"
          className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <XCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <h2
                id="issues-heading"
                className="text-base font-semibold text-red-800"
              >
                {allErrorGaps.length} issue{allErrorGaps.length === 1 ? "" : "s"} to resolve before you can submit
              </h2>
              <p className="mt-1 text-sm text-red-700">
                Please fix the following before submitting your application.
              </p>
              <ul className="mt-3 space-y-2">
                {allErrorGaps.map((gap) => {
                  const slug = SECTION_SLUGS[gap.sectionType as ApplicationSectionType];
                  // Deep-link: append #fieldRef hash when available so the
                  // browser scrolls to / focuses the field after navigation.
                  const href = slug
                    ? `/apply/${slug}${gap.fieldRef ? `#${gap.fieldRef}` : ""}`
                    : "#";
                  return (
                    <li key={gap.id} className="flex items-start gap-2 text-sm">
                      <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
                        aria-hidden="true"
                      />
                      <span className="flex-1 text-red-800">{gap.label}</span>
                      <Link
                        href={href}
                        className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-red-700 underline underline-offset-2 hover:text-red-900"
                      >
                        Go fix this
                        <ChevronRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      ) : (
        <section
          aria-label="Application status"
          className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
            <p className="text-sm font-medium text-green-800">
              Looks complete — review your details below and proceed to the Declaration when ready.
            </p>
          </div>
        </section>
      )}

      {/* ── Section summary cards ─────────────────────────────────────────────── */}
      <section aria-labelledby="sections-heading">
        <h2
          id="sections-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400"
        >
          Application sections
        </h2>

        <div className="space-y-4">
          {SUMMARY_SECTIONS.map((sectionType, idx) => {
            const isFullyValid = validMap.get(sectionType) === true;
            const isStarted = startedMap.get(sectionType) === true;
            const sectionErrorGaps = gapMap.get(sectionType) ?? [];
            const hasErrors = sectionErrorGaps.length > 0;
            const editHref = `/apply/${SECTION_SLUGS[sectionType]}`;
            const rawData = sectionDataMap.get(sectionType);

            return (
              <div
                key={sectionType}
                className={cn(
                  "rounded-xl border bg-white shadow-sm overflow-hidden",
                  isFullyValid
                    ? "border-green-200"
                    : hasErrors
                      ? "border-red-200"
                      : "border-slate-200"
                )}
              >
                {/* Card header */}
                <div
                  className={cn(
                    "flex items-center gap-3 px-5 py-3 border-b",
                    isFullyValid
                      ? "bg-green-50 border-green-100"
                      : hasErrors
                        ? "bg-red-50 border-red-100"
                        : "bg-slate-50 border-slate-100"
                  )}
                >
                  <span className="text-xs font-medium text-slate-400 shrink-0">
                    {idx + 1}.
                  </span>
                  <h3 className="flex-1 text-sm font-semibold text-slate-800">
                    {SECTION_TITLES[sectionType]}
                  </h3>
                  <StatusPill isFullyValid={isFullyValid} isStarted={isStarted} hasErrors={hasErrors} />
                  <Link
                    href={editHref}
                    className={cn(
                      "shrink-0 flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium",
                      "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
                      "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <Edit2 className="h-3 w-3" aria-hidden="true" />
                    Edit
                  </Link>
                </div>

                {/* Card body */}
                <div className="px-5 py-4">
                  {!isStarted ? (
                    <p className="text-sm text-slate-400 italic">Not started</p>
                  ) : (
                    <SectionSummaryBody
                      sectionType={sectionType}
                      rawData={rawData}
                      uploadedDocs={application.documents}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Proceed to Declaration CTA ───────────────────────────────────────── */}
      <section aria-labelledby="proceed-heading">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2
            id="proceed-heading"
            className="text-base font-semibold text-primary-900"
          >
            Ready to proceed?
          </h2>

          {!hasBlockingGaps ? (
            <p className="mt-2 text-sm text-slate-600">
              All required information looks complete. Click below to read and sign the Declaration,
              then submit your application.
            </p>
          ) : (
            <p className="mt-2 text-sm text-red-700">
              You have {allErrorGaps.length} unresolved issue{allErrorGaps.length === 1 ? "" : "s"}.
              Please fix them before proceeding to the Declaration.
            </p>
          )}

          <div className="mt-5">
            {hasBlockingGaps ? (
              <button
                type="button"
                disabled
                className={cn(
                  "flex items-center gap-2 rounded-md px-6 py-3 text-sm font-semibold text-white",
                  "bg-primary-900 opacity-40 cursor-not-allowed"
                )}
                aria-disabled="true"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                Proceed to Declaration
              </button>
            ) : (
              <Link
                href="/apply/declaration"
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-semibold text-white",
                  "bg-primary-900 hover:bg-primary-800 transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
                )}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                Proceed to Declaration
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Section summary body (per-section rendering) ─────────────────────────────

function SectionSummaryBody({
  sectionType,
  rawData,
  uploadedDocs,
}: {
  sectionType: ApplicationSectionType;
  rawData: unknown;
  uploadedDocs: { slot: string; filename: string }[];
}) {
  switch (sectionType) {
    case "CHILD_DETAILS": {
      const rows = renderChildDetails(rawData);
      return <SimpleRows rows={rows} />;
    }

    case "FAMILY_ID": {
      const rows = renderFamilyId(rawData);
      if (rows.length === 0) return <p className="text-sm text-slate-400 italic">No family members added</p>;
      return <SimpleRows rows={rows} />;
    }

    case "PARENT_DETAILS": {
      const rows = renderParentDetails(rawData);
      return <SimpleRows rows={rows} />;
    }

    case "DEPENDENT_CHILDREN": {
      const { rows, childTable } = renderDependentChildren(rawData);
      return (
        <div className="space-y-3">
          <SimpleRows rows={rows} />
          {childTable.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-1.5 pr-4 text-left font-medium text-slate-500">Name</th>
                    <th className="pb-1.5 pr-4 text-left font-medium text-slate-500">Date registered</th>
                    <th className="pb-1.5 text-left font-medium text-slate-500">Named on application</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {childTable.map((c, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-4 text-slate-700">{c.name}</td>
                      <td className="py-1.5 pr-4 text-slate-700">{c.dob}</td>
                      <td className="py-1.5 text-slate-700">
                        {c.isNamed ? (
                          <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }

    case "DEPENDENT_ELDERLY": {
      const rows = renderDependentElderly(rawData);
      return <SimpleRows rows={rows} />;
    }

    case "OTHER_INFO": {
      const rows = renderOtherInfo(rawData);
      return <SimpleRows rows={rows} />;
    }

    case "PARENTS_INCOME": {
      const { rows, incomeSections } = renderParentsIncome(rawData);
      return (
        <div className="space-y-4">
          <SimpleRows rows={rows} />
          {incomeSections.map((sec) => (
            <details key={sec.label} className="group">
              <summary className="cursor-pointer list-none text-xs font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1">
                <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" aria-hidden="true" />
                View itemised income — {sec.label} ({sec.total})
              </summary>
              <div className="mt-2 ml-4">
                <table className="min-w-full text-xs">
                  <tbody className="divide-y divide-slate-50">
                    {sec.itemised.length > 0 ? (
                      sec.itemised.map((item, i) => (
                        <tr key={i}>
                          <td className="py-1 pr-6 text-slate-500">{item.label}</td>
                          <td className="py-1 text-right font-medium text-slate-700">{item.value}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-1 text-slate-400 italic" colSpan={2}>No income items declared</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      );
    }

    case "ASSETS_LIABILITIES": {
      const rows = renderAssetsLiabilities(rawData);
      return (
        <div className="space-y-3">
          <SimpleRows rows={rows} />
          <DocumentCount sectionType={sectionType} uploadedDocs={uploadedDocs} />
        </div>
      );
    }

    case "ADDITIONAL_INFO": {
      const rows = renderAdditionalInfo(rawData);
      return <SimpleRows rows={rows} />;
    }

    default:
      return null;
  }
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SimpleRows({ rows }: { rows: SummaryRow[] }) {
  if (rows.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
      {rows.map(({ label, value }) =>
        value ? (
          <>
            <dt key={`${label}-dt`} className="text-slate-500 whitespace-nowrap">{label}</dt>
            <dd key={`${label}-dd`} className="text-slate-800">{value}</dd>
          </>
        ) : (
          <>
            <dt key={`${label}-dt`} className="col-span-2 text-slate-500 italic">{label}</dt>
          </>
        )
      )}
    </dl>
  );
}

const SECTION_DOC_SLOTS: Partial<Record<ApplicationSectionType, string[]>> = {
  CHILD_DETAILS: ["BIRTH_CERTIFICATE"],
  FAMILY_ID: ["UK_PASSPORT_PARENT_1", "PASSPORT_PARENT_1", "UK_PASSPORT_PARENT_2", "PASSPORT_PARENT_2"],
  PARENTS_INCOME: ["P60_PARENT_1", "P60_PARENT_2", "SELF_ASSESSMENT_PARENT_1", "SELF_ASSESSMENT_PARENT_2", "BENEFITS_EVIDENCE_PARENT_1", "BENEFITS_EVIDENCE_PARENT_2", "CAPITAL_REPAYMENTS_PARENT_1", "CAPITAL_REPAYMENTS_PARENT_2"],
  ASSETS_LIABILITIES: ["COUNCIL_TAX", "BANK_STATEMENT_PARENT_1", "BANK_STATEMENT_PARENT_2"],
};

function DocumentCount({
  sectionType,
  uploadedDocs,
}: {
  sectionType: ApplicationSectionType;
  uploadedDocs: { slot: string; filename: string }[];
}) {
  const slots = SECTION_DOC_SLOTS[sectionType] ?? [];
  const uploaded = uploadedDocs.filter((d) => slots.includes(d.slot));
  const uploadedCount = uploaded.length;
  if (uploadedCount === 0) return null;
  return (
    <div className="text-xs text-slate-500 mt-1">
      <span className="font-medium">{uploadedCount}</span> document{uploadedCount !== 1 ? "s" : ""} uploaded:{" "}
      {uploaded.map((d) => d.filename).join(", ")}
    </div>
  );
}
